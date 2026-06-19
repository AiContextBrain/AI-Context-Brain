using AiContextBrain.Dtos;
using System.Text.Json;

namespace AiContextBrain.Services;

public class RepositoryScanner : IRepositoryScanner
{
    public async Task<ScanResult> ScanRepositoryAsync(string projectPath)
    {
        var result = new ScanResult
        {
            ProjectPath = projectPath
        };

        // Parallel detection for efficiency
        var tasks = new Task[]
        {
            DetectFrameworkAsync(projectPath).ContinueWith(t => result.Framework = t.Result),
            DetectArchitectureTypeAsync(projectPath).ContinueWith(t => result.ArchitectureType = t.Result),
            DetectDatabaseTypeAsync(projectPath).ContinueWith(t => result.DatabaseType = t.Result),
            DetectAuthSystemAsync(projectPath).ContinueWith(t => result.AuthSystem = t.Result),
            AnalyzeFolderStructureAsync(projectPath).ContinueWith(t => result.FolderStructure = t.Result),
            CalculateMetricsAsync(projectPath).ContinueWith(t => result.Metrics = t.Result)
        };

        await Task.WhenAll(tasks);

        // Detect patterns based on gathered information
        result.DetectedPatterns = await DetectPatternsAsync(result);

        // Store raw data for AI context generation
        result.RawData = new Dictionary<string, object>
        {
            ["scanDate"] = DateTime.UtcNow,
            ["framework"] = result.Framework,
            ["architecture"] = result.ArchitectureType,
            ["database"] = result.DatabaseType,
            ["auth"] = result.AuthSystem,
            ["structure"] = result.FolderStructure,
            ["metrics"] = result.Metrics
        };

        return result;
    }

    public async Task<string> DetectFrameworkAsync(string projectPath)
    {
        var detectionRules = new Dictionary<string, Func<string, bool>>
        {
            ["React"] = path => File.Exists(Path.Combine(path, "package.json")) && 
                               File.ReadAllText(Path.Combine(path, "package.json")).Contains("react"),
            ["Angular"] = path => File.Exists(Path.Combine(path, "angular.json")) ||
                               (File.Exists(Path.Combine(path, "package.json")) && 
                                File.ReadAllText(Path.Combine(path, "package.json")).Contains("@angular")),
            ["Vue"] = path => File.Exists(Path.Combine(path, "vite.config.js")) ||
                            (File.Exists(Path.Combine(path, "package.json")) && 
                             File.ReadAllText(Path.Combine(path, "package.json")).Contains("vue")),
            [".NET"] = path => Directory.GetFiles(path, "*.csproj").Length > 0 ||
                              Directory.GetFiles(path, "*.sln").Length > 0,
            ["Node.js"] = path => File.Exists(Path.Combine(path, "package.json")) &&
                                 !File.ReadAllText(Path.Combine(path, "package.json")).Contains("react") &&
                                 !File.ReadAllText(Path.Combine(path, "package.json")).Contains("@angular") &&
                                 !File.ReadAllText(Path.Combine(path, "package.json")).Contains("vue"),
            ["Django"] = path => File.Exists(Path.Combine(path, "manage.py")) ||
                               Directory.Exists(Path.Combine(path, "django_project")),
            ["Flask"] = path => Directory.GetFiles(path, "app.py").Length > 0 ||
                              Directory.GetFiles(path, "run.py").Length > 0,
            ["Spring Boot"] = path => File.Exists(Path.Combine(path, "pom.xml")) &&
                                   File.ReadAllText(Path.Combine(path, "pom.xml")).Contains("spring-boot"),
            ["Laravel"] = path => File.Exists(Path.Combine(path, "artisan")) &&
                                File.Exists(Path.Combine(path, "composer.json"))
        };

        foreach (var rule in detectionRules)
        {
            if (rule.Value(projectPath))
            {
                return rule.Key;
            }
        }

        return "Unknown";
    }

