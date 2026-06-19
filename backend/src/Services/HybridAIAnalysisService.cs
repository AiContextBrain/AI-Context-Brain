// ============================================
// Hybrid AI Analysis Service
// Gemini-only provider with priority key fallback.
// The first Gemini key is treated as the preferred/free key.
// ============================================
using System.Net.Http.Headers;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Collections.Concurrent;
using AiContextBrain.Dtos;
using AiContextBrain.Models;

namespace AiContextBrain.Services;

public interface IHybridAIAnalysisService
{
    Task<AIAnalysisResult> AnalyzeCodeAsync(string code, string language, string projectContext);
    Task<string> ExplainCodeAsync(string code, string language, string projectContext, string filePath, string mode, string scanFingerprint);
    Task<ArchitectureSuggestion[]> SuggestImprovementsAsync(string projectPath, ProjectMemoryDto context);
    Task<string> GenerateArchitectureContextAsync(string projectPath, ProjectMemoryDto context);
    Task<AIProviderStatus> GetProviderStatusAsync();
    bool CanMakeAiRequest(string userId, UserPlan plan);
    void SetEmergencyDisable(bool disabled);
}

public class HybridAIAnalysisService : IHybridAIAnalysisService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<HybridAIAnalysisService> _logger;
    private readonly HttpClient _httpClient;
    
    // Multiple Gemini API keys for redundancy.
    // Configure as GEMINI_API_KEYS=free_key,paid_key.
    private readonly List<string> _geminiKeys;
    
    // Usage tracking
    private readonly Dictionary<string, ProviderUsageStats> _usageStats;
    private readonly ConcurrentDictionary<string, DateTime> _keyCooldownUntil = new();
    private readonly TimeSpan _keyCooldownDuration;

    // AI Cost Protection & Global Budgeting
    private static readonly ConcurrentDictionary<string, (int count, DateTime resetAt)> _aiUsageBudget = new();
    private static int _globalMonthlyRequests = 0;
    private static DateTime _globalResetDate = DateTime.UtcNow.AddMonths(1);
    private static bool _emergencyDisabled = false;
    private const int GlobalMonthlyAiCap = 5000;

    private static readonly ConcurrentDictionary<string, ExplainCacheEntry> _explainCache = new();
    private readonly TimeSpan _explainCacheTtl;
    private readonly int _maxExplainCacheEntries;

    private static string ComputeSha256(string input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    public HybridAIAnalysisService(IConfiguration configuration, ILogger<HybridAIAnalysisService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClient = new HttpClient();
        _usageStats = new Dictionary<string, ProviderUsageStats>();
        _keyCooldownDuration = TimeSpan.FromSeconds(Math.Clamp(_configuration.GetValue("AI:KeyCooldownSeconds", 300), 30, 3600));
        _explainCacheTtl = TimeSpan.FromMinutes(Math.Clamp(_configuration.GetValue("AI:ExplainCacheMinutes", 30), 1, 1440));
        _maxExplainCacheEntries = Math.Clamp(_configuration.GetValue("AI:ExplainCacheMaxEntries", 500), 50, 5000);
        
        // Load Gemini keys in priority order. Key 0 is preferred until it cools down.
        _geminiKeys = LoadApiKeys("AI:GeminiApiKeys");
        
        _logger.LogInformation("Gemini AI Service initialized with {GeminiCount} prioritized Gemini keys", _geminiKeys.Count);
    }

    private List<string> LoadApiKeys(string configKey)
    {
        var keys = new List<string>();
        
        // Try environment variable first (e.g., AI_GEMINIAPIKEYS)
        var envKey = configKey.Replace(":", "_").ToUpperInvariant();
        var envValue = Environment.GetEnvironmentVariable(envKey);
        
        // Fallback to standard platform env names (e.g., GEMINI_API_KEYS)
        if (string.IsNullOrEmpty(envValue))
        {
            if (configKey.Contains("Gemini", StringComparison.OrdinalIgnoreCase))
            {
                envValue = Environment.GetEnvironmentVariable("GEMINI_API_KEYS") 
                    ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            }
        }

        if (!string.IsNullOrEmpty(envValue))
        {
            keys.AddRange(envValue.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(k => k.Trim())
                .Where(k => !string.IsNullOrEmpty(k)));
        }
        
        // Fallback to appsettings.json (e.g., AI:GeminiApiKeys)
        if (keys.Count == 0)
        {
            var keyString = _configuration[configKey];
            if (!string.IsNullOrEmpty(keyString))
            {
                keys.AddRange(keyString.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(k => k.Trim())
                    .Where(k => !string.IsNullOrEmpty(k)));
            }
        }
        
        // Fallback to single key config
        if (keys.Count == 0)
        {
            var singleKey = _configuration[configKey.TrimEnd('s')]; // Remove 's' suffix
            if (!string.IsNullOrEmpty(singleKey))
            {
                keys.Add(singleKey);
            }
        }
        
        return keys;
    }

    public async Task<AIAnalysisResult> AnalyzeCodeAsync(string code, string language, string projectContext)
    {
        if (!CheckGlobalBudget())
        {
            _logger.LogWarning("AI code analysis skipped: global budget exceeded or emergency disabled.");
            return new AIAnalysisResult
            {
                Complexity = "unknown",
                Suggestions = Array.Empty<string>(),
                ArchitectureViolations = Array.Empty<string>(),
                RefactoringOpportunities = Array.Empty<string>()
            };
        }

        try
        {
            var result = await TryGeminiAnalyzeAsync(code, language, projectContext);
            if (result != null)
            {
                TrackUsage(AIProvider.Gemini, "analyze", true);
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini failed for code analysis; using local fallback");
        }

        TrackUsage(AIProvider.Gemini, "analyze", false);

        _logger.LogError("Gemini unavailable for code analysis");
        return CreateMockResult();
    }

    public async Task<string> ExplainCodeAsync(string code, string language, string projectContext, string filePath, string mode, string scanFingerprint)
    {
        var cacheKey = $"{scanFingerprint ?? "unknown"}:{filePath}:{ComputeSha256(code)}:{mode}";
        if (_explainCache.TryGetValue(cacheKey, out var cachedEntry))
        {
            if (cachedEntry.ExpiresAt > DateTime.UtcNow)
            {
                _logger.LogInformation("Returning cached explain results for {FilePath} (Mode: {Mode})", filePath, mode);
                return cachedEntry.Value;
            }
            _explainCache.TryRemove(cacheKey, out _);
        }

        if (!CheckGlobalBudget())
        {
            _logger.LogWarning("AI code explanation skipped: global budget exceeded or emergency disabled.");
            return CreateLocalExplanation(code, language, projectContext, filePath);
        }

        try
        {
            var result = await TryGeminiExplainAsync(code, language, projectContext, filePath, mode);
            if (!string.IsNullOrWhiteSpace(result))
            {
                TrackUsage(AIProvider.Gemini, "explain", true);
                var normalized = NormalizeExplanation(result, code, language, projectContext, filePath, mode);
                TrimExplainCacheIfNeeded();
                _explainCache[cacheKey] = new ExplainCacheEntry(normalized, DateTime.UtcNow.Add(_explainCacheTtl));
                return normalized;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini failed for code explanation; using local fallback");
        }

        TrackUsage(AIProvider.Gemini, "explain", false);

        _logger.LogError("Gemini unavailable for code explanation");
        return CreateLocalExplanation(code, language, projectContext, filePath);
    }

    private void TrimExplainCacheIfNeeded()
    {
        if (_explainCache.Count < _maxExplainCacheEntries) return;

        var removeCount = Math.Max(1, _explainCache.Count - _maxExplainCacheEntries + 1);
        foreach (var entry in _explainCache.OrderBy(item => item.Value.ExpiresAt).Take(removeCount))
        {
            _explainCache.TryRemove(entry.Key, out _);
        }
    }

    public async Task<ArchitectureSuggestion[]> SuggestImprovementsAsync(string projectPath, ProjectMemoryDto context)
    {
        if (!CheckGlobalBudget())
        {
            _logger.LogWarning("AI suggestions skipped: global budget exceeded or emergency disabled.");
            return Array.Empty<ArchitectureSuggestion>();
        }

        try
        {
            var result = await TryGeminiSuggestAsync(projectPath, context);
            if (result != null && result.Length > 0)
            {
                TrackUsage(AIProvider.Gemini, "suggest", true);
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini failed for suggestions; using local fallback");
        }

        TrackUsage(AIProvider.Gemini, "suggest", false);

        return CreateMockSuggestions();
    }

    public async Task<string> GenerateArchitectureContextAsync(string projectPath, ProjectMemoryDto context)
    {
        if (!CheckGlobalBudget())
        {
            _logger.LogWarning("AI context generation skipped: global budget exceeded or emergency disabled.");
            return "AI context generation temporarily unavailable. Using template-based fallback.";
        }

        try
        {
            var result = await TryGeminiGenerateContextAsync(projectPath, context);
            if (!string.IsNullOrEmpty(result))
            {
                TrackUsage(AIProvider.Gemini, "generate", true);
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini failed for context generation; using template fallback");
        }

        TrackUsage(AIProvider.Gemini, "generate", false);

        return "AI context generation temporarily unavailable. Using template-based fallback.";
    }

    public Task<AIProviderStatus> GetProviderStatusAsync()
    {
        var status = new AIProviderStatus
        {
            Gemini = new ProviderInfo 
            { 
                Available = _geminiKeys.Count > 0, 
                KeyCount = _geminiKeys.Count,
                CoolingDownKeys = CountCoolingKeys(AIProvider.Gemini, _geminiKeys),
                UsageStats = _usageStats.GetValueOrDefault("Gemini")
            }
        };

        return Task.FromResult(status);
    }

    // ============================================
    // Gemini Implementation
    // ============================================
    private async Task<AIAnalysisResult?> TryGeminiAnalyzeAsync(string code, string language, string projectContext)
    {
        if (_geminiKeys.Count == 0) return null;

        var prompt = BuildCodeAnalysisPrompt(code, language, projectContext);
        var requestBody = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { temperature = 0.2, maxOutputTokens = 2048 }
        };

        return await TryProviderKeysAsync(AIProvider.Gemini, async apiKey =>
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";
            var response = await SendPostRequestAsync(url, requestBody, AIProvider.Gemini, apiKey);
            return ParseGeminiResponse(response) ?? CreateMockResult();
        });
    }

    private async Task<string?> TryGeminiExplainAsync(string code, string language, string projectContext, string filePath, string mode)
    {
        if (_geminiKeys.Count == 0) return null;

        string prompt;
        string modelName = "gemini-2.5-flash";
        int maxTokens = 2548;
        double temp = 0.25;

        if (mode == "quick")
        {
            prompt = BuildQuickCodeExplanationPrompt(code, language, projectContext, filePath);
            modelName = "gemini-2.5-flash-lite";
            maxTokens = 500;
            temp = 0.15;
        }
        else if (mode == "review")
        {
            prompt = BuildReviewCodeExplanationPrompt(code, language, projectContext, filePath);
            modelName = "gemini-2.5-pro";
            maxTokens = 4096;
            temp = 0.3;
        }
        else
        {
            prompt = BuildCodeExplanationPrompt(code, language, projectContext, filePath);
        }

        var requestBody = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { temperature = temp, maxOutputTokens = maxTokens }
        };

        return await TryProviderKeysAsync(AIProvider.Gemini, async apiKey =>
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent?key={apiKey}";
            var response = await SendPostRequestAsync(url, requestBody, AIProvider.Gemini, apiKey);
            return ParseGeminiTextResponse(response);
        });
    }

    private async Task<ArchitectureSuggestion[]?> TryGeminiSuggestAsync(string projectPath, ProjectMemoryDto context)
    {
        if (_geminiKeys.Count == 0) return null;

        var prompt = BuildArchitectureSuggestionPrompt(context);
        var requestBody = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { temperature = 0.3, maxOutputTokens = 4096 }
        };

        return await TryProviderKeysAsync(AIProvider.Gemini, async apiKey =>
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={apiKey}";
            var response = await SendPostRequestAsync(url, requestBody, AIProvider.Gemini, apiKey);
            return ParseSuggestionResponse(response);
        });
    }

    private async Task<string?> TryGeminiGenerateContextAsync(string projectPath, ProjectMemoryDto context)
    {
        if (_geminiKeys.Count == 0) return null;

        var prompt = BuildContextGenerationPrompt(context);
        var requestBody = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { temperature = 0.2, maxOutputTokens = 8192 }
        };

        return await TryProviderKeysAsync(AIProvider.Gemini, async apiKey =>
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={apiKey}";
            var response = await SendPostRequestAsync(url, requestBody, AIProvider.Gemini, apiKey);
            return ParseGeminiTextResponse(response);
        });
    }

    // ============================================
    // Gemini Key Priority Fallback
    // ============================================
    private string GetPreferredGeminiKey()
    {
        if (_geminiKeys.Count == 0) throw new InvalidOperationException("No Gemini keys configured");
        return GetPreferredAvailableKey(AIProvider.Gemini, _geminiKeys);
    }

    private async Task<T?> TryProviderKeysAsync<T>(AIProvider provider, Func<string, Task<T?>> operation)
    {
        var keyCount = _geminiKeys.Count;
        for (var attempt = 0; attempt < keyCount; attempt++)
        {
            string apiKey;
            try
            {
                apiKey = GetPreferredGeminiKey();
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "{Provider} has no available keys for this request", provider);
                return default;
            }

            try
            {
                return await operation(apiKey);
            }
            catch (HttpRequestException ex) when (IsRetryableProviderStatus(ex.StatusCode))
            {
                _logger.LogWarning(ex, "{Provider} key failed with retryable status; trying another key/provider", provider);
            }
        }

        return default;
    }

    private string GetPreferredAvailableKey(AIProvider provider, IReadOnlyList<string> keys)
    {
        var now = DateTime.UtcNow;
        for (var i = 0; i < keys.Count; i++)
        {
            var key = keys[i];
            if (IsKeyCoolingDown(provider, key, now)) continue;
            return key;
        }

        throw new InvalidOperationException($"{provider} keys are temporarily cooling down after quota or provider errors");
    }

    private static bool IsRetryableProviderStatus(HttpStatusCode? statusCode)
    {
        return statusCode is HttpStatusCode.TooManyRequests
            or HttpStatusCode.PaymentRequired
            or HttpStatusCode.Forbidden
            or HttpStatusCode.ServiceUnavailable
            or HttpStatusCode.BadGateway
            or HttpStatusCode.GatewayTimeout;
    }


    // ============================================
    // HTTP Helper
    // ============================================
    private async Task<string> SendPostRequestAsync(string url, object body, AIProvider provider, string apiKey, string? bearerToken = null)
    {
        var json = JsonSerializer.Serialize(body);
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        if (!string.IsNullOrWhiteSpace(bearerToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
        }

        using var response = await _httpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            MarkKeyIssue(provider, apiKey, response.StatusCode);
            var error = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"{provider} request failed with {(int)response.StatusCode} {response.StatusCode}: {error}", null, response.StatusCode);
        }

        return await response.Content.ReadAsStringAsync();
    }

    private void MarkKeyIssue(AIProvider provider, string key, HttpStatusCode statusCode)
    {
        if (statusCode is HttpStatusCode.TooManyRequests
            or HttpStatusCode.PaymentRequired
            or HttpStatusCode.Forbidden
            or HttpStatusCode.ServiceUnavailable
            or HttpStatusCode.BadGateway
            or HttpStatusCode.GatewayTimeout)
        {
            _keyCooldownUntil[KeyCooldownId(provider, key)] = DateTime.UtcNow.Add(_keyCooldownDuration);
            _logger.LogWarning("{Provider} key cooled down for {Seconds}s after {StatusCode}", provider, _keyCooldownDuration.TotalSeconds, statusCode);
        }
    }

    private bool IsKeyCoolingDown(AIProvider provider, string key, DateTime now)
    {
        return _keyCooldownUntil.TryGetValue(KeyCooldownId(provider, key), out var until) && until > now;
    }

    private int CountCoolingKeys(AIProvider provider, IReadOnlyList<string> keys)
    {
        var now = DateTime.UtcNow;
        return keys.Count(key => IsKeyCoolingDown(provider, key, now));
    }

    private static string KeyCooldownId(AIProvider provider, string key)
    {
        var suffix = key.Length <= 8 ? key : key[^8..];
        return $"{provider}:{suffix}";
    }

    // ============================================
    // Prompt Builders
    // ============================================
    private string BuildCodeAnalysisPrompt(string code, string language, string projectContext)
    {
        return $@"You are an expert code analyzer. Analyze the following {language} code for:
1. Code complexity (low/medium/high)
2. Architecture compliance issues
3. Refactoring opportunities
4. Security concerns

Project Context:
{projectContext}

Code to analyze:
```{language}
{code}
```

Respond in JSON format:
{{
  ""complexity"": ""low|medium|high"",
  ""suggestions"": [""suggestion1"", ""suggestion2""],
  ""architectureViolations"": [""violation1"", ""violation2""],
  ""refactoringOpportunities"": [""opportunity1"", ""opportunity2""]
}}";
    }

    private string BuildCodeExplanationPrompt(string code, string language, string projectContext, string filePath)
    {
        return $@"You are AI Context Brain explaining code to a professional developer who wants to understand this repository quickly.

Goal:
Explain the selected code using the project memory, file path, surrounding code, architecture rules, and coding conventions.
Produce a practical, senior-engineer explanation that helps someone safely edit the code. Keep it as concise as the code allows, but include real project evidence when it matters.

Required output format in Markdown:
## What This Code Does
Explain the actual behavior and responsibilities of the selected code.

## Where It Fits In The Project
Explain the module/layer, related backend/frontend/extension flow, and why this file matters.

## Step-by-Step Flow
Use bullets or a numbered list to describe the runtime/control/data flow.

## Dependencies And Contracts
Name important services, DTOs, APIs, config, state, or external providers involved.

## Architecture And Plan Rules
Explain relevant architecture rules, plan enforcement, auth, persistence, or integration constraints from project memory.

## Editing Risks
List edge cases, security concerns, tenant/user isolation concerns, billing/usage impact, tests to update, and common mistakes.

## Recommended Next Changes
Give concrete suggestions for how to modify or extend this code safely.

Rules:
- Be specific to this project and this file.
- If surrounding code is provided, use it to infer behavior instead of only explaining the selected line.
- Avoid generic textbook explanations.
- Do not invent files, endpoints, or services that are not present in project memory.
- If something is uncertain, say what evidence would confirm it.
- Prefer real repository facts over length. A shorter answer is fine when it is accurate and grounded in project memory.

File path:
{filePath}

Language:
{language}

Project memory and surrounding code:
{projectContext}

Selected code:
```{language}
{code}
```";
    }

    private string BuildQuickCodeExplanationPrompt(string code, string language, string projectContext, string filePath)
    {
        return $@"You are AI Context Brain explaining code quickly to a developer.
Provide a basic explanation of what this code does and its role in the project based on the local context. Do NOT perform deep architecture reasoning or repository-wide analysis. Keep it concise.

Required output format in Markdown:
## Summary
A very short (1-2 sentences) summary.

## What It Does
Explain the actual behavior and responsibilities of this code snippet.

## Why It Exists
Explain the purpose of this file or snippet in the project.

## Basic Dependencies
List the primary dependencies or classes called by this snippet.

## Basic Input/Output
Explain the input parameters, arguments, or request body, and what is returned.

## Basic Editing Notes
State any simple checks to keep in mind when modifying this code.

## Confidence
State the confidence score (0-100%) and why.

File path: {filePath}
Language: {language}

Selected code:
```{language}
{code}
```";
    }

    private string BuildReviewCodeExplanationPrompt(string code, string language, string projectContext, string filePath)
    {
        return $@"You are AI Context Brain performing a deep code review and architectural analysis of the selected code for a software engineering team.
Analyze the code and its placement in the project memory thoroughly.

Required output format in Markdown:
## What This Code Does
Detailed architectural summary of the code's responsibilities.

## Where It Fits In The Project
Explain the modules, routes, service graph nodes, DTOs, and entity relationships linked to this file.

## Step-by-Step Flow
Describe the control, data, and logic flow of the selected code.

## Dependencies And Contracts
Describe all service, ORM, auth, API, config, and system decision dependencies involved.

## Architecture And Plan Rules
Explain the architectural rules and constraints (e.g. layers, file size limits, plan checks) that affect this code.

## Code & Architecture Review
- **Security Review:** Evaluate data validation, auth requirements, tenant isolation, and potential security leaks.
- **Performance Review:** Identify unnecessary database queries, non-async tasks, memory bottlenecks, or scaling risks.
- **Architecture & SOLID Review:** Evaluate Single Responsibility, dependency injection patterns, circular dependencies, and layer isolation.
- **Code Smell & Edge Case Detection:** Identify null reference possibilities, edge cases, error handling gaps, or unhandled exceptions.

## Recommended Next Changes & Refactoring
Provide concrete refactoring suggestions, naming compliance adjustments, and safe next changes.

## Editing Risks & Impact Analysis
Analyze the breaking changes this could introduce, what tests must be updated, and the project-wide impact of editing this code.

File path: {filePath}
Language: {language}

Project memory and surrounding context:
{projectContext}

Selected code:
```{language}
{code}
```";
    }

    private string BuildArchitectureSuggestionPrompt(ProjectMemoryDto context)
    {
        return $@"You are a software architect. Based on the following project analysis, suggest improvements:

Project: {context.Name}
Framework: {context.Framework}
Architecture: {context.ArchitectureType}
Complexity Score: {context.Metrics.ComplexityScore}/100

Current Rules:
{string.Join("\n", context.ArchitectureRules.Select(r => $"- {r.Name}: {r.Pattern}"))}

Suggest 3-5 specific architectural improvements. For each, provide:
- Title (brief)
- Description (detailed)
- Priority (high/medium/low)
- Category (architecture/performance/security/maintainability)

Respond in JSON format as an array of suggestions.";
    }

    private string BuildContextGenerationPrompt(ProjectMemoryDto context)
    {
        return $@"Generate comprehensive AI context documentation for this project:

Project: {context.Name}
Framework: {context.Framework}
Architecture: {context.ArchitectureType}

Architecture Rules:
{string.Join("\n", context.ArchitectureRules.Select(r => $"- {r.Name}: {r.Pattern}"))}

Coding Conventions:
{string.Join("\n", context.CodingConventions.Select(c => $"- {c.Name}: {c.Pattern}"))}

System Decisions:
{string.Join("\n", context.SystemDecisions.Select(d => $"- {d.Name}: {d.Decision}"))}

Create a detailed technical context document suitable for AI assistants to understand this codebase.";
    }

    // ============================================
    // Response Parsers
    // ============================================
    private AIAnalysisResult? ParseGeminiResponse(string response)
    {
        try
        {
            var doc = JsonDocument.Parse(response);
            var text = doc.RootElement.GetProperty("candidates")[0]
                .GetProperty("content").GetProperty("parts")[0]
                .GetProperty("text").GetString();
            
            // Extract JSON from markdown code block if present
            text = ExtractJsonFromText(text);
            
            if (string.IsNullOrEmpty(text)) return null;
            
            var result = JsonSerializer.Deserialize<AIAnalysisResult>(text);
            return result;
        }
        catch
        {
            return null;
        }
    }

    private string? ParseGeminiTextResponse(string response)
    {
        try
        {
            var doc = JsonDocument.Parse(response);
            return doc.RootElement.GetProperty("candidates")[0]
                .GetProperty("content").GetProperty("parts")[0]
                .GetProperty("text").GetString();
        }
        catch
        {
            return null;
        }
    }

    private ArchitectureSuggestion[]? ParseSuggestionResponse(string response)
    {
        try
        {
            var doc = JsonDocument.Parse(response);
            var text = doc.RootElement.GetProperty("candidates")[0]
                .GetProperty("content").GetProperty("parts")[0]
                .GetProperty("text").GetString();
            
            text = ExtractJsonFromText(text);
            
            if (string.IsNullOrEmpty(text)) return null;
            
            return JsonSerializer.Deserialize<ArchitectureSuggestion[]>(text);
        }
        catch
        {
            return null;
        }
    }

    private string ExtractJsonFromText(string? text)
    {
        if (string.IsNullOrEmpty(text)) return "";
        
        // Try to extract JSON from markdown code blocks
        var startIdx = text.IndexOf("```json");
        if (startIdx >= 0)
        {
            startIdx += 7;
            var endIdx = text.IndexOf("```", startIdx);
            if (endIdx > startIdx)
            {
                return text.Substring(startIdx, endIdx - startIdx).Trim();
            }
        }
        
        // Try to extract from generic code blocks
        startIdx = text.IndexOf("```");
        if (startIdx >= 0)
        {
            startIdx += 3;
            var endIdx = text.IndexOf("```", startIdx);
            if (endIdx > startIdx)
            {
                return text.Substring(startIdx, endIdx - startIdx).Trim();
            }
        }
        
        return text.Trim();
    }

    private string NormalizeExplanation(string explanation, string code, string language, string projectContext, string filePath, string mode)
    {
        var trimmed = explanation.Trim();
        bool hasCoreSections;

        if (mode == "quick")
        {
            hasCoreSections = trimmed.Contains("## Summary", StringComparison.OrdinalIgnoreCase)
                && trimmed.Contains("## What It Does", StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            hasCoreSections = trimmed.Contains("## What This Code Does", StringComparison.OrdinalIgnoreCase)
                && trimmed.Contains("## Editing Risks", StringComparison.OrdinalIgnoreCase)
                && trimmed.Contains("## Recommended Next Changes", StringComparison.OrdinalIgnoreCase);
        }

        if (trimmed.Length >= 400 || (trimmed.Length >= 200 && hasCoreSections))
        {
            return trimmed;
        }

        var fallback = CreateLocalExplanation(code, language, projectContext, filePath);
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return fallback;
        }

        return $@"{trimmed}

---

## Project Memory Addendum
The provider response above was shorter than AI Context Brain expects, so the backend added deterministic project-memory guidance to keep the explanation useful.

{fallback}";
    }

    private string CreateLocalExplanation(string code, string language, string projectContext, string filePath)
    {
        var selectedLines = code.Split('\n', StringSplitOptions.None).Length;
        var shortCode = code.Length > 1600 ? code[..1600] + "\n..." : code;
        var contextPreview = projectContext.Length > 5200 ? projectContext[..5200] + "\n..." : projectContext;

        return $@"## What This Code Does
AI Context Brain could not get a full provider explanation, so this fallback explains the selected `{language}` code using available project memory and file context. The selected block contains {selectedLines} line(s), so the most important thing is not the raw line count but how it participates in the surrounding file and project architecture.

The selected code is from `{filePath}`. Read it together with the surrounding code because single-line selections often depend on injected services, controller attributes, React hooks, command registration, environment configuration, or extension state created elsewhere in the same file.

## Where It Fits In The Project
The project memory below is the source of truth for how this code should be interpreted. Use the detected framework, architecture type, auth system, database, module map, route map, service graph, plan enforcement map, and export map to understand whether this file belongs to backend API logic, frontend dashboard UX, VS Code extension commands, billing/plan enforcement, team collaboration, or context generation.

## Step-by-Step Flow
1. Locate the selected code inside `{filePath}` and identify the owning function, class, controller action, component, command, or service.
2. Follow the caller and callee relationships from the surrounding code before editing.
3. Check whether the code reads user identity, project identity, plan limits, subscription state, AI provider settings, local file metadata, or generated context output.
4. Validate behavior against existing project memory rather than treating the selected snippet as isolated code.
5. Update tests, smoke checks, or extension compile checks when the change affects command behavior, API contracts, billing, auth, exports, or dashboard UI.

## Dependencies And Contracts
This code may depend on contracts described in project memory: controllers and route maps for backend endpoints, DTO maps for request/response shapes, service graph entries for injected services, plan enforcement entries for usage limits, and extension export targets for files such as `.ai-context.md`, `AI_INSTRUCTIONS.md`, Cursor rules, Claude instructions, Copilot instructions, Windsurf rules, or Aider output.

## Architecture And Plan Rules
Preserve tenant/user/project isolation whenever the code touches project memory, context generation, update endpoints, team workspace data, or subscription-managed features. Do not bypass service-layer helpers, plan gates, token validation, refresh counters, AI request counters, or project ownership checks.

If the selected code is part of the VS Code extension, keep background work lightweight: file watcher and AutoSync should track local metadata and pending changes without continuously consuming AI requests. AI provider calls should happen only for explicit user actions such as Generate Context, Deep Analyze, Explain, or Suggest.

## Editing Risks
- A small-looking edit can break auth headers, plan enforcement, billing transitions, export paths, or extension command registration.
- If the code touches API calls, keep backend and frontend/extension DTOs in sync.
- If the code touches context generation, avoid shallow/static fallback output and preserve semantic compression priority.
- If the code touches payment or subscription state, preserve cancellation-through-period-end behavior and free-plan downgrade after expiration.
- If the code touches team workspace behavior, ensure owner subscription expiration disables shared access consistently.

## Recommended Next Changes
- Confirm the exact owner module for `{filePath}` before changing behavior.
- Search for related controller/service/component/command usage and update all callers together.
- Add or run the closest verification command: backend build/tests for API changes, web typecheck/build for dashboard changes, and extension compile/smoke checks for command changes.
- Keep generated explanations and context exports specific to real scanned project data.

## Selected Code
```{language}
{shortCode}
```

## Project Memory Evidence
```text
{contextPreview}
```";
    }

    // ============================================
    // Usage Tracking
    // ============================================
    private void TrackUsage(AIProvider provider, string operation, bool success)
    {
        var key = provider.ToString();
        if (!_usageStats.ContainsKey(key))
        {
            _usageStats[key] = new ProviderUsageStats();
        }
        
        var stats = _usageStats[key];
        stats.TotalRequests++;
        if (!success) stats.FailedRequests++;
        stats.LastUsed = DateTime.UtcNow;

        if (success)
        {
            _globalMonthlyRequests++;
        }
        
        _logger.LogDebug("Provider {Provider} - {Operation}: {Status}", provider, operation, success ? "Success" : "Failed");
    }

    public bool CanMakeAiRequest(string userId, UserPlan plan)
    {
        if (_emergencyDisabled) return false;
        if (!CheckGlobalBudget()) return false;

        var limit = AiContextBrain.Models.PlanLimits.MaxAiRequestsPerMonth(plan);
        var usage = _aiUsageBudget.GetOrAdd(userId, _ => (0, DateTime.UtcNow.AddMonths(1)));
        
        if (DateTime.UtcNow > usage.resetAt)
        {
            usage = (0, DateTime.UtcNow.AddMonths(1));
            _aiUsageBudget[userId] = usage;
        }

        return usage.count < limit;
    }

    public void SetEmergencyDisable(bool disabled)
    {
        _emergencyDisabled = disabled;
    }

    private bool CheckGlobalBudget()
    {
        if (_emergencyDisabled) return false;

        if (DateTime.UtcNow > _globalResetDate)
        {
            _globalMonthlyRequests = 0;
            _globalResetDate = DateTime.UtcNow.AddMonths(1);
        }

        return _globalMonthlyRequests < GlobalMonthlyAiCap;
    }

    // ============================================
    // Mock Fallbacks
    // ============================================
    private AIAnalysisResult CreateMockResult()
    {
        return new AIAnalysisResult
        {
            Complexity = "medium",
            Suggestions = new[] { "Consider adding more unit tests for complex methods" },
            ArchitectureViolations = Array.Empty<string>(),
            RefactoringOpportunities = new[] { "Extract method for repeated logic" }
        };
    }

    private ArchitectureSuggestion[] CreateMockSuggestions()
    {
        return new[]
        {
            new ArchitectureSuggestion
            {
                Title = "Consider implementing Repository Pattern",
                Description = "Direct data access detected in business logic. Consider abstracting data access through repositories.",
                Priority = "medium",
                Category = "architecture"
            }
        };
    }
}

// ============================================
// Supporting Types
// ============================================
public enum AIProvider
{
    Gemini
}

public class AIProviderStatus
{
    public ProviderInfo Gemini { get; set; } = new();
}

public class ProviderInfo
{
    public bool Available { get; set; }
    public int KeyCount { get; set; }
    public int CoolingDownKeys { get; set; }
    public ProviderUsageStats? UsageStats { get; set; }
}

public class ProviderUsageStats
{
    public int TotalRequests { get; set; }
    public int FailedRequests { get; set; }
    public DateTime? LastUsed { get; set; }
    public double SuccessRate => TotalRequests > 0 ? (TotalRequests - FailedRequests) / (double)TotalRequests * 100 : 0;
}

public sealed record ExplainCacheEntry(string Value, DateTime ExpiresAt);

// AIAnalysisResult and ArchitectureSuggestion are defined in AIAnalysisService.cs
