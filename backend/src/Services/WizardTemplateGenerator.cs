using System;
using System.Collections.Generic;
using System.Linq;
using AiContextBrain.Models;
using AiContextBrain.Dtos;

namespace AiContextBrain.Services
{
    public class WizardTemplateBlueprint
    {
        public string Framework { get; set; } = "Unknown";
        public string ArchitectureType { get; set; } = "Monolithic";
        public string DatabaseType { get; set; } = "None";
        public string AuthSystem { get; set; } = "None";
        public List<string> FolderStructure { get; set; } = new();
        public List<string> Dependencies { get; set; } = new();
        public Dictionary<string, int> FileExtensions { get; set; } = new();
        public List<(string Title, string Decision, string Reasoning, string Category)> SystemDecisions { get; set; } = new();
        public List<ArchitectureRule> ArchitectureRules { get; set; } = new();
        public List<CodingConvention> CodingConventions { get; set; } = new();
    }

    public class WizardTemplateGenerator
    {
        public static WizardTemplateBlueprint Generate(WizardCreateRequest request)
        {
            var blueprint = new WizardTemplateBlueprint();

            // Set Framework / Languages
            var langs = (request.Languages ?? new()).Select(l => l.ToLowerInvariant().Trim()).ToList();
            var isTsOrJs = langs.Any(l => l.Contains("typescript") || l.Contains("javascript"));
            var isCSharp = langs.Any(l => l.Contains("c#") || l.Contains("csharp") || l.Contains("dotnet"));
            var isPython = langs.Any(l => l.Contains("python"));
            var isGo = langs.Any(l => l.Contains("go"));
            var isRust = langs.Any(l => l.Contains("rust"));
            var isJava = langs.Any(l => l.Contains("java") || l.Contains("kotlin"));
            var isSwift = langs.Any(l => l.Contains("swift"));
            var isCpp = langs.Any(l => l.Contains("cpp"));

            var frameworks = new List<string>();
            if (isTsOrJs) frameworks.Add("Next.js / Node.js (TypeScript/JavaScript)");
            if (isCSharp) frameworks.Add("ASP.NET Core / C#");
            if (isPython) frameworks.Add("FastAPI / Python");
            if (isGo) frameworks.Add("Go / Gin");
            if (isRust) frameworks.Add("Rust / Actix-Web");
            if (isJava) frameworks.Add("Spring Boot (Java/Kotlin)");
            if (isSwift) frameworks.Add("Swift / iOS");
            if (isCpp) frameworks.Add("C++");

            blueprint.Framework = frameworks.Count > 0 ? string.Join(", ", frameworks) : "Unknown";

            // Set Database Type
            var databases = (request.Databases ?? new()).Select(d => d.ToLowerInvariant().Trim()).ToList();
            blueprint.DatabaseType = databases.Count > 0 ? string.Join(", ", databases) : "None";
            
            // Set AuthSystem
            var auths = (request.Auths ?? new()).Select(a => a.ToLowerInvariant().Trim()).ToList();
            blueprint.AuthSystem = auths.Count > 0 ? string.Join(", ", auths) : "None";

            // Define Architecture
            var productTypes = (request.ProductTypes ?? new()).Select(p => p.ToLowerInvariant().Trim()).ToList();
            var isMicroservices = productTypes.Contains("microservices") || 
                                   (request.Deployments ?? new()).Any(d => d.ToLowerInvariant().Contains("actions")) || 
                                   langs.Contains("go") || 
                                   langs.Contains("rust");
            blueprint.ArchitectureType = isMicroservices ? "Microservices" : "Clean Architecture";

            // 1. GENERATE FOLDER STRUCTURE & DEPENDENCIES
            var folders = new List<string>();
            var deps = new List<string>();
            var extensions = new Dictionary<string, int>();

            if (isTsOrJs)
            {
                folders.AddRange(new[] {
                    "src/app",
                    "src/app/api",
                    "src/components",
                    "src/components/ui",
                    "src/lib",
                    "src/services",
                    "tests"
                });
                deps.AddRange(new[] { "react", "react-dom", "next", "zod", "tailwind-merge", "clsx" });
                extensions[".ts"] = 15;
                extensions[".tsx"] = 20;
                extensions[".json"] = 3;
            }
            if (isCSharp)
            {
                folders.AddRange(new[] {
                    "src/Domain/Entities",
                    "src/Domain/Common",
                    "src/Application/Common",
                    "src/Application/Interfaces",
                    "src/Infrastructure/Persistence",
                    "src/Infrastructure/Identity",
                    "src/WebApi/Controllers",
                    "tests/Application.UnitTests"
                });
                deps.AddRange(new[] { "Microsoft.EntityFrameworkCore", "MediatR", "AutoMapper", "FluentValidation" });
                extensions[".cs"] = 35;
                extensions[".csproj"] = 3;
                extensions[".json"] = 2;
            }
            if (isPython)
            {
                folders.AddRange(new[] {
                    "src/routers",
                    "src/models",
                    "src/schemas",
                    "src/services",
                    "tests"
                });
                deps.AddRange(new[] { "fastapi", "uvicorn", "pydantic", "dotenv" });
                extensions[".py"] = 15;
            }
            if (isGo)
            {
                folders.AddRange(new[] {
                    "src/handler",
                    "src/repository",
                    "src/domain",
                    "src/config",
                    "tests"
                });
                deps.AddRange(new[] { "github.com/gin-gonic/gin", "dotenv" });
                extensions[".go"] = 15;
            }
            if (isRust)
            {
                folders.AddRange(new[] {
                    "src/actors",
                    "src/handlers",
                    "src/models",
                    "src/config",
                    "tests"
                });
                deps.AddRange(new[] { "actix-web", "dotenv" });
                extensions[".rs"] = 15;
            }
            if (isJava)
            {
                folders.AddRange(new[] {
                    "src/main/java",
                    "src/main/resources",
                    "src/test/java"
                });
                deps.AddRange(new[] { "spring-boot-starter-web" });
                extensions[".java"] = 15;
            }
            if (isSwift)
            {
                folders.AddRange(new[] {
                    "Sources",
                    "Tests"
                });
                extensions[".swift"] = 15;
            }

            // Fallback general structure if nothing matched
            if (folders.Count == 0)
            {
                folders.AddRange(new[] {
                    "src/controllers",
                    "src/models",
                    "src/services",
                    "src/config",
                    "tests"
                });
                deps.AddRange(new[] { "dotenv" });
            }

            // Add Auth Folder structure & dependencies
            foreach (var authOpt in auths)
            {
                if (authOpt.Contains("nextauth"))
                {
                    if (isTsOrJs)
                    {
                        folders.Add("src/app/api/auth/[...nextauth]");
                        folders.Add("src/lib/auth");
                    }
                    deps.Add("next-auth");
                }
                else if (authOpt.Contains("jwt"))
                {
                    folders.Add("src/services/auth");
                    if (isCSharp)
                    {
                        deps.Add("System.IdentityModel.Tokens.Jwt");
                        deps.Add("Microsoft.AspNetCore.Authentication.JwtBearer");
                    }
                    else if (isTsOrJs)
                    {
                        deps.Add("jsonwebtoken");
                    }
                }
                else if (authOpt.Contains("oauth"))
                {
                    folders.Add("src/services/oauth");
                }
            }

            // Add Database Folder structure & dependencies
            var db = blueprint.DatabaseType.ToLowerInvariant();
            if (db.Contains("postgres") || db.Contains("mysql") || db.Contains("sqlite") || db.Contains("sqlserver"))
            {
                if (isTsOrJs)
                {
                    folders.Add("src/lib/db");
                    deps.Add("@prisma/client");
                    deps.Add("prisma");
                }
                if (isCSharp)
                {
                    if (db.Contains("postgres")) deps.Add("Npgsql.EntityFrameworkCore.PostgreSQL");
                    else if (db.Contains("sqlite")) deps.Add("Microsoft.EntityFrameworkCore.Sqlite");
                    else deps.Add("Microsoft.EntityFrameworkCore.SqlServer");
                }
            }
            else if (db.Contains("mongo"))
            {
                folders.Add("src/lib/mongodb");
                deps.Add("mongodb");
            }

            // Add Billing
            foreach (var billingOpt in (request.Billings ?? new()))
            {
                var bill = billingOpt.ToLowerInvariant().Trim();
                if (bill == "stripe")
                {
                    folders.Add("src/services/billing");
                    if (isTsOrJs)
                    {
                        folders.Add("src/app/api/webhooks/stripe");
                        deps.Add("stripe");
                    }
                    else if (isCSharp)
                    {
                        deps.Add("Stripe.net");
                    }
                }
                else if (bill == "paddle")
                {
                    folders.Add("src/services/billing");
                    if (isTsOrJs)
                    {
                        folders.Add("src/app/api/webhooks/paddle");
                        deps.Add("@paddle/paddle-js");
                    }
                }
            }

            // Add Automation / Workflow
            foreach (var autoOpt in (request.Automations ?? new()))
            {
                var auto = autoOpt.ToLowerInvariant().Trim();
                if (auto == "n8n")
                {
                    folders.Add("src/services/automation");
                    folders.Add("src/app/api/webhooks/n8n");
                    deps.Add("axios");
                }
                else if (auto == "zapier")
                {
                    folders.Add("src/services/automation");
                    folders.Add("src/app/api/webhooks/zapier");
                    deps.Add("axios");
                }
                else if (auto == "make")
                {
                    folders.Add("src/services/automation");
                    folders.Add("src/app/api/webhooks/make");
                    deps.Add("axios");
                }
                else if (auto == "i18n")
                {
                    folders.Add("src/locales");
                    var selectedLocales = (request.Locales ?? new List<string>())
                        .Select(loc => loc.ToLowerInvariant().Trim())
                        .Where(loc => !string.IsNullOrEmpty(loc))
                        .ToList();
                    
                    if (selectedLocales.Count == 0)
                    {
                        folders.Add("src/locales/en");
                    }
                    else
                    {
                        foreach (var loc in selectedLocales)
                        {
                            folders.Add($"src/locales/{loc}");
                        }
                    }

                    if (isTsOrJs)
                    {
                        deps.Add("react-i18next");
                        deps.Add("i18next");
                    }
                }
                else if (auto == "custom webhook system" || auto.Contains("webhook"))
                {
                    folders.Add("src/services/webhooks");
                    folders.Add("src/app/api/webhooks/incoming");
                    folders.Add("src/app/api/webhooks/outgoing");
                }
                else if (auto.Contains("job") || auto.Contains("worker"))
                {
                    folders.Add("src/workers");
                    folders.Add("src/services/jobs");
                    if (isTsOrJs) deps.Add("bullmq");
                    else if (isCSharp) deps.Add("Hangfire");
                }
                else if (auto == "yaml")
                {
                    folders.Add(".github/workflows");
                }
            }

            // Add Deployments
            foreach (var deployOpt in (request.Deployments ?? new()))
            {
                var deploy = deployOpt.ToLowerInvariant().Trim();
                if (deploy == "github actions" || deploy == "yaml")
                {
                    folders.Add(".github/workflows");
                }
            }

            blueprint.FolderStructure = folders.Distinct().ToList();
            blueprint.Dependencies = deps.Distinct().ToList();
            blueprint.FileExtensions = extensions;

            // 2. GENERATE SYSTEM DECISIONS (Roadmap, Risks, Setup Commands)
            var productTypesList = request.ProductTypes ?? new List<string>();
            var billingsList = request.Billings ?? new List<string>();
            var automationsList = request.Automations ?? new List<string>();

            // MVP Roadmap Decision
            var roadmapText = "- **Phase 1: Foundation (Temel Kurulum)**\n" +
                              $"  - Initialize {blueprint.Framework} project structure.\n" +
                              $"  - Configure {blueprint.DatabaseType} connection & schema models.\n" +
                              $"  - Setup {blueprint.AuthSystem} authentication middleware and endpoints.\n" +
                              "- **Phase 2: Core Features (Ana Özellikler)**\n" +
                              $"  - Implement {string.Join(", ", productTypesList)} Domain Services & Repository logic.\n" +
                              "  - Build frontend pages/controllers and routing definitions.\n";

            if (billingsList.Any(b => b != "none" && b != ""))
            {
                roadmapText += $"  - Integrate {string.Join(", ", billingsList)} subscription checkout & billing flows.\n";
            }
            if (automationsList.Any(a => a != "none" && a != ""))
            {
                roadmapText += $"  - Configure {string.Join(", ", automationsList)} workflow routing & webhook handlers.\n";
            }

            roadmapText += "- **Phase 3: Integration & Testing (Entegrasyon & Testler)**\n" +
                           "  - Write unit tests for business logic validation.\n" +
                           "  - Test database migrations, seed data, and API end-to-end paths.\n" +
                           "- **Phase 4: Release & Deployment (Üretim & Canlı)**\n" +
                           "  - Configure production hosting pipelines.\n" +
                           "  - Enable SSL certificate, secret values, audit logs & telemetry tracking.\n";

            blueprint.SystemDecisions.Add((
                "MVP Development Roadmap",
                roadmapText,
                "Ensures structured development progression following standard practices.",
                "Roadmap"
            ));

            // Risk Notes
            var riskText = "- **Security Risks (Güvenlik Riskleri)**:\n" +
                           "  - Ensure secret environment variables are never committed to git.\n" +
                           "  - Configure CORS & Rate Limits on all endpoints to prevent DOS attacks.\n";

            if (billingsList.Any(b => b != "none" && b != ""))
            {
                riskText += $"  - Validate {string.Join(", ", billingsList)} webhook signatures strictly to prevent invoice fraud.\n";
            }
            if (automationsList.Any(a => a != "none" && a != ""))
            {
                riskText += $"  - Restrict incoming webhook endpoints for {string.Join(", ", automationsList)} to verified headers or source IPs.\n";
            }

            riskText += "- **Performance Risks (Performans Riskleri)**:\n" +
                        $"  - Manage {blueprint.DatabaseType} connection pool correctly, avoiding leaks in serverless functions.\n" +
                        "  - Use pagination on all resource list operations.\n" +
                        "- **Operational Risks (Operasyonel Riskleri)**:\n" +
                        "  - Setup central audit logging & error tracing (e.g. Sentry) for real-time monitoring.\n";

            blueprint.SystemDecisions.Add((
                "Architectural Risk Assessment & Mitigation",
                riskText,
                "Identifies vulnerability vectors and resource leaks early in the lifecycle.",
                "Risk Management"
            ));

            // Setup Commands
            var setupText = "Run the following commands to configure and launch the project locally:\n\n";
            if (isTsOrJs)
            {
                setupText += "```bash\n" +
                             "npm install\n";
                if (db.Contains("postgres") || db.Contains("mysql") || db.Contains("sqlite"))
                {
                    setupText += "npx prisma migrate dev --name init\n";
                }
                setupText += "npm run dev\n" +
                             "```\n";
            }
            else if (isCSharp)
            {
                setupText += "```bash\n" +
                             "dotnet restore\n" +
                             "dotnet ef database update\n" +
                             "dotnet run --project src/WebApi\n" +
                             "```\n";
            }
            else
            {
                setupText += "```bash\n" +
                             "// General init commands\n" +
                             "```\n";
            }

            blueprint.SystemDecisions.Add((
                "Project Initialization Commands",
                setupText,
                "Commands needed to seed, compile, and run this boilerplate environment.",
                "Operations"
            ));

            // 3. GENERATE ARCHITECTURE RULES & CODING CONVENTIONS BASED ON STRICTNESS
            var strictnessList = (request.StrictnessLevels ?? new()).Select(s => s.ToLowerInvariant().Trim()).ToList();
            var hasStrict = strictnessList.Contains("strict");
            var hasEnterprise = strictnessList.Contains("enterprise");

            // Add standard rules
            blueprint.ArchitectureRules.Add(new ArchitectureRule {
                Name = "No hardcoded secrets",
                Pattern = "(?i)(password|secret|key|token|connectionstring)\\s*=\\s*\"[^\"]{6,}\"",
                Description = "Never write plain secrets/credentials in source files. Use environment variables.",
                RuleType = "ContentForbidden",
                Severity = "Error",
                IsActive = true
            });

            if (isTsOrJs)
            {
                blueprint.ArchitectureRules.Add(new ArchitectureRule {
                    Name = "API Route Location",
                    Pattern = "src/app/api",
                    Description = "Next.js routing controllers must reside within app/api directory.",
                    RuleType = "FolderRestriction",
                    FolderPath = "src/app/api",
                    Severity = "Error",
                    IsActive = true
                });

                blueprint.CodingConventions.Add(new CodingConvention {
                    Name = "Next.js Page Convention",
                    Rule = "Each route segment page must export default function Page()",
                    Example = "export default function Page() { return <main>Hello</main>; }",
                    Language = "typescript",
                    IsActive = true
                });
            }

            if (hasStrict || hasEnterprise)
            {
                blueprint.ArchitectureRules.Add(new ArchitectureRule {
                    Name = "Max File Size Rule",
                    Pattern = "350",
                    Description = "Keep modules focused and maintainable by restricting files to 350 lines max.",
                    RuleType = "FileSizeLimit",
                    Severity = "Warning",
                    IsActive = true
                });

                if (isTsOrJs)
                {
                    blueprint.ArchitectureRules.Add(new ArchitectureRule {
                        Name = "Component Separation Boundary",
                        Pattern = "use client",
                        Description = "Isolate client state components with 'use client' tag at the very top. Avoid mixing server and client code.",
                        RuleType = "Regex",
                        Severity = "Warning",
                        IsActive = true
                    });
                }

                blueprint.CodingConventions.Add(new CodingConvention {
                    Name = "Strict Type Casting",
                    Rule = "Do not use 'any' or loose casts in typescript. Define proper models/interfaces.",
                    Example = "interface User { id: string; }",
                    Language = "typescript",
                    IsActive = true
                });
            }

            if (hasEnterprise)
            {
                blueprint.ArchitectureRules.Add(new ArchitectureRule {
                    Name = "Business Logic Restriction",
                    Pattern = "Controller",
                    Description = "Controllers must delegate immediately to domain handlers. Do not write business logic directly inside controller handlers.",
                    RuleType = "Regex",
                    Severity = "Error",
                    IsActive = true
                });

                blueprint.CodingConventions.Add(new CodingConvention {
                    Name = "Mandatory Test Coverage",
                    Rule = "Every service or use case class must have a corresponding Unit Test file.",
                    Example = "UserService.ts -> UserService.test.ts",
                    Language = "typescript",
                    IsActive = true
                });
            }

            // Webhook specific rules if automation selected
            if ((request.Automations ?? new()).Any(a => a != "none" && a != ""))
            {
                blueprint.ArchitectureRules.Add(new ArchitectureRule {
                    Name = "Webhook Retry Logic & Idempotency",
                    Pattern = "idempotency",
                    Description = "Webhooks must implement signature validation, idempotency checks and safety retries.",
                    RuleType = "Regex",
                    Severity = "Error",
                    IsActive = true
                });

                blueprint.CodingConventions.Add(new CodingConvention {
                    Name = "Webhook Event Naming Standard",
                    Rule = "Webhook events must follow dotted snake_case notation.",
                    Example = "user.subscription_updated, order.payment_failed",
                    Language = "javascript",
                    IsActive = true
                });
            }

            // i18n localization specific rules
            if ((request.Automations ?? new()).Any(a => a.ToLowerInvariant().Trim() == "i18n"))
            {
                blueprint.ArchitectureRules.Add(new ArchitectureRule {
                    Name = "No Hardcoded UI Text",
                    Pattern = "(?i)[\">][^<>{}\"]{15,}[\"<]",
                    Description = "Avoid hardcoding user-facing strings directly in UI templates. Always route through translation helpers like t('key').",
                    RuleType = "Regex",
                    Severity = "Warning",
                    IsActive = true
                });

                blueprint.CodingConventions.Add(new CodingConvention {
                    Name = "Translation Keys & Locale Formatting",
                    Rule = "Store key-value translations under src/locales/{locale} in nested JSON format. Format currency and dates using standardized locale-aware formatters.",
                    Example = "src/locales/en/translation.json: { \"auth\": { \"login\": \"Sign In\" } } | t('auth.login')",
                    Language = "typescript",
                    IsActive = true
                });
            }

            return blueprint;
        }
    }
}