    public async Task<string> DetectArchitectureTypeAsync(string projectPath)
    {
        var patterns = new Dictionary<string, Func<string, bool>>
        {
            ["Clean Architecture"] = path => Directory.Exists(Path.Combine(path, "src", "Domain")) &&
                                            Directory.Exists(Path.Combine(path, "src", "Application")) &&
                                            Directory.Exists(Path.Combine(path, "src", "Infrastructure")),
            ["MVC"] = path => (Directory.Exists(Path.Combine(path, "Controllers")) ||
                              Directory.Exists(Path.Combine(path, "controllers"))) &&
                             (Directory.Exists(Path.Combine(path, "Views")) ||
                              Directory.Exists(Path.Combine(path, "views"))),
            ["Microservices"] = path => Directory.GetDirectories(path).Count(d => 
                File.Exists(Path.Combine(d, "Dockerfile"))) > 1,
            ["Layered"] = path => Directory.Exists(Path.Combine(path, "src", "layers")) ||
                                Directory.Exists(Path.Combine(path, "layers")),
            ["Hexagonal"] = path => Directory.Exists(Path.Combine(path, "adapters")) &&
                                   Directory.Exists(Path.Combine(path, "ports")),
            ["Modular"] = path => Directory.GetDirectories(path).Any(d => 
                File.Exists(Path.Combine(d, "module.json")) ||
                File.Exists(Path.Combine(d, "index.ts")))
        };

        foreach (var pattern in patterns)
        {
            if (pattern.Value(projectPath))
            {
                return pattern.Key;
            }
        }

        return "Custom/Unknown";
    }

    public async Task<string> DetectDatabaseTypeAsync(string projectPath)
    {
        var dbFiles = new[]
        {
            ("PostgreSQL", new[] { "postgresql", "pg", "postgres", "psql", "npgsql" }),
            ("MySQL", new[] { "mysql", "mariadb" }),
            ("MongoDB", new[] { "mongodb", "mongo" }),
            ("SQLite", new[] { "sqlite", "sqlite3" }),
            ("SQL Server", new[] { "sqlserver", "mssql" }),
            ("Oracle", new[] { "oracle", "ora" })
        };

        var configFiles = new[] { "appsettings.json", "config.json", ".env", "database.yml", "docker-compose.yml" };

        foreach (var configFile in configFiles)
        {
            var fullPath = Path.Combine(projectPath, configFile);
            if (File.Exists(fullPath))
            {
                var content = File.ReadAllText(fullPath).ToLower();
                foreach (var (dbType, keywords) in dbFiles)
                {
                    if (keywords.Any(keyword => content.Contains(keyword)))
                    {
                        return dbType;
                    }
                }
            }
        }

        // Deep check for C# db contexts
        var csFiles = Directory.GetFiles(projectPath, "*.cs", SearchOption.AllDirectories)
            .Where(f => !IsIgnoredFile(f, projectPath))
            .Take(200);

        foreach (var f in csFiles)
        {
            var content = File.ReadAllText(f).ToLower();
            if (content.Contains("dbcontext") || content.Contains("usedbcontext"))
            {
                if (content.Contains("usenpgsql")) return "PostgreSQL";
                if (content.Contains("usesqlserver")) return "SQL Server";
                if (content.Contains("usesqlite")) return "SQLite";
                if (content.Contains("usemysql")) return "MySQL";
                return "Entity Framework Core (Unknown DB)";
            }
        }

        return "Not detected";
    }

