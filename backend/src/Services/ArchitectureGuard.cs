using AiContextBrain.Dtos;
using System.Text.RegularExpressions;

namespace AiContextBrain.Services;

public class ArchitectureGuard : IArchitectureGuard
{
    private readonly IProjectMemoryService _memoryService;

    public ArchitectureGuard(IProjectMemoryService memoryService)
    {
        _memoryService = memoryService;
    }

    public async Task<List<string>> ValidateFileAsync(string projectPath, string filePath, string? userId = null)
    {
        var violations = new List<string>();
        var projectMemory = await _memoryService.GetProjectMemoryAsync(projectPath, userId);
        
        if (projectMemory == null)
        {
            return violations;
        }

        if (!File.Exists(filePath))
        {
            return violations;
        }

        var content = await File.ReadAllTextAsync(filePath);
        var relativePath = Path.GetRelativePath(projectPath, filePath);

        // Check against architecture rules
        foreach (var rule in projectMemory.ArchitectureRules)
        {
            if (await IsRuleViolated(rule, relativePath, content))
            {
                violations.Add($"Architecture rule violation: {rule.Name} - {rule.Pattern}");
            }
        }

        // Framework-specific validations
        violations.AddRange(await ValidateFrameworkSpecificRules(projectMemory.Framework, relativePath, content));

        // Folder structure validations
        violations.AddRange(ValidateFolderStructure(projectMemory.ArchitectureType, relativePath));
        violations.AddRange(ValidateImportGraph(projectMemory.ArchitectureType, relativePath, content));

        return violations;
    }

    public async Task<List<string>> ValidateProjectAsync(string projectPath, string? userId = null)
    {
        var violations = new List<string>();
        var projectMemory = await _memoryService.GetProjectMemoryAsync(projectPath, userId);
        
        if (projectMemory == null)
        {
            return violations;
        }

        // Scan all code files
        var codeFiles = Directory.GetFiles(projectPath, "*.*", SearchOption.AllDirectories)
            .Where(f => IsCodeFile(f) && !IsIgnoredFile(f, projectPath))
            .ToList();

        foreach (var file in codeFiles)
        {
            var fileViolations = await ValidateFileAsync(projectPath, file, userId);
            violations.AddRange(fileViolations.Select(v => $"{Path.GetRelativePath(projectPath, file)}: {v}"));
        }

        // Validate overall project structure
        violations.AddRange(ValidateProjectStructure(projectMemory));

        return violations;
    }

    public async Task<bool> IsArchitectureViolationAsync(string projectPath, string filePath, string content, string? userId = null)
    {
        var violations = await ValidateFileAsync(projectPath, filePath, userId);
        return violations.Any();
    }

    public async Task<List<string>> GetArchitectureViolationsAsync(string projectPath, string? userId = null)
    {
        return await ValidateProjectAsync(projectPath, userId);
    }

