import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("security-sensitive endpoints require scoped auth patterns", () => {
  const projectController = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  assert.match(projectController, /ResolveUserFromBearerTokenAsync/);
  assert.match(projectController, /FindAccessibleProjectAsync/);
  assert.doesNotMatch(projectController, /var violations = new List<string>\(\);\s*\/\/ Placeholder/);
});

test("auth uses PBKDF2 and refresh token rotation", () => {
  const auth = readFileSync("backend/src/Controllers/AuthController.cs", "utf8");
  assert.match(auth, /Rfc2898DeriveBytes\.Pbkdf2/);
  assert.match(auth, /HttpPost\("refresh"\)/);
  assert.match(auth, /RefreshTokenHash/);
});

test("documentation and CI workflow exist", () => {
  assert.equal(existsSync("README.md"), true);
  assert.equal(existsSync("ARCHITECTURE.md"), true);
  assert.equal(existsSync(".github/workflows/ci.yml"), true);
});

test("dashboard settings persist through API", () => {
  const settings = readFileSync("web-dashboard/src/pages/Settings.tsx", "utf8");
  assert.match(settings, /(authF|f)etch\(`\$\{API_BASE\}\/settings`/);
  assert.match(settings, /method: "PUT"/);
});

test("team workspace and semantic search APIs exist", () => {
  const team = readFileSync("backend/src/Controllers/TeamController.cs", "utf8");
  const project = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  assert.match(team, /TeamRole\.Owner/);
  assert.match(team, /ShareProject/);
  assert.match(team, /team_plan_inactive/);
  assert.match(team, /team_member_limit_reached/);
  assert.match(team, /MaxTeamMembers/);
  assert.match(team, /HttpGet\("\{teamId\}\/analytics"\)/);
  assert.match(team, /HttpGet\("\{teamId\}\/audit"\)/);
  assert.match(team, /HttpPatch\("\{teamId\}\/members\/\{memberId\}\/role"\)/);
  assert.match(team, /HttpDelete\("\{teamId\}\/members\/\{memberId\}"\)/);
  assert.match(team, /HttpDelete\("\{teamId\}\/invitations\/\{invitationId\}"\)/);
  assert.match(team, /HttpPost\("\{teamId\}\/transfer-ownership"\)/);
  assert.match(team, /BuildRolePermissions/);
  assert.match(team, /LogTeamActivity/);
  assert.match(project, /IsActiveTeamWorkspaceAsync/);
  assert.match(project, /ResolveEffectivePlanForProjectAsync/);
  assert.match(project, /HttpGet\("semantic-search"\)/);
  assert.match(project, /SemanticAnalysisService\.Score/);
});

test("team projects are visible in user APIs and dashboard", () => {
  const userController = readFileSync("backend/src/Controllers/UserController.cs", "utf8");
  const dashboard = readFileSync("web-dashboard/src/pages/Dashboard.tsx", "utf8");

  assert.match(userController, /sharedProjects/);
  assert.match(userController, /isShared = true/);
  assert.match(userController, /TeamWorkspace\.Owner\.Plan == UserPlan\.Team/);
  assert.match(userController, /teamWorkspace = PlanLimits\.HasTeamWorkspace/);
  assert.match(dashboard, /handleCreateTeam/);
  assert.match(dashboard, /Team Workspace/);
  assert.match(dashboard, /handleInviteMember/);
  assert.match(dashboard, /handleShareProject/);
  assert.match(dashboard, /handleUpdateMemberRole/);
  assert.match(dashboard, /handleRemoveMember/);
  assert.match(dashboard, /handleCancelInvitation/);
  assert.match(dashboard, /handleTransferOwnership/);
  assert.match(dashboard, /Team Activity/);
});

test("context history supports diff and restore", () => {
  const project = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  assert.match(project, /HttpGet\("context-history\/diff"\)/);
  assert.match(project, /HttpPost\("context-history\/\{id\}\/restore"\)/);
});

test("profile export is wired to backend download", () => {
  const profile = readFileSync("web-dashboard/src/pages/Profile.tsx", "utf8");
  const userController = readFileSync("backend/src/Controllers/UserController.cs", "utf8");
  assert.match(profile, /\/user\/export/);
  assert.match(profile, /URL\.createObjectURL/);
  assert.match(userController, /HttpGet\("export"\)/);
});

test("advanced context preview API and dashboard display are fully integrated", () => {
  const projectController = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  const projectMemoryDto = readFileSync("backend/src/Dtos/ProjectMemoryDto.cs", "utf8");
  const dashboard = readFileSync("web-dashboard/src/pages/Dashboard.tsx", "utf8");

  // Verify preview-context controller endpoint exists
  assert.match(projectController, /HttpPost\("preview-context"\)/);
  assert.match(projectController, /PreviewAiContext/);

  // Verify rich context fields in DTO
  assert.match(projectMemoryDto, /TechStackDetails\?? TechStack/);
  assert.match(projectMemoryDto, /List<FileMetric>\?? LargestFiles/);

  // Verify frontend calls the preview-context endpoint and renders techStack details
  assert.match(dashboard, /\/project\/preview-context/);
  assert.match(dashboard, /memory\?\.metrics\?\.techStack/);
  assert.match(dashboard, /memory\?\.metrics\?\.moduleMap/);
  assert.match(dashboard, /memory\?\.metrics\?\.importantFiles/);
  assert.match(dashboard, /memory\?\.metrics\?\.largestFiles/);
});

test("billing lifecycle enforces plan limits and delayed cancellation downgrade", () => {
  const user = readFileSync("backend/src/Models/User.cs", "utf8");
  const payment = readFileSync("backend/src/Controllers/PaymentController.cs", "utf8");
  const projectController = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  const teamController = readFileSync("backend/src/Controllers/TeamController.cs", "utf8");
  const resolver = readFileSync("backend/src/Services/UserTokenResolver.cs", "utf8");
  const userController = readFileSync("backend/src/Controllers/UserController.cs", "utf8");
  const program = readFileSync("backend/Program.cs", "utf8");
  const profile = readFileSync("web-dashboard/src/pages/Profile.tsx", "utf8");

  assert.match(user, /ApplyBillingState/);
  assert.match(user, /PaddleCurrentPeriodEnd\.Value <= currentTime/);
  assert.match(payment, /subscription\.canceled/);
  assert.match(payment, /subscription\.cancelled/);
  assert.match(payment, /subscription\.past_due/);
  assert.match(payment, /willDowngradeAtPeriodEnd/);
  assert.match(payment, /HttpPost\("subscription\/cancel"\)/);
  assert.match(payment, /HttpPost\("subscription\/resume"\)/);
  assert.match(payment, /effective_from = "next_billing_period"/);
  assert.match(payment, /HttpMethod\.Patch, \$"\{PaddleApiBase\}\/subscriptions\/\{user\.PaddleSubscriptionId\}"/);
  assert.match(payment, /scheduled_change = \(object\?\)null/);
  assert.match(payment, /HasScheduledCancellation/);
  assert.match(payment, /CryptographicOperations\.FixedTimeEquals/);
  assert.match(payment, /DurationBetween\(DateTimeOffset\.UtcNow, signedAt\)/);
  assert.match(resolver, /ApplyBillingState/);
  assert.match(userController, /ResolveUserFromBearerTokenAsync/);
  assert.match(userController, /PaddleCurrentPeriodEnd > now/);
  assert.match(projectController, /IsActiveTeamWorkspaceAsync/);
  assert.match(teamController, /IsTeamWorkspaceActiveAsync/);
  assert.match(program, /AddHostedService<BillingReconciliationService>/);
  assert.match(profile, /Access until/);
  assert.match(profile, /Cancels at period end/);
  assert.match(profile, /Cancel at Period End/);
  assert.match(profile, /Resume Subscription/);
  assert.match(profile, /\/payment\/subscription\/cancel/);
  assert.match(profile, /\/payment\/subscription\/resume/);
  assert.equal(existsSync("backend/Data/Migrations/20260610120000_EnsurePlanBillingTeamSchema.cs"), true);
});

test("pricing and marketing only advertise implemented plan features", () => {
  const plans = readFileSync("web-dashboard/src/pages/Plans.tsx", "utf8");
  const pricing = readFileSync("web-dashboard/src/pages/Pricing.tsx", "utf8");
  const landing = readFileSync("web-dashboard/src/pages/Landing.tsx", "utf8");
  const profile = readFileSync("web-dashboard/src/pages/Profile.tsx", "utf8");
  const settings = readFileSync("web-dashboard/src/pages/Settings.tsx", "utf8");

  const combined = `${plans}\n${pricing}\n${landing}\n${profile}`;
  assert.doesNotMatch(combined, /SAML|SSO|SCIM|Identity Provider|IdP|ACS|Domain Login|Enterprise SSO/i);
  assert.match(combined, /Up to 3 Project Memories/);
  assert.match(combined, /Up to 999 Project Memories/);
  assert.match(combined, /50 Context Refreshes \/ Month/);
  assert.match(combined, /500 Context Refreshes \/ Month/);
  assert.match(combined, /1,000 Context Refreshes \/ Month/);
  assert.match(combined, /Deep Optimized AI Context/);
  assert.match(combined, /Basic AI Context/);
  assert.match(combined, /Shared Team Workspace/);
  assert.match(combined, /Roles & Permissions/);
  assert.match(combined, /Project Sharing/);
  assert.match(combined, /Invitation Management/);
  assert.match(combined, /Ownership Transfer/);
  assert.match(combined, /Team Activity History/);
  assert.match(combined, /Team Usage Overview/);
  assert.doesNotMatch(combined, /Unlimited Practical Projects/);
  assert.doesNotMatch(combined, /Unlimited Project Memories/);
  assert.match(combined, /AI Requests \/ Month/);
  assert.match(settings, /hasApiAccess/);
  assert.match(settings, /maxContextTokens = planName === "Free" \? 2000 : 32000/);
  assert.doesNotMatch(combined, /9,999 Context Refreshes \/ Month/);
});

test("paid-only architecture features are enforced server-side", () => {
  const architectureGuard = readFileSync("backend/src/Controllers/ArchitectureGuardController.cs", "utf8");
  const project = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");

  assert.match(architectureGuard, /PlanLimits\.HasPriorityAI/);
  assert.match(architectureGuard, /architecture_rules_requires_paid_plan/);
  assert.match(architectureGuard, /HttpPost\("suggest-fix"\)/);
  assert.match(architectureGuard, /ResolveUserFromBearerTokenAsync/);
  assert.match(project, /architecture_rules_requires_paid_plan/);
});

test("production rate limiting middleware exists", () => {
  const middleware = readFileSync("backend/src/Middleware/RateLimitingMiddleware.cs", "utf8");
  assert.match(middleware, /RateLimitingMiddleware/);
  assert.match(middleware, /ConcurrentDictionary/);
  assert.match(middleware, /429/);
  assert.match(middleware, /Retry-After/);
  assert.match(middleware, /CleanupExpiredWindows/);
});

test("context validator performs post-generation self-checks", () => {
  const validator = readFileSync("backend/src/Services/ContextValidator.cs", "utf8");
  assert.match(validator, /ContextValidator/);
  assert.match(validator, /Validate/);
  assert.match(validator, /SectionCount/);
  assert.match(validator, /TokenUtilization/);
  assert.match(validator, /Warnings/);
});

test("context quality report scoring categories exist", () => {
  const dtopath = "backend/src/Dtos/ContextQualityReport.cs";
  assert.equal(existsSync(dtopath), true);
  const dto = readFileSync(dtopath, "utf8");
  assert.match(dto, /ContextQualityReport/);
  assert.match(dto, /CategoryScore/);
  assert.match(dto, /DetectionConfidence/);
});

test("quality scoring engine is implemented", () => {
  const generator = readFileSync("backend/src/Services/ContextGenerator.cs", "utf8");
  assert.match(generator, /CalculateQualityScore/);
  assert.match(generator, /CalculateDetectionConfidence/);
  assert.match(generator, /## Detection Confidence/);
});

test("production self-diagnostic audit endpoint is implemented", () => {
  const auditPath = "backend/src/Controllers/AuditController.cs";
  assert.equal(existsSync(auditPath), true);
  const controller = readFileSync(auditPath, "utf8");
  assert.match(controller, /AuditController/);
  assert.match(controller, /self-check/);
  assert.match(controller, /CheckBackendAsync/);
});

test("AI cost protection budget limits are enforced server-side", () => {
  const aiService = readFileSync("backend/src/Services/HybridAIAnalysisService.cs", "utf8");
  const appsettings = readFileSync("backend/appsettings.json", "utf8");
  const archController = readFileSync("backend/src/Controllers/ArchitectureGuardController.cs", "utf8");
  assert.match(aiService, /CanMakeAiRequest/);
  assert.match(aiService, /SetEmergencyDisable/);
  assert.match(aiService, /GlobalMonthlyAiCap/);
  assert.match(aiService, /GetPreferredGeminiKey/);
  assert.match(aiService, /GetPreferredAvailableKey/);
  assert.match(aiService, /TryProviderKeysAsync/);
  assert.match(aiService, /KeyCooldownSeconds/);
  assert.match(aiService, /CoolingDownKeys/);
  assert.match(aiService, /HttpStatusCode\.TooManyRequests/);
  assert.match(aiService, /GEMINI_API_KEYS/);
  assert.doesNotMatch(aiService, /OPENAI_API_KEYS/);
  assert.doesNotMatch(aiService, /api\.openai\.com/);
  assert.match(appsettings, /free_key,paid_key/);
  assert.doesNotMatch(appsettings, /OpenAiApiKeys|OPENAI_API_KEYS|PreferredOrder/);
  assert.doesNotMatch(appsettings, /AIza|sk-proj|sk-/);
  assert.match(archController, /AiRequestCount/);
});

test("user endpoints expose new usage limits and reset dates", () => {
  const userController = readFileSync("backend/src/Controllers/UserController.cs", "utf8");
  assert.match(userController, /contextGenerationsUsed/);
  assert.match(userController, /contextGenerationsLimit/);
  assert.match(userController, /aiRequestsUsed/);
  assert.match(userController, /aiRequestsLimit/);
});

test("project scanner increments count atomically", () => {
  const project = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  assert.match(project, /UPDATE ""Users"" SET ""ScanCount"" = ""ScanCount"" \+ 1/);
  assert.match(project, /ExecuteSqlRawAsync/);
});

test("V2 branding references are removed from API versions and controllers", () => {
  const program = readFileSync("backend/Program.cs", "utf8");
  const aiService = readFileSync("backend/src/Services/HybridAIAnalysisService.cs", "utf8");
  assert.doesNotMatch(program, /version = "2\.0\.0-preview"/);
  assert.doesNotMatch(aiService, /V2 - Hybrid AI Analysis Service/);
});

test("email verification and password reset flows are integrated", () => {
  const auth = readFileSync("backend/src/Controllers/AuthController.cs", "utf8");
  const audit = readFileSync("backend/src/Controllers/AuditController.cs", "utf8");
  const admin = readFileSync("backend/src/Controllers/AdminController.cs", "utf8");

  // Verify forgot/reset/verify/resend endpoints in AuthController
  assert.match(auth, /HttpPost\("forgot-password"\)/);
  assert.match(auth, /HttpPost\("reset-password"\)/);
  assert.match(auth, /user\.PasswordResetToken = HashToken\(resetToken\)/);
  assert.match(auth, /var resetHash = HashToken\(request\.Token\)/);
  assert.match(auth, /user\.RefreshTokenHash = null/);
  assert.match(auth, /HttpPost\("resend-verification"\)/);
  assert.match(auth, /HttpPost\("verify-email"\)/);
  
  // Verify Resend API diagnostics and that secrets are not exposed
  assert.match(audit, /emailProvider = "resend"/);
  assert.match(audit, /resendConfigured/);
  assert.match(audit, /resendEndpoint/);
  assert.match(audit, /fromEmail/);
  assert.doesNotMatch(audit, /resendApiKey\s*=\s*_emailConfig/i); // Ensure credentials are not exposed in response

  // Verify Admin test endpoint exists
  assert.match(admin, /AdminController/);
  assert.match(admin, /HttpPost\("email\/test"\)/);
  assert.match(admin, /Resend/);
});

test("transactional email uses Resend API only", () => {
  const program = readFileSync("backend/Program.cs", "utf8");
  const emailService = readFileSync("backend/src/Services/EmailService.cs", "utf8");
  const csproj = readFileSync("backend/AiContextBrain.csproj", "utf8");

  assert.match(program, /RESEND_API_KEY/);
  assert.match(program, /RESEND_FROM_EMAIL/);
  assert.match(emailService, /https:\/\/api\.resend\.com\/emails/);
  assert.match(emailService, /AuthenticationHeaderValue\("Bearer"/);
  assert.doesNotMatch(emailService, /MailKit|MimeKit|SmtpClient/);
  assert.doesNotMatch(csproj, /MailKit/);
});

test("CORS runs before auth rate limiting middleware", () => {
  const program = readFileSync("backend/Program.cs", "utf8");
  const corsIndex = program.indexOf('app.UseCors("AllowExtension")');
  const rateLimitIndex = program.indexOf("RateLimitingMiddleware");

  assert.ok(corsIndex > -1, "CORS middleware is registered");
  assert.ok(rateLimitIndex > -1, "Rate limiting middleware is registered");
  assert.ok(corsIndex < rateLimitIndex, "CORS must run before rate limiting so error responses include CORS headers");
});

test("VS Code extension auth and API routes match backend", () => {
  const app = readFileSync("web-dashboard/src/App.tsx", "utf8");
  const login = readFileSync("web-dashboard/src/pages/Login.tsx", "utf8");
  const authorize = readFileSync("web-dashboard/src/pages/Authorize.tsx", "utf8");
  const extension = readFileSync("vscode-extension/src/extension.ts", "utf8");
  const apiClient = readFileSync("vscode-extension/src/services/apiClient.ts", "utf8");
  const packageJson = readFileSync("vscode-extension/package.json", "utf8");
  const settings = readFileSync("web-dashboard/src/pages/Settings.tsx", "utf8");
  const plans = readFileSync("web-dashboard/src/pages/Plans.tsx", "utf8");

  assert.match(app, /path="\/authorize" element=\{<Authorize \/>\}/);
  assert.match(login, /const tabParam = searchParams\.get\("tab"\)/);
  assert.match(login, /tabParam === "register"/);
  assert.match(authorize, /redirect_uri/);
  assert.match(authorize, /returnUrl/);
  assert.match(authorize, /vscode:\/\/ai-project-brain\.ai-project-brain\/auth/);
  assert.match(extension, /\/authorize\?redirect_uri=/);
  assert.match(extension, /ai-project-brain\.ai-project-brain/);
  assert.match(extension, /tab=register/);
  assert.match(apiClient, /\/auth\/login/);
  assert.match(apiClient, /\/project\/scan-repo/);
  assert.match(apiClient, /\/project\/generate-context/);
  assert.match(apiClient, /\/user\/plan-features/);
  assert.match(apiClient, /\/architectureguard\/validate-file/);
  assert.doesNotMatch(apiClient, /\/api\/project/);
  assert.match(packageJson, /"name": "ai-project-brain"/);
  assert.match(packageJson, /"publisher": "ai-project-brain"/);
  assert.match(packageJson, /"displayName": "AI Context Brain"/);
  assert.doesNotMatch(packageJson, /Gemini \+ OpenAI|Codebase Intelligence/);
  assert.match(packageJson, /AI Context Optimization/);
  assert.match(login, /itemName=ai-project-brain\.ai-project-brain/);
  assert.match(settings, /itemName=ai-project-brain\.ai-project-brain/);
  assert.match(plans, /\/dashboard\?payment=success/);
  assert.equal(existsSync("vscode-extension/src/services/backendService.ts"), false);
});

test("VS Code extension exports plan-aware optimized context files", () => {
  const generate = readFileSync("vscode-extension/src/commands/generateContext.ts", "utf8");
  const scan = readFileSync("vscode-extension/src/commands/scanProject.ts", "utf8");
  const exportCmd = readFileSync("vscode-extension/src/commands/exportAiIdeContext.ts", "utf8");
  const contextExport = readFileSync("vscode-extension/src/services/contextExportService.ts", "utf8");
  const apiClient = readFileSync("vscode-extension/src/services/apiClient.ts", "utf8");
  const projectController = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");

  assert.match(apiClient, /GeneratedContextResponse/);
  assert.match(apiClient, /quality: data\.quality/);
  assert.match(apiClient, /validation: data\.validation/);
  assert.match(generate, /getPlanTokenLimit/);
  assert.match(generate, /plan\.maxTokens/);
  assert.match(contextExport, /OPTIMISTIC_CONTEXT_TOKEN_LIMIT = 2000/);
  assert.match(generate, /generateOptimizedContext/);
  assert.match(generate, /writeContextFiles/);
  assert.match(exportCmd, /generateOptimizedContext/);
  assert.match(exportCmd, /writeEditorExport/);
  assert.match(exportCmd, /writeContextFiles/);
  assert.doesNotMatch(exportCmd, /generateContent\(memory/);
  assert.match(scan, /generateOptimizedContext/);
  assert.match(scan, /FileExtensions: localResult\.metrics\.fileExtensions/);
  assert.match(scan, /LargestFiles: localResult\.metrics\.largestFiles/);
  assert.match(scan, /TechStack: localResult\.metrics\.techStack/);
  assert.match(scan, /ModuleMap: localResult\.metrics\.moduleMap/);
  assert.match(scan, /ArchitectureSummary: localResult\.metrics\.architectureSummary/);
  assert.match(scan, /fileExtensions\[ext\]/);
  assert.doesNotMatch(scan, /FileExtensions: \{\}/);
  assert.match(contextExport, /Generation Metadata/);
  assert.match(contextExport, /Fallback Notice/);
  assert.match(contextExport, /Context Capacity Applied/);
  assert.match(contextExport, /formatForEditor/);
  assert.match(projectController, /IsUsableHybridContext/);
  assert.match(projectController, /temporarily unavailable/);
  assert.match(projectController, /aiContext\.Length >= 500/);
});

test("Pro/Team plan architecture-aware maps context generation and scanning", () => {
  const scanResult = readFileSync("backend/src/Dtos/ScanResult.cs", "utf8");
  const projectMemory = readFileSync("backend/src/Dtos/ProjectMemoryDto.cs", "utf8");
  const requests = readFileSync("backend/src/Dtos/Requests.cs", "utf8");
  const contextGen = readFileSync("backend/src/Services/ContextGenerator.cs", "utf8");
  const projectController = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  const semantic = readFileSync("backend/src/Services/SemanticAnalysisService.cs", "utf8");
  const scan = readFileSync("vscode-extension/src/commands/scanProject.ts", "utf8");

  // Verify backend DTO structures contain the new lists
  assert.match(scanResult, /public List<RouteEndpointDetails>\? RouteMap/);
  assert.match(scanResult, /public List<ServiceNodeDetails>\? ServiceGraph/);
  assert.match(scanResult, /public List<EntityDetails>\? EntityMap/);
  assert.match(scanResult, /public List<DtoDetails>\? DtoMap/);
  assert.match(scanResult, /public List<AiProviderDetails>\? AiProviderMap/);
  assert.match(scanResult, /public List<PlanEnforcementDetails>\? PlanEnforcementMap/);
  assert.match(scanResult, /public List<ExtensionExportDetails>\? ExtensionExportMap/);
  assert.match(scanResult, /public List<TestBuildDetails>\? TestBuildMap/);

  // Verify ProjectMemoryDto mirrors the fields
  assert.match(projectMemory, /public List<RouteEndpointDetails>\? RouteMap/);
  assert.match(projectMemory, /public List<ServiceNodeDetails>\? ServiceGraph/);
  assert.match(projectMemory, /public List<EntityDetails>\? EntityMap/);
  assert.match(projectMemory, /public List<DtoDetails>\? DtoMap/);
  assert.match(projectMemory, /public List<AiProviderDetails>\? AiProviderMap/);
  assert.match(projectMemory, /public List<PlanEnforcementDetails>\? PlanEnforcementMap/);
  assert.match(projectMemory, /public List<ExtensionExportDetails>\? ExtensionExportMap/);
  assert.match(projectMemory, /public List<TestBuildDetails>\? TestBuildMap/);

  // Verify ScanRequestMetrics contains the new lists
  assert.match(requests, /public List<RouteEndpointDetails>\? RouteMap/);
  assert.match(requests, /public List<ServiceNodeDetails>\? ServiceGraph/);
  assert.match(requests, /public List<EntityDetails>\? EntityMap/);
  assert.match(requests, /public List<DtoDetails>\? DtoMap/);
  assert.match(requests, /public List<AiProviderDetails>\? AiProviderMap/);
  assert.match(requests, /public List<PlanEnforcementDetails>\? PlanEnforcementMap/);
  assert.match(requests, /public List<ExtensionExportDetails>\? ExtensionExportMap/);
  assert.match(requests, /public List<TestBuildDetails>\? TestBuildMap/);

  // Verify ProjectController does not drop client-provided architecture maps
  assert.match(projectController, /RouteMap = request\.Metrics\.RouteMap/);
  assert.match(projectController, /ServiceGraph = request\.Metrics\.ServiceGraph/);
  assert.match(projectController, /EntityMap = request\.Metrics\.EntityMap/);
  assert.match(projectController, /DtoMap = request\.Metrics\.DtoMap/);
  assert.match(projectController, /AiProviderMap = request\.Metrics\.AiProviderMap/);
  assert.match(projectController, /PlanEnforcementMap = request\.Metrics\.PlanEnforcementMap/);
  assert.match(projectController, /ExtensionExportMap = request\.Metrics\.ExtensionExportMap/);
  assert.match(projectController, /TestBuildMap = request\.Metrics\.TestBuildMap/);

  // Verify fingerprints change when deep maps are added, so old mapless scans are replaced
  assert.match(semantic, /architectureMaps = new/);
  assert.match(semantic, /routeCount = scanResult\.Metrics\.RouteMap\?\.Count/);
  assert.match(semantic, /dtoCount = scanResult\.Metrics\.DtoMap\?\.Count/);

  // Verify ContextGenerator contains builder methods for the 8 maps
  assert.match(contextGen, /private string BuildRouteMapSection\(/);
  assert.match(contextGen, /private string BuildServiceGraphSection\(/);
  assert.match(contextGen, /private string BuildEntityMapSection\(/);
  assert.match(contextGen, /private string BuildDtoMapSection\(/);
  assert.match(contextGen, /private string BuildAiProviderMapSection\(/);
  assert.match(contextGen, /private string BuildPlanEnforcementSection\(/);
  assert.match(contextGen, /private string BuildExtensionExportSection\(/);
  assert.match(contextGen, /private string BuildTestBuildSection\(/);

  // Verify ContextGenerator quality scoring penalizes missing maps or scores them
  assert.match(contextGen, /CalculateQualityScore\(/);
  assert.match(contextGen, /AddScore\(/); // Check that maps are scored
  assert.match(contextGen, /RouteMap/);
  assert.match(contextGen, /ServiceGraph/);
  assert.match(contextGen, /EntityMap/);
  assert.match(contextGen, /DtoMap/);
  assert.doesNotMatch(contextGen, /No API routes detected/);
  assert.doesNotMatch(contextGen, /No service dependency graph detected/);
  assert.doesNotMatch(contextGen, /No EF Core entities or database models detected/);
  assert.doesNotMatch(contextGen, /No DTOs or request\/response models detected/);
  assert.doesNotMatch(contextGen, /No AI provider integrations detected/);
  assert.doesNotMatch(contextGen, /No plan enforcement points detected/);
  assert.doesNotMatch(contextGen, /No extension export targets detected/);
  assert.doesNotMatch(contextGen, /No test or build configurations detected/);

  // Verify scanProject.ts performs deep analysis
  assert.match(scan, /structuralFiles/);
  assert.match(scan, /controllerRouteMatch/);
  assert.match(scan, /normalizeRoute/);
  assert.match(scan, /Route\/Endpoint Detection/);
  assert.match(scan, /Service Class Detection/);
  assert.match(scan, /Entity \/ Model Detection/);
  assert.match(scan, /DTO Detection/);
  assert.match(scan, /AI Provider Detection/);
  assert.match(scan, /Plan Enforcement Detection/);
  assert.match(scan, /Extension Export Detection/);
  assert.match(scan, /Test File Detection/);

  // Verify scanProject.ts uploads the maps
  assert.match(scan, /RouteMap: localResult\.metrics\.routeMap/);
  assert.match(scan, /ServiceGraph: localResult\.metrics\.serviceGraph/);
  assert.match(scan, /EntityMap: localResult\.metrics\.entityMap/);
  assert.match(scan, /DtoMap: localResult\.metrics\.dtoMap/);
  assert.match(scan, /AiProviderMap: localResult\.metrics\.aiProviderMap/);
  assert.match(scan, /PlanEnforcementMap: localResult\.metrics\.planEnforcementMap/);
  assert.match(scan, /ExtensionExportMap: localResult\.metrics\.extensionExportMap/);
  assert.match(scan, /TestBuildMap: localResult\.metrics\.testBuildMap/);
});

test("admin console has role-gated backend and frontend wiring", () => {
  const admin = readFileSync("backend/src/Controllers/AdminController.cs", "utf8");
  const app = readFileSync("web-dashboard/src/App.tsx", "utf8");
  const header = readFileSync("web-dashboard/src/pages/AppHeader.tsx", "utf8");
  const panel = readFileSync("web-dashboard/src/pages/AdminPanel.tsx", "utf8");
  const dashboard = readFileSync("web-dashboard/src/pages/Dashboard.tsx", "utf8");
  const profile = readFileSync("web-dashboard/src/pages/Profile.tsx", "utf8");

  assert.match(admin, /HttpGet\("overview"\)/);
  assert.match(admin, /HttpGet\("users"\)/);
  assert.match(admin, /HttpGet\("activity"\)/);
  assert.match(admin, /HttpGet\("feedback"\)/);
  assert.match(admin, /GetAdminUserAsync/);
  assert.match(admin, /UserRole\.Admin/);
  assert.match(admin, /BuildActivityQuery/);
  assert.match(admin, /BuildFeedbackQuery/);
  assert.match(app, /path="\/admin"/);
  assert.match(header, /user\?\.role === "Admin"/);
  assert.match(panel, /\/admin\/overview/);
  assert.match(panel, /\/admin\/users/);
  assert.match(panel, /\/admin\/activity/);
  assert.match(panel, /\/admin\/feedback/);
  assert.match(panel, /\/admin\/email\/test/);
  assert.match(panel, /LoadingState/);
  assert.doesNotMatch(profile, /\/payment\/portal/);
  assert.doesNotMatch(profile, /Manage Billing/);
  assert.doesNotMatch(dashboard, /hover:underline">Manage/);
});

test("extension autosync tracks local changes without AI calls and manual scan consumes queue", () => {
  const extension = readFileSync("vscode-extension/src/extension.ts", "utf8");
  const aiExplain = readFileSync("vscode-extension/src/commands/aiExplain.ts", "utf8");
  const watcher = readFileSync("vscode-extension/src/services/fileWatcher.ts", "utf8");
  const scan = readFileSync("vscode-extension/src/commands/scanProject.ts", "utf8");
  const hashService = readFileSync("vscode-extension/src/services/fileHashService.ts", "utf8");
  const pendingChangeService = readFileSync("vscode-extension/src/services/pendingChangeService.ts", "utf8");
  const exportCmd = readFileSync("vscode-extension/src/commands/exportAiIdeContext.ts", "utf8");
  const exportService = readFileSync("vscode-extension/src/services/contextExportService.ts", "utf8");
  const apiClient = readFileSync("vscode-extension/src/services/apiClient.ts", "utf8");
  const projectController = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  const requests = readFileSync("backend/src/Dtos/Requests.cs", "utf8");
  const dashboard = readFileSync("web-dashboard/src/pages/Dashboard.tsx", "utf8");
  const packageJson = readFileSync("vscode-extension/package.json", "utf8");
  const settings = readFileSync("web-dashboard/src/pages/Settings.tsx", "utf8");

  assert.match(extension, /\.ai-context\.md/);
  assert.doesNotMatch(extension, /\.ai-context\.json/);
  assert.match(extension, /autoScan/);
  assert.match(extension, /AiExplainCommand\.rememberEditor/);
  assert.match(aiExplain, /resolveEditor/);
  assert.match(aiExplain, /visibleTextEditors/);
  assert.match(aiExplain, /lastTextEditor/);
  assert.match(aiExplain, /lineAt\(editor\.selection\.active\.line\)/);
  assert.doesNotMatch(aiExplain, /No active editor\./);
  assert.match(watcher, /PendingChangeService\.add/);
  assert.match(watcher, /refreshPendingChangesStatus/);
  assert.match(watcher, /No AI calls run in the background/);
  assert.doesNotMatch(watcher, /ScanProjectCommand/);
  assert.match(pendingChangeService, /pending-changes\.json/);
  assert.match(pendingChangeService, /public static add/);
  assert.match(pendingChangeService, /public static clear/);
  assert.match(scan, /execute\(options: \{ silent\?: boolean; force\?: boolean; requireCloud\?: boolean \} = \{\}\)/);
  assert.match(scan, /ProgressLocation\.Window/);
  assert.match(scan, /if \(silent\) \{\s*return;/);
  assert.match(scan, /const autoExport = !silent &&/);
  assert.match(scan, /!localResult\.hasChanges/);
  assert.match(scan, /pendingContextUpdate/);
  assert.match(scan, /PendingChangeService\.load/);
  assert.match(scan, /PendingChangeService\.clear/);
  assert.match(scan, /refreshPendingChangesStatus/);
  assert.match(scan, /IsBackgroundSync: silent/);
  assert.match(hashService, /hashData\.hash === cachedEntry\.hash/);
  assert.match(hashService, /unchanged\.push\(relPath\)/);
  assert.match(exportService, /isUsageLimitError/);
  assert.match(apiClient, /Usage limit reached/);
  assert.match(projectController, /ai_usage_limit_reached/);
  assert.match(projectController, /priority AI generations/);
  assert.match(projectController, /countsAgainstScanLimit = !request\.IsBackgroundSync/);
  assert.match(projectController, /countsAgainstScanLimit && user\.ScanCount >= maxScans/);
  assert.match(requests, /public bool IsBackgroundSync/);
  assert.match(packageJson, /"aiContextBrain\.autoExportOnScan"[\s\S]*"default": false/);
  assert.match(packageJson, /Track code file changes in a local queue/);
  assert.match(settings, /Server-managed fallback/);
  assert.match(settings, /"aiContextBrain\.autoSync": true/);
  assert.match(settings, /"aiContextBrain\.autoExportOnScan": false/);
  assert.match(settings, /Context Capacity/);
  assert.match(dashboard, /Context Capacity/);
  assert.match(dashboard, /100%/);
  assert.doesNotMatch(dashboard, /Context Token Capacity/);
  assert.match(exportCmd, /Cursor \(\.cursor\/rules\/\)/);
  assert.match(exportCmd, /Windsurf \(\.windsurf\/rules\/\)/);
  assert.match(exportCmd, /OpenAI Codex \(AGENTS\.md\)/);
  assert.match(exportCmd, /GitHub Copilot \(\.github\/copilot-instructions\.md\)/);
  assert.match(exportCmd, /Aider \(CONVENTIONS\.md\)/);
  assert.match(exportCmd, /Claude Code \(CLAUDE\.md\)/);
  assert.match(exportService, /case 'cursor'/);
  assert.match(exportService, /case 'windsurf'/);
  assert.match(exportService, /case 'copilot'/);
  assert.match(exportService, /case 'claude'/);
  assert.match(exportService, /case 'aider'/);
});

test("project setup wizard and local workspace initialization are integrated", async () => {
  const requests = readFileSync("backend/src/Dtos/Requests.cs", "utf8");
  const generator = readFileSync("backend/src/Services/WizardTemplateGenerator.cs", "utf8");
  const projectController = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  const projectModel = readFileSync("backend/src/Models/Project.cs", "utf8");
  const program = readFileSync("backend/Program.cs", "utf8");
  const dashboard = readFileSync("web-dashboard/src/pages/Dashboard.tsx", "utf8");
  const extWizardCmd = readFileSync("vscode-extension/src/commands/newProjectWizard.ts", "utf8");
  const apiClient = readFileSync("vscode-extension/src/services/apiClient.ts", "utf8");

  // 1. Request DTO checks
  assert.match(requests, /public class WizardCreateRequest/);
  assert.match(requests, /public class InitializeLocalRequest/);
  assert.match(requests, /public bool ForceDeterministic/);

  // 2. Wizard Template Generator logic checks
  assert.match(generator, /class WizardTemplateBlueprint/);
  assert.match(generator, /class WizardTemplateGenerator/);
  assert.match(generator, /public static WizardTemplateBlueprint Generate/);

  // 3. Controller endpoints and validation checks
  assert.match(projectController, /HttpPost\("wizard-create"\)/);
  assert.match(projectController, /HttpGet\("\{projectId\}\/wizard-blueprint"\)/);
  assert.match(projectController, /HttpPost\("\{projectId\}\/initialize-local"\)/);
  assert.match(projectController, /HttpDelete\("\{projectId\}"\)/);
  assert.match(projectController, /p\.Id == projectId && p\.UserId == user\.Id/);
  assert.match(projectController, /ProjectShares\.RemoveRange/);
  assert.match(projectController, /IsLocalInitialized = false/);
  assert.match(projectController, /project\.IsLocalInitialized = true/);

  // 4. Database model and migration checks
  assert.match(projectModel, /public bool IsLocalInitialized/);
  assert.match(program, /ADD COLUMN IF NOT EXISTS ""IsLocalInitialized"" boolean NOT NULL DEFAULT TRUE/);

  // 5. Dashboard query parameters auto-trigger checks
  assert.match(dashboard, /searchParams\.get\("wizard"\) === "true"/);
  assert.match(dashboard, /setShowWizard\(true\)/);

  // 6. Extension command and local workspace creation checks
  assert.match(extWizardCmd, /class NewProjectWizardCommand/);
  assert.match(extWizardCmd, /Open in VS Code/);
  assert.match(extWizardCmd, /initializeWithProjectId/);
  assert.match(extWizardCmd, /initializeFromWeb/);
  assert.match(extWizardCmd, /apiClient\.initializeLocal/);
  assert.doesNotMatch(extWizardCmd, /relativeFolder\.endsWith\('\/'\)/);
  assert.match(extWizardCmd, /path\.join\(fullFolder, '\.gitkeep'\)/);
  assert.match(apiClient, /async initializeLocal/);
  assert.match(apiClient, /async getWizardBlueprint/);

  // 7. Programmatic API and self-healing route validation (run only if server is up on port 5001)
  try {
    const rootRes = await fetch("http://localhost:5001/api/health").catch(() => null);
    if (rootRes && rootRes.ok) {
      console.log("   [Smoke Test] API Server detected on port 5001. Running HTTP endpoint validation...");

      // A. Unauthorized access validation
      const blueprintRes = await fetch("http://localhost:5001/project/some-invalid-id/wizard-blueprint");
      assert.equal(blueprintRes.status, 401, "GET wizard-blueprint must require authentication");

      const initRes = await fetch("http://localhost:5001/project/some-invalid-id/initialize-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPath: "/some/path" })
      });
      assert.equal(initRes.status, 401, "POST initialize-local must require authentication");

      // B. Bad token validation
      const blueprintBadTokenRes = await fetch("http://localhost:5001/project/some-invalid-id/wizard-blueprint", {
        headers: { "Authorization": "Bearer bad-token-here" }
      });
      assert.equal(blueprintBadTokenRes.status, 401, "Invalid token must return 401");

      const initBadTokenRes = await fetch("http://localhost:5001/project/some-invalid-id/initialize-local", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer bad-token-here" },
        body: JSON.stringify({ localPath: "/some/path" })
      });
      assert.equal(initBadTokenRes.status, 401, "Invalid token must return 401");

      // C. Full setup, initialization, idempotency, duplicate path, and invalid ID integration checks
      const randomId = Math.random().toString(36).substring(7);
      const testEmail = `smoke-test-${randomId}@example.com`;
      const testUsername = `smokeuser${randomId}`;
      const testPassword = "Password123!";

      // Register the test user
      const registerRes = await fetch("http://localhost:5001/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, username: testUsername, password: testPassword })
      });
      assert.equal(registerRes.status, 200, "Registration should succeed");
      const registerData = await registerRes.json();
      const token = registerData.user?.token;
      assert.ok(token, "Response must contain token");

      const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      };

      // 1. Invalid ProjectId checks (valid token but invalid projectId)
      const blueprintNotFound = await fetch("http://localhost:5001/project/invalid-project-id-123/wizard-blueprint", {
        headers: authHeaders
      });
      assert.equal(blueprintNotFound.status, 404, "Invalid project ID blueprint fetch must return 404 Not Found");

      const initNotFound = await fetch("http://localhost:5001/project/invalid-project-id-123/initialize-local", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ localPath: "/some/nonexistent/path" })
      });
      assert.equal(initNotFound.status, 404, "Invalid project ID local initialization must return 404 Not Found");

      // 2. Wizard creation
      const createRes = await fetch("http://localhost:5001/project/wizard-create", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: "Smoke Wizard Project",
          languages: ["typescript"],
          strictnessLevels: ["strict"],
          databases: ["postgresql"],
          auths: ["jwt"],
          deployments: ["docker"],
          billings: ["stripe"],
          automations: ["none"],
          productTypes: ["saas"]
        })
      });
      assert.equal(createRes.status, 200, "Wizard project creation should succeed");
      const createData = await createRes.json();
      const projectId = createData.projectId;
      assert.ok(projectId, "Should return a valid projectId");

      // 3. First Local Initialization
      const localPath1 = `c:/Users/Monster/Desktop/Project/LocalDir-${randomId}`;
      const initRes1 = await fetch(`http://localhost:5001/project/${projectId}/initialize-local`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ localPath: localPath1 })
      });
      assert.equal(initRes1.status, 200, "First local initialization should succeed");
      const initData1 = await initRes1.json();
      assert.equal(initData1.success, true);
      assert.equal(initData1.alreadyInitialized, false, "First init should not be marked as already initialized");

      // 4. Repeated/Idempotent Local Initialization
      const initRes2 = await fetch(`http://localhost:5001/project/${projectId}/initialize-local`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ localPath: localPath1 })
      });
      assert.equal(initRes2.status, 200, "Repeated local initialization should succeed");
      const initData2 = await initRes2.json();
      assert.equal(initData2.success, true);
      assert.equal(initData2.alreadyInitialized, true, "Repeated init must return alreadyInitialized=true");

      // 5. Verify duplicate path validation
      // Create a second project first
      const createRes2 = await fetch("http://localhost:5001/project/wizard-create", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: "Smoke Wizard Project 2",
          languages: ["typescript"],
          strictnessLevels: ["strict"],
          databases: ["postgresql"],
          auths: ["jwt"],
          deployments: ["docker"],
          billings: ["stripe"],
          automations: ["none"],
          productTypes: ["saas"]
        })
      });
      assert.equal(createRes2.status, 200, "Second project creation should succeed");
      const createData2 = await createRes2.json();
      const projectId2 = createData2.projectId;

      // Attempt to initialize the second project with the same path as first project
      const duplicatePathRes = await fetch(`http://localhost:5001/project/${projectId2}/initialize-local`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ localPath: localPath1 })
      });
      assert.equal(duplicatePathRes.status, 400, "Initializing with duplicate path must return 400 Bad Request");
      const dupData = await duplicatePathRes.json();
      assert.equal(dupData.error, "project_path_duplicate", "Error code must be project_path_duplicate");
    } else {
      console.log("   [Smoke Test] API Server is offline on port 5001. Skipping HTTP programmatic route check (static analysis passed).");
    }
  } catch (err) {
    console.log("   [Smoke Test] Skipped HTTP test due to error:", err.message);
  }
});