    public async Task<string> DetectAuthSystemAsync(string projectPath)
    {
        var authPatterns = new Dictionary<string, string[]>
        {
            ["JWT"] = new[] { "jwt", "jsonwebtoken", "jsonwebtoken", "jwtbearer" },
            ["OAuth"] = new[] { "oauth", "passport", "auth0" },
            ["Session"] = new[] { "session", "cookie-session", "express-session" },
            ["Azure AD"] = new[] { "azure", "microsoft", "active-directory" },
            ["Auth0"] = new[] { "auth0" },
            ["Firebase Auth"] = new[] { "firebase", "firestore" }
        };

        var configFiles = new[] { "package.json", "appsettings.json", "config.json", ".env" };

        foreach (var configFile in configFiles)
        {
            var fullPath = Path.Combine(projectPath, configFile);
            if (File.Exists(fullPath))
            {
                var content = File.ReadAllText(fullPath).ToLower();
                foreach (var (authType, keywords) in authPatterns)
                {
                    if (keywords.Any(keyword => content.Contains(keyword)))
                    {
                        return authType;
                    }
                }
            }
        }

        // Deep check for controllers and attributes
        var csFiles = Directory.GetFiles(projectPath, "*.cs", SearchOption.AllDirectories)
            .Where(f => !IsIgnoredFile(f, projectPath))
            .Take(200);

        foreach (var f in csFiles)
        {
            var name = Path.GetFileName(f).ToLower();
            var content = File.ReadAllText(f).ToLower();
            if (name == "authcontroller.cs" || content.Contains("[authorize]") || content.Contains("usertoken"))
            {
                if (content.Contains("jwt")) return "JWT";
                return "Custom Token/Session Auth";
            }
        }

        return "Not detected";
    }

    public async Task<List<string>> AnalyzeFolderStructureAsync(string projectPath)
    {
        var folders = new List<string>();
        var rootDir = new DirectoryInfo(projectPath);

        foreach (var dir in rootDir.GetDirectories("*", SearchOption.TopDirectoryOnly))
        {
            if (!dir.Name.StartsWith(".") && !dir.Name.Equals("node_modules", StringComparison.OrdinalIgnoreCase))
            {
                folders.Add(dir.Name);
            }
        }

        return folders.OrderBy(f => f).ToList();
    }

    public async Task<ProjectMetrics> CalculateMetricsAsync(string projectPath)
    {
        var metrics = new ProjectMetrics();
        var rootDir = new DirectoryInfo(projectPath);

        // Count files and calculate size
        var files = rootDir.GetFiles("*.*", SearchOption.AllDirectories)
            .Where(f => !IsIgnoredFile(f.FullName, projectPath))
            .ToList();

        metrics.FilesCount = files.Count;
        metrics.TotalSizeBytes = files.Sum(f => f.Length);

        // Count lines of code and file extensions
        var linesOfCode = 0;
        var extensions = new Dictionary<string, int>();

        foreach (var file in files)
        {
            var ext = file.Extension.ToLower();
            extensions[ext] = extensions.GetValueOrDefault(ext, 0) + 1;

            if (IsCodeFile(ext))
            {
                try
                {
                    linesOfCode += File.ReadAllLines(file.FullName).Length;
                }
                catch
                {
                    // Skip files that can't be read
                }
            }
        }

        metrics.LinesOfCode = linesOfCode;
        metrics.FileExtensions = extensions;

        // Count folders
        metrics.FoldersCount = rootDir.GetDirectories("*", SearchOption.AllDirectories)
            .Count(d => !IsIgnoredFolder(d.Name));

        // Extract dependencies
        metrics.Dependencies = await ExtractDependenciesAsync(projectPath);

        // Populate architecture maps
        await PopulateDeepArchitectureMapsAsync(projectPath, metrics, files);

        return metrics;
    }

    private async Task<List<string>> DetectPatternsAsync(ScanResult result)
    {
        var patterns = new List<string>();

        if (result.Framework.Contains("React") && result.ArchitectureType.Contains("MVC"))
        {
            patterns.Add("React MVC Pattern");
        }

        if (result.Framework.Contains(".NET") && result.ArchitectureType.Contains("Clean"))
        {
            patterns.Add(".NET Clean Architecture");
        }

        if (result.FolderStructure.Contains("test") || result.FolderStructure.Contains("tests"))
        {
            patterns.Add("Test-Driven Development");
        }

        if (result.FolderStructure.Contains("docker") || result.FolderStructure.Contains("Dockerfile"))
        {
            patterns.Add("Containerized Application");
        }

        if (result.AuthSystem != "Not detected")
        {
            patterns.Add($"Authenticated Application ({result.AuthSystem})");
        }

        return patterns;
    }