    private async Task<bool> IsRuleViolated(ArchitectureRuleDto rule, string relativePath, string content)
    {
        // 1. Language Scope Filtering
        if (!string.IsNullOrEmpty(rule.Language))
        {
            var fileLang = GetLanguageFromExtension(relativePath);
            if (!string.Equals(fileLang, rule.Language, StringComparison.OrdinalIgnoreCase))
            {
                return false; // Skip rules that do not target this language
            }
        }

        // 2. Folder Path Scoping (if folder path restriction applies generally)
        if (!string.IsNullOrEmpty(rule.FolderPath) && rule.RuleType != "FolderRestriction")
        {
            var normPath = relativePath.Replace('\\', '/');
            var normFolder = rule.FolderPath.Replace('\\', '/');
            if (!normPath.StartsWith(normFolder, StringComparison.OrdinalIgnoreCase))
            {
                // File is outside the folder it's supposed to be in
                return false; // skip validation if the rule only applies to files inside a specific folder
            }
        }

        // 3. Rule Execution based on Type
        switch (rule.RuleType)
        {
            case "FolderRestriction":
                if (!string.IsNullOrEmpty(rule.FolderPath))
                {
                    var normPath = relativePath.Replace('\\', '/');
                    var normFolder = rule.FolderPath.Replace('\\', '/');
                    if (!normPath.StartsWith(normFolder, StringComparison.OrdinalIgnoreCase))
                    {
                        return true; // Violated: file is outside restricted folder
                    }
                }
                break;

            case "ContentForbidden":
                if (!string.IsNullOrEmpty(rule.Pattern) && content.Contains(rule.Pattern, StringComparison.OrdinalIgnoreCase))
                {
                    return true; // Violated: forbidden content found
                }
                break;

            case "ImportRestriction":
                if (!string.IsNullOrEmpty(rule.Pattern))
                {
                    var imports = ExtractImports(content, relativePath);
                    foreach (var import in imports)
                    {
                        try
                        {
                            if (Regex.IsMatch(import, rule.Pattern, RegexOptions.IgnoreCase))
                            {
                                return true; // Violated: forbidden import found
                            }
                        }
                        catch
                        {
                            if (import.Contains(rule.Pattern, StringComparison.OrdinalIgnoreCase))
                            {
                                return true; // Violated: forbidden import found
                            }
                        }
                    }
                }
                break;

            case "NamingConvention":
                if (!string.IsNullOrEmpty(rule.Pattern))
                {
                    var filename = Path.GetFileNameWithoutExtension(relativePath);
                    try
                    {
                        if (!Regex.IsMatch(filename, rule.Pattern))
                        {
                            return true; // Violated: name does not match expected convention regex
                        }
                    }
                    catch
                    {
                        if (!filename.Contains(rule.Pattern))
                        {
                            return true; // Violated: name does not match
                        }
                    }
                }
                break;

            case "FileSizeLimit":
                if (!string.IsNullOrEmpty(rule.Pattern) && int.TryParse(rule.Pattern, out var maxLines))
                {
                    var lines = content.Split('\n').Length;
                    if (lines > maxLines)
                    {
                        return true; // Violated: exceeds maximum line count limit
                    }
                }
                break;

            case "Regex":
            default:
                // Check folder path restrictions (old behavior fallback)
                if (!string.IsNullOrEmpty(rule.FolderPath))
                {
                    if (!relativePath.StartsWith(rule.FolderPath.Replace('\\', '/')))
                    {
                        return true;
                    }
                }

                // Check pattern violations using regex
                try
                {
                    var pattern = rule.Pattern;
                    
                    // Convert common patterns to regex
                    if (pattern.Contains("should be in"))
                    {
                        var expectedFolder = pattern.Split("should be in").Last().Trim();
                        if (!relativePath.Contains(expectedFolder))
                        {
                            return true;
                        }
                    }
                    else if (pattern.Contains("should not"))
                    {
                        var forbiddenPattern = pattern.Split("should not").Last().Trim();
                        if (content.Contains(forbiddenPattern, StringComparison.OrdinalIgnoreCase))
                        {
                            return true;
                        }
                    }
                    else
                    {
                        // Try to match as regex
                        var regex = new Regex(pattern, RegexOptions.IgnoreCase);
                        if (regex.IsMatch(content))
                        {
                            return true;
                        }
                    }
                }
                catch
                {
                    // If regex fails, do simple string matching
                    if (content.Contains(rule.Pattern, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
                break;
        }

        return false;
    }

    private string GetLanguageFromExtension(string filePath)
    {
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        return ext switch
        {
            ".ts" or ".tsx" => "typescript",
            ".js" or ".jsx" => "javascript",
            ".cs" => "csharp",
            ".py" => "python",
            ".go" => "go",
            ".java" => "java",
            _ => "other"
        };
    }

    private async Task<List<string>> ValidateFrameworkSpecificRules(string framework, string relativePath, string content)
    {
        var violations = new List<string>();

        if (framework.Contains("React"))
        {
            violations.AddRange(ValidateReactRules(relativePath, content));
        }
        else if (framework.Contains(".NET"))
        {
            violations.AddRange(ValidateDotNetRules(relativePath, content));
        }
        else if (framework.Contains("Node.js"))
        {
            violations.AddRange(ValidateNodeJsRules(relativePath, content));
        }

        return violations;
    }

    private List<string> ValidateReactRules(string relativePath, string content)
    {
        var violations = new List<string>();

        // Check for class components (should use functional components)
        if (relativePath.EndsWith(".jsx") || relativePath.EndsWith(".tsx"))
        {
            if (content.Contains("class") && content.Contains("extends React.Component"))
            {
                violations.Add("Use functional components instead of class components");
            }

            // Check for direct state mutations
            if (content.Contains("this.state.") && content.Contains("="))
            {
                violations.Add("Use setState or useState hook instead of direct state mutation");
            }

            // Check for missing prop types
            if (content.Contains("props.") && !content.Contains("PropTypes") && !content.Contains("interface"))
            {
                violations.Add("Define prop types or interfaces for component props");
            }
        }

        return violations;
    }

    private List<string> ValidateDotNetRules(string relativePath, string content)
    {
        var violations = new List<string>();

        if (relativePath.EndsWith(".cs"))
        {
            // Check for async/await best practices
            if (content.Contains("async") && !content.Contains("await"))
            {
                violations.Add("Async method should contain await operator");
            }

            // Check for exception handling
            if (content.Contains("catch") && content.Contains("catch {}"))
            {
                violations.Add("Empty catch block - handle exceptions properly");
            }

            // Check for dependency injection violations
            if (content.Contains("new ") && relativePath.Contains("Controller"))
            {
                violations.Add("Use dependency injection instead of direct instantiation in controllers");
            }
        }

        return violations;
    }

    private List<string> ValidateNodeJsRules(string relativePath, string content)
    {
        var violations = new List<string>();

        if (relativePath.EndsWith(".js") || relativePath.EndsWith(".ts"))
        {
            // Check for callback hell
            var callbackNesting = content.Count(c => c == '(') - content.Count(c => c == ')');
            if (Math.Abs(callbackNesting) > 3)
            {
                violations.Add("Consider using async/await instead of nested callbacks");
            }

            // Check for var usage (should use const/let)
            if (content.Contains("var ") && !relativePath.Contains("node_modules"))
            {
                violations.Add("Use const or let instead of var");
            }

            // Check for error handling
            if (content.Contains(".catch") && content.Contains("catch {}"))
            {
                violations.Add("Empty catch block - handle errors properly");
            }
        }

        return violations;
    }

    private List<string> ValidateFolderStructure(string architectureType, string relativePath)
    {
        var violations = new List<string>();

        if (architectureType.Contains("Clean"))
        {
            // Clean Architecture folder validation
            if (relativePath.Contains("Domain") && (relativePath.Contains("Infrastructure") || relativePath.Contains("Application")))
            {
                violations.Add("Domain layer should not depend on other layers");
            }

            if (relativePath.Contains("Controllers") && !relativePath.Contains("Infrastructure"))
            {
                violations.Add("Controllers should be in Infrastructure layer");
            }
        }
        else if (architectureType.Contains("MVC"))
        {
            // MVC folder validation
            if (relativePath.Contains("Models") && relativePath.Contains("Views"))
            {
                violations.Add("Models should not be placed in Views folder");
            }
        }

        return violations;
    }

    private List<string> ValidateImportGraph(string architectureType, string relativePath, string content)
    {
        var violations = new List<string>();
        if (!architectureType.Contains("Clean", StringComparison.OrdinalIgnoreCase))
        {
            return violations;
        }

        var normalizedPath = relativePath.Replace('\\', '/');
        var currentLayer = DetectLayer(normalizedPath);
        if (currentLayer == null)
        {
            return violations;
        }

        foreach (var importTarget in ExtractImports(content, normalizedPath))
        {
            var targetLayer = DetectLayer(importTarget);
            if (targetLayer == null)
            {
                continue;
            }

            if (currentLayer == "Domain" && targetLayer is "Application" or "Infrastructure" or "Presentation")
            {
                violations.Add($"AST import violation: Domain layer cannot import {targetLayer}");
            }

            if (currentLayer == "Application" && targetLayer is "Infrastructure" or "Presentation")
            {
                violations.Add($"AST import violation: Application layer cannot import {targetLayer}");
            }
        }

        return violations.Distinct().ToList();
    }

    private string? DetectLayer(string pathOrNamespace)
    {
        var value = pathOrNamespace.Replace('\\', '/').ToLowerInvariant();
        if (value.Contains("/domain/") || value.Contains(".domain.") || value.EndsWith(".domain")) return "Domain";
        if (value.Contains("/application/") || value.Contains(".application.") || value.EndsWith(".application")) return "Application";
        if (value.Contains("/infrastructure/") || value.Contains(".infrastructure.") || value.EndsWith(".infrastructure")) return "Infrastructure";
        if (value.Contains("/presentation/") || value.Contains("/controllers/") || value.Contains(".presentation.")) return "Presentation";
        return null;
    }

    private IEnumerable<string> ExtractImports(string content, string relativePath)
    {
        var imports = new List<string>();

        foreach (Match match in Regex.Matches(content, @"^\s*import\s+(?:.+?\s+from\s+)?['""](?<target>[^'""]+)['""]", RegexOptions.Multiline))
        {
            imports.Add(ResolveRelativeImport(relativePath, match.Groups["target"].Value));
        }

        foreach (Match match in Regex.Matches(content, @"^\s*using\s+(?<target>[A-Za-z0-9_.]+)\s*;", RegexOptions.Multiline))
        {
            imports.Add(match.Groups["target"].Value);
        }

        foreach (Match match in Regex.Matches(content, @"^\s*from\s+(?<target>[A-Za-z0-9_.]+)\s+import\s+", RegexOptions.Multiline))
        {
            imports.Add(match.Groups["target"].Value.Replace('.', '/'));
        }

        foreach (Match match in Regex.Matches(content, @"^\s*import\s+(?<target>[A-Za-z0-9_.]+)", RegexOptions.Multiline))
        {
            imports.Add(match.Groups["target"].Value.Replace('.', '/'));
        }

        return imports;
    }

    private string ResolveRelativeImport(string relativePath, string importTarget)
    {
        if (!importTarget.StartsWith("."))
        {
            return importTarget.Replace('\\', '/');
        }

        var baseDir = Path.GetDirectoryName(relativePath)?.Replace('\\', '/') ?? "";
        var combined = Path.GetFullPath(Path.Combine("/", baseDir, importTarget)).TrimStart(Path.DirectorySeparatorChar, '/');
        return combined.Replace('\\', '/');
    }

    private List<string> ValidateProjectStructure(ProjectMemoryDto projectMemory)
    {
        var violations = new List<string>();

        // Check for required folders based on architecture
        if (projectMemory.ArchitectureType.Contains("Clean"))
        {
            var requiredFolders = new[] { "Domain", "Application", "Infrastructure" };
            // This would need actual folder checking logic
        }

        // Check for test folder
        if (!projectMemory.Metrics.Dependencies.Any(d => d.Contains("test") || d.Contains("jest") || d.Contains("xunit")))
        {
            violations.Add("No testing framework detected in dependencies");
        }

        return violations;
    }

    private bool IsCodeFile(string filePath)
    {
        var codeExtensions = new[]
        {
            ".cs", ".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".c", ".h",
            ".php", ".rb", ".go", ".rs", ".swift", ".kt", ".scala", ".dart", ".vue"
        };

        return codeExtensions.Contains(Path.GetExtension(filePath).ToLower());
    }

    private bool IsIgnoredFile(string filePath, string projectPath)
    {
        var relativePath = Path.GetRelativePath(projectPath, filePath);
        var ignoredPatterns = new[]
        {
            "node_modules", ".git", "bin", "obj", "dist", "build", ".vs", ".vscode",
            "packages", ".idea", "__pycache__", "target", "coverage", "min.js", "min.css"
        };

        return ignoredPatterns.Any(pattern => relativePath.Contains(pattern));
    }
}