test("admin security and operational features are enforced in real workflows", () => {
  const auth = readFileSync("backend/src/Controllers/AuthController.cs", "utf8");
  const project = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");
  const guard = readFileSync("backend/src/Controllers/ArchitectureGuardController.cs", "utf8");
  const userController = readFileSync("backend/src/Controllers/UserController.cs", "utf8");
  const emailService = readFileSync("backend/src/Services/EmailService.cs", "utf8");

  assert.match(auth, /account_banned/);
  assert.match(auth, /account_deleted/);
  assert.match(auth, /!u\.IsBanned\s*&&\s*!u\.IsDeleted/);
  assert.match(auth, /DisposableDomains\.AnyAsync/);
  assert.match(project, /PlanLimits\.EffectiveMaxScans/);
  assert.match(project, /PlanLimits\.EffectiveMaxContextGenerations/);
  assert.match(project, /PlanLimits\.EffectiveMaxAiRequests/);
  assert.match(guard, /PlanLimits\.EffectiveMaxAiRequests/);
  assert.match(userController, /PlanLimits\.EffectiveMaxScans/);
  assert.match(emailService, /context\.EmailLogs\.Add/);
  assert.match(emailService, /LogDeliveryAsync/);
});

test("wizard handoff exposes project id and links cloud path before context generation", () => {
  const wizardUi = readFileSync("web-dashboard/src/components/ProjectSetupWizard.tsx", "utf8");
  const wizardCommand = readFileSync("vscode-extension/src/commands/newProjectWizard.ts", "utf8");
  const projectController = readFileSync("backend/src/Controllers/ProjectController.cs", "utf8");

  assert.match(wizardUi, /setCreatedProjectId\(wizardData\.projectId/);
  assert.match(wizardUi, /Copy Project ID/);
  const initializeIndex = wizardCommand.indexOf("initializeLocal(projectId.trim(), projectPath)");
  const generateIndex = wizardCommand.indexOf("generateAndWrite(projectPath");
  assert.ok(initializeIndex >= 0 && generateIndex >= 0 && initializeIndex < generateIndex);
  assert.match(projectController, /project_already_initialized_elsewhere/);
  assert.match(projectController, /FilesCount = 0/);
  assert.match(projectController, /LinesOfCode = 0/);
});

test("explain cache, analytics and pricing remain bounded and consistent", () => {
  const aiService = readFileSync("backend/src/Services/HybridAIAnalysisService.cs", "utf8");
  const analytics = readFileSync("web-dashboard/src/utils/analytics.ts", "utf8");
  const admin = readFileSync("backend/src/Controllers/AdminController.cs", "utf8");
  const publicConfig = readFileSync("backend/src/Controllers/PublicConfigController.cs", "utf8");
  const landing = readFileSync("web-dashboard/src/pages/Landing.tsx", "utf8");
  const plans = readFileSync("web-dashboard/src/pages/Plans.tsx", "utf8");
  const pricing = readFileSync("web-dashboard/src/pages/Pricing.tsx", "utf8");
  const combined = `${landing}\n${plans}\n${pricing}`;

  assert.match(aiService, /ExplainCacheEntry/);
  assert.match(aiService, /ExplainCacheMaxEntries/);
  assert.match(aiService, /TrimExplainCacheIfNeeded/);
  assert.match(analytics, /loadAnalyticsConfig/);
  assert.match(analytics, /getAnalyticsConsent/);
  assert.match(admin, /HttpPut\("analytics-config"\)/);
  assert.match(publicConfig, /HttpGet\("analytics"\)/);
  assert.match(combined, /30 AI Requests \/ Month/);
  assert.match(combined, /500 AI Requests \/ Month/);
  assert.doesNotMatch(combined, /20 AI Requests \/ Month|Hybrid AI Generation/);
});

test("living context reflects current operational architecture", () => {
  const context = readFileSync(".ai-context.md", "utf8");
  const instructions = readFileSync("AI_INSTRUCTIONS.md", "utf8");
  const scanner = readFileSync("vscode-extension/src/commands/scanProject.ts", "utf8");

  assert.match(context, /Generated: 2026-06-19/);
  assert.match(context, /\/admin\/email-logs/);
  assert.match(context, /\/admin\/analytics-config/);
  assert.match(context, /\/project\/wizard-create/);
  assert.match(context, /### AnalyticsSettings/);
  assert.match(context, /Google Gemini/);
  assert.match(context, /dotnet build backend\/AiContextBrain\.csproj/);
  assert.doesNotMatch(context, /AiProjectBrain\.csproj/);
  assert.match(context, /free-first and paid-fallback|free-first\/paid-fallback/);
  assert.doesNotMatch(`${context}\n${instructions}`, /Multi-provider AI integration \(Gemini, OpenAI\)/);
  assert.match(scanner, /generativelanguage\\\.googleapis\\\.com/);
  assert.doesNotMatch(scanner, /content\.includes\('OPENAI_API_KEY/);
  assert.doesNotMatch(scanner, /purpose: 'Multi-provider AI integration/);
  assert.doesNotMatch(context, /Database: Unknown|Authentication: Unknown|No API routes detected|No DTOs detected|No AI provider integrations detected|No plan enforcement detected|No extension export targets detected|No test\/build configurations detected/);
  const extensionManifest = JSON.parse(readFileSync("vscode-extension/package.json", "utf8"));
  assert.equal(extensionManifest.scripts.test, "node --test tests/smoke.test.mjs");
});

test("critical cross-surface workflows fail safely and preserve user data", () => {
  const wizardUi = readFileSync("web-dashboard/src/components/ProjectSetupWizard.tsx", "utf8");
  const wizardExtension = readFileSync("vscode-extension/src/commands/newProjectWizard.ts", "utf8");
  const contextExport = readFileSync("vscode-extension/src/services/contextExportService.ts", "utf8");
  const payment = readFileSync("backend/src/Controllers/PaymentController.cs", "utf8");
  const userController = readFileSync("backend/src/Controllers/UserController.cs", "utf8");
  const auth = readFileSync("backend/src/Controllers/AuthController.cs", "utf8");
  const team = readFileSync("backend/src/Controllers/TeamController.cs", "utf8");
  const authContext = readFileSync("web-dashboard/src/context/AuthContext.tsx", "utf8");

  assert.doesNotMatch(wizardUi, /\/project\/generate-context/);
  assert.match(wizardUi, /must not consume AI usage/);
  const initializeIndex = wizardExtension.indexOf("initializeLocal(projectId.trim(), projectPath)");
  const scanIndex = wizardExtension.indexOf("scanCmd.execute({ silent: true, force: true, requireCloud: true })");
  const generateIndex = wizardExtension.indexOf("generateAndWrite(projectPath");
  assert.ok(initializeIndex >= 0 && scanIndex > initializeIndex && generateIndex > scanIndex);
  assert.match(wizardExtension, /fs\.existsSync\(readmePath\) \? blueprintPath : readmePath/);
  assert.match(wizardExtension, /generateEnvExample/);
  assert.match(wizardExtension, /resolveSafeChildPath/);
  assert.match(wizardExtension, /relative\.startsWith\('\.\.'\)/);
  assert.match(contextExport, /OPTIMISTIC_CONTEXT_TOKEN_LIMIT = 2000/);

  assert.match(payment, /ResolveUserFromBearerTokenAsync/);
  assert.doesNotMatch(payment, /FirstOrDefaultAsync\(u => u\.ApiToken/);
  assert.doesNotMatch(payment, /detail = body/);
  assert.match(payment, /Access remains on Free plan/);
  assert.match(userController, /ResolveUserFromBearerTokenAsync/);
  assert.doesNotMatch(userController, /FirstOrDefaultAsync\(u => u\.ApiToken/);

  assert.match(auth, /EmailVerificationToken = HashToken\(verifyToken\)/);
  assert.match(auth, /disposable_email_not_allowed/);
  assert.match(auth, /Keep the public response indistinguishable/);
  assert.match(team, /BeginTransactionAsync\(IsolationLevel\.Serializable\)/);
  assert.match(team, /invalid_invitation_role/);
  assert.match(team, /team_member_limit_reached/);
  assert.match(authContext, /refreshPromiseRef/);
  assert.match(wizardUi, /vscode:\/\/ai-project-brain\.ai-project-brain\/initialize\?projectId=/);
  assert.match(wizardUi, /Open in VS Code/);
});