    private async Task PopulateDeepArchitectureMapsAsync(string projectPath, ProjectMetrics metrics, List<FileInfo> allFiles)
    {
        metrics.RouteMap = new List<RouteEndpointDetails>();
        metrics.ServiceGraph = new List<ServiceNodeDetails>();
        metrics.EntityMap = new List<EntityDetails>();
        metrics.DtoMap = new List<DtoDetails>();
        metrics.AiProviderMap = new List<AiProviderDetails>();
        metrics.PlanEnforcementMap = new List<PlanEnforcementDetails>();
        metrics.ExtensionExportMap = new List<ExtensionExportDetails>();
        metrics.TestBuildMap = new List<TestBuildDetails>();

        foreach (var file in allFiles)
        {
            var ext = file.Extension.ToLower();
            var name = file.Name;
            var relPath = Path.GetRelativePath(projectPath, file.FullName).Replace('\\', '/');

            if (ext == ".cs")
            {
                var content = await File.ReadAllTextAsync(file.FullName);

                // 1. Route Map
                if (name.EndsWith("Controller.cs") || content.Contains("[Route"))
                {
                    var routeMatches = System.Text.RegularExpressions.Regex.Matches(content, @"\[(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)(?:\(""(.*?)""\))?\]\s*(?:\[Authorize\])?\s*public\s+(?:async\s+)?Task<.*?>\s+(\w+)");
                    foreach (System.Text.RegularExpressions.Match m in routeMatches)
                    {
                        var method = m.Groups[1].Value.Replace("Http", "").ToUpper();
                        var routeStr = m.Groups[2].Success && !string.IsNullOrEmpty(m.Groups[2].Value) ? m.Groups[2].Value : "[action]";
                        var action = m.Groups[3].Value;
                        metrics.RouteMap.Add(new RouteEndpointDetails
                        {
                            Controller = name.Replace(".cs", ""),
                            HttpMethod = method,
                            Route = routeStr,
                            AuthRequirement = content.Contains("[Authorize]") || content.Contains("[Authorize(") ? "Required" : "None",
                            Purpose = $"Action: {action}"
                        });
                    }
                }

                // 2. Service Graph
                if (name.EndsWith("Service.cs"))
                {
                    var dependsMatches = System.Text.RegularExpressions.Regex.Matches(content, @"private\s+readonly\s+I([A-Za-z0-9_]+)\s+_");
                    var deps = new List<string>();
                    foreach (System.Text.RegularExpressions.Match m in dependsMatches) deps.Add(m.Groups[1].Value);

                    metrics.ServiceGraph.Add(new ServiceNodeDetails
                    {
                        Name = name.Replace(".cs", ""),
                        Path = relPath,
                        DependsOn = deps.Distinct().ToList(),
                        Purpose = "Business Logic Service"
                    });
                }

                // 3. Entity Map
                if (name.EndsWith("DbContext.cs"))
                {
                    var dbSetMatches = System.Text.RegularExpressions.Regex.Matches(content, @"DbSet<([A-Za-z0-9_]+)>");
                    foreach (System.Text.RegularExpressions.Match m in dbSetMatches)
                    {
                        metrics.EntityMap.Add(new EntityDetails
                        {
                            Name = m.Groups[1].Value,
                            TablePurpose = "Database Entity",
                            Path = relPath,
                            Relationships = new List<string>()
                        });
                    }
                }
                else if (relPath.Contains("Models/") || relPath.Contains("Entities/"))
                {
                    if (content.Contains("public class " + name.Replace(".cs", "")) && !metrics.EntityMap.Any(e => e.Name == name.Replace(".cs", "")))
                    {
                        metrics.EntityMap.Add(new EntityDetails
                        {
                            Name = name.Replace(".cs", ""),
                            TablePurpose = "Domain Model",
                            Path = relPath
                        });
                    }
                }

                // 4. Dto Map
                if (relPath.Contains("Dtos/") || relPath.Contains("Requests/") || name.EndsWith("Dto.cs") || name.EndsWith("Request.cs") || name.EndsWith("Response.cs"))
                {
                    var className = name.Replace(".cs", "");
                    metrics.DtoMap.Add(new DtoDetails
                    {
                        Name = className,
                        Path = relPath,
                        Purpose = "Data Transfer Object",
                        UsedBy = "Controllers"
                    });
                }

                // 5. Ai Provider Map
                if (name.Contains("AI") || content.Contains("OpenAI") || content.Contains("Gemini") || content.Contains("Claude"))
                {
                    if (content.Contains("OpenAI") || name.Contains("OpenAI"))
                        metrics.AiProviderMap.Add(new AiProviderDetails { ProviderName = "OpenAI", Path = relPath });
                    if (content.Contains("Gemini") || name.Contains("Gemini"))
                        metrics.AiProviderMap.Add(new AiProviderDetails { ProviderName = "Gemini", Path = relPath });
                    if (content.Contains("Claude") || name.Contains("Claude"))
                        metrics.AiProviderMap.Add(new AiProviderDetails { ProviderName = "Claude", Path = relPath });
                }

                // 6. Plan Enforcement Map
                if (content.Contains("PlanLimits") || content.Contains("maxContextSize") || content.Contains("user.Plan") || content.Contains("aiRequests"))
                {
                    metrics.PlanEnforcementMap.Add(new PlanEnforcementDetails
                    {
                        Name = name.Replace(".cs", ""),
                        Type = "Plan Enforcement Check",
                        Path = relPath
                    });
                }
            }

            // 7. Extension Export Map
            if (ext == ".ts" || ext == ".js" || ext == ".tsx")
            {
                if (relPath.Contains("vscode-extension"))
                {
                    var content = await File.ReadAllTextAsync(file.FullName);
                    if (content.Contains(".ai-context.md") || content.Contains(".cursor/rules") || content.Contains("CLAUDE.md") || content.Contains("copilot-instructions.md") || content.Contains(".windsurfrules"))
                    {
                        if (content.Contains(".ai-context.md")) metrics.ExtensionExportMap.Add(new ExtensionExportDetails { TargetEditor = "Generic", FilePath = ".ai-context.md", Description = "Optimized Context" });
                        if (content.Contains(".cursor/rules")) metrics.ExtensionExportMap.Add(new ExtensionExportDetails { TargetEditor = "Cursor", FilePath = ".cursor/rules", Description = "Cursor Rules" });
                        if (content.Contains("CLAUDE.md")) metrics.ExtensionExportMap.Add(new ExtensionExportDetails { TargetEditor = "Claude Code", FilePath = "CLAUDE.md", Description = "Claude Instructions" });
                        if (content.Contains("copilot-instructions.md")) metrics.ExtensionExportMap.Add(new ExtensionExportDetails { TargetEditor = "GitHub Copilot", FilePath = "copilot-instructions.md", Description = "Copilot Rules" });
                        if (content.Contains(".windsurfrules")) metrics.ExtensionExportMap.Add(new ExtensionExportDetails { TargetEditor = "Windsurf", FilePath = ".windsurfrules", Description = "Windsurf Rules" });
                    }
                }
            }

            // 8. Test / Build Map
            if (name == "package.json")
            {
                var content = await File.ReadAllTextAsync(file.FullName);
                if (content.Contains("\"build\"")) metrics.TestBuildMap.Add(new TestBuildDetails { Name = "npm build", Command = "npm run build", Type = "Build", Path = relPath });
                if (content.Contains("\"test\"")) metrics.TestBuildMap.Add(new TestBuildDetails { Name = "npm test", Command = "npm run test", Type = "Test", Path = relPath });
                if (content.Contains("\"compile\"")) metrics.TestBuildMap.Add(new TestBuildDetails { Name = "npm compile", Command = "npm run compile", Type = "Compile", Path = relPath });
            }
            if (name == "smoke.test.mjs")
            {
                metrics.TestBuildMap.Add(new TestBuildDetails { Name = "Smoke Tests", Command = "node tests/smoke.test.mjs", Type = "Test", Path = relPath });
            }
            if (name.EndsWith(".test.cs") || name.EndsWith("Tests.cs"))
            {
                metrics.TestBuildMap.Add(new TestBuildDetails { Name = name.Replace(".cs", ""), Command = "dotnet test", Type = "Test", Path = relPath });
            }
        }

        // Csproj build check
        if (allFiles.Any(f => f.Extension == ".csproj"))
        {
            metrics.TestBuildMap.Add(new TestBuildDetails { Name = ".NET Build", Command = "dotnet build", Type = "Build", Path = "root" });
        }

        // Deduplicate elements
        metrics.AiProviderMap = metrics.AiProviderMap.GroupBy(a => a.ProviderName).Select(g => g.First()).ToList();
        metrics.ExtensionExportMap = metrics.ExtensionExportMap.GroupBy(a => a.FilePath).Select(g => g.First()).ToList();
        metrics.TestBuildMap = metrics.TestBuildMap.GroupBy(a => a.Name).Select(g => g.First()).ToList();
        metrics.PlanEnforcementMap = metrics.PlanEnforcementMap.GroupBy(a => a.Path).Select(g => g.First()).ToList();
    }

    private bool IsIgnoredFile(string filePath, string projectPath)
    {
        var relativePath = Path.GetRelativePath(projectPath, filePath);
        var ignoredPatterns = new[]
        {
            "node_modules", ".git", "bin", "obj", "dist", "build", ".vs", ".vscode",
            "packages", ".idea", "*.dll", "*.exe", "*.pdb", "*.cache"
        };

        return ignoredPatterns.Any(pattern => 
            relativePath.Contains(pattern) || Path.GetFileName(filePath).StartsWith("."));
    }

    private bool IsIgnoredFolder(string folderName)
    {
        var ignoredFolders = new[]
        {
            "node_modules", ".git", "bin", "obj", "dist", "build", ".vs", ".vscode",
            "packages", ".idea", "__pycache__", "target", "coverage"
        };

        return ignoredFolders.Contains(folderName);
    }

    private bool IsCodeFile(string extension)
    {
        var codeExtensions = new[]
        {
            ".cs", ".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".c", ".h",
            ".php", ".rb", ".go", ".rs", ".swift", ".kt", ".scala", ".dart", ".vue",
            ".html", ".css", ".scss", ".less", ".sql", ".xml", ".json", ".yaml", ".yml"
        };

        return codeExtensions.Contains(extension);
    }

    private async Task<List<string>> ExtractDependenciesAsync(string projectPath)
    {
        var dependencies = new List<string>();

        // Package.json dependencies
        var packageJsonPath = Path.Combine(projectPath, "package.json");
        if (File.Exists(packageJsonPath))
        {
            try
            {
                var content = File.ReadAllText(packageJsonPath);
                var packageJson = JsonSerializer.Deserialize<JsonElement>(content);
                if (packageJson.TryGetProperty("dependencies", out var deps))
                {
                    foreach (var dep in deps.EnumerateObject())
                    {
                        dependencies.Add($"{dep.Name}@{dep.Value}");
                    }
                }
            }
            catch
            {
                // Ignore parsing errors
            }
        }

        // .csproj dependencies
        var csprojFiles = Directory.GetFiles(projectPath, "*.csproj", SearchOption.TopDirectoryOnly);
        foreach (var csproj in csprojFiles)
        {
            try
            {
                var content = File.ReadAllText(csproj);
                var matches = System.Text.RegularExpressions.Regex.Matches(content, @"PackageReference Include=""([^""]+)""");
                foreach (System.Text.RegularExpressions.Match match in matches)
                {
                    dependencies.Add($"nuget:{match.Groups[1].Value}");
                }
            }
            catch
            {
                // Ignore parsing errors
            }
        }

        return dependencies.Take(20).ToList(); // Limit to top 20 dependencies
    }
}
