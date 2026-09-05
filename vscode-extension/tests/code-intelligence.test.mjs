import test from 'node:test';
import assert from 'node:assert/strict';
import {
    analyzeCodeIntelligence,
    analyzeTypeScriptLayerImports,
    parseGitDecisionLog
} from '../out/services/codeIntelligenceAnalyzer.js';

const csharpController = `
[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public IActionResult Login() => Ok();

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await context.ResolveUserFromBearerTokenAsync(Request.Headers.Authorization);
        return Ok(user);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("users")]
    public IActionResult Users()
    {
        if (PlanLimits.HasTeamWorkspace(UserPlan.Team)) { }
        return Ok();
    }
}`;

const csharpService = `
public sealed class ProjectMemoryService : IProjectMemoryService
{
    private readonly ApplicationDbContext _context;
    private readonly IContextGenerator _generator;
    public ProjectMemoryService(ApplicationDbContext context, IContextGenerator generator)
    {
        _context = context;
        _generator = generator;
    }
}`;

const csharpModels = `
public class Project
{
    public string UserId { get; set; }
    public User? User { get; set; }
    public ICollection<ProjectScan> Scans { get; set; } = new List<ProjectScan>();
    public ICollection<AIContext> AIContexts { get; set; } = new List<AIContext>();
}
public class ApplicationDbContext : DbContext
{
    public DbSet<Project> Projects { get; set; }
}`;

const tsSource = `
@Controller("team")
@UseGuards(AuthGuard)
export class TeamController {
  constructor(private readonly billingService: BillingService) {}

  @Get("audit")
  @Roles("Owner")
  audit() { return []; }
}

router.post("/exports", requirePermission("export"), handler);
`;

test('structural analyzer maps endpoint authorization and source locations', () => {
    const result = analyzeCodeIntelligence([
        { path: 'backend/src/Controllers/AuthController.cs', content: csharpController },
        { path: 'web/team.controller.ts', content: tsSource }
    ]);

    const login = result.routeMap.find(route => route.route === '/auth/login');
    const me = result.routeMap.find(route => route.route === '/auth/me');
    const users = result.routeMap.find(route => route.route === '/auth/users');
    const audit = result.routeMap.find(route => route.route === '/team/audit');

    assert.equal(login.authRequirement, 'Anonymous');
    assert.equal(me.authRequirement, 'Bearer');
    assert.equal(users.authRequirement, 'Role restricted');
    assert.deepEqual(users.roles, ['Admin']);
    assert.equal(users.planRequirement, 'HasTeamWorkspace');
    assert.equal(audit.authRequirement, 'Role restricted');
    assert.deepEqual(audit.roles, ['Owner']);
    assert.equal(login.sourcePath, 'backend/src/Controllers/AuthController.cs');
    assert.ok(login.sourceLine > 0);
});

test('TypeScript route discovery ignores Map and configuration accessors', () => {
    const result = analyzeCodeIntelligence([{
        path: 'src/config.ts',
        content: `
            const value = config.get("apiUrl");
            const cached = items.get("project");
            searchParams.delete("payment");
            app.get("/health", handler);
        `
    }]);

    assert.deepEqual(result.routeMap.map(route => `${route.httpMethod} ${route.route}`), ['GET /health']);
});

test('service graph binds each class to its real file and constructor dependencies', () => {
    const result = analyzeCodeIntelligence([
        { path: 'backend/src/Services/ProjectMemoryService.cs', content: csharpService },
        { path: 'backend/Program.cs', content: 'services.AddScoped<IProjectMemoryService, ProjectMemoryService>();' },
        { path: 'web/team.controller.ts', content: tsSource }
    ]);

    const service = result.serviceGraph.find(node => node.name === 'ProjectMemoryService');
    assert.equal(service.path, 'backend/src/Services/ProjectMemoryService.cs');
    assert.deepEqual(service.dependsOn, ['ApplicationDbContext', 'IContextGenerator']);
    assert.equal(service.lifetime, 'Scoped');

    const billing = result.serviceGraph.find(node => node.name === 'TeamController');
    assert.equal(billing, undefined);
    assert.equal(result.serviceGraph.some(node => node.name.toLowerCase() === 'components'), false);
});

test('C# lexical masking preserves real controllers and ignores classes shown inside strings', () => {
    const result = analyzeCodeIntelligence([{
        path: 'backend/src/Controllers/ProjectController.cs',
        content: `
            [ApiController]
            [Route("[controller]")]
            public class ProjectController : ControllerBase
            {
                // User's current project is resolved from the bearer token.
                private const string Example = "public class FakeService { }";

                [HttpGet("memory")]
                public IActionResult Memory()
                {
                    var text = $"Decision: {decision.Decision}";
                    return Ok(text);
                }
            }
        `
    }]);

    assert.ok(result.routeMap.some(route => route.controller === 'ProjectController' && route.route === '/project/memory'));
    assert.equal(result.serviceGraph.some(service => service.name === 'FakeService'), false);
});

test('service graph reports reverse dependencies, cycles and layer violations', () => {
    const result = analyzeCodeIntelligence([
        {
            path: 'src/Domain/OrderService.cs',
            content: 'public class OrderService { public OrderService(IPaymentService payment) {} }'
        },
        {
            path: 'src/Infrastructure/PaymentService.cs',
            content: 'public class PaymentService { public PaymentService(IOrderService orders) {} }'
        }
    ]);

    const order = result.serviceGraph.find(node => node.name === 'OrderService');
    const payment = result.serviceGraph.find(node => node.name === 'PaymentService');

    assert.deepEqual(order.referencedBy, ['PaymentService']);
    assert.deepEqual(payment.referencedBy, ['OrderService']);
    assert.ok(order.circularDependencies.some(cycle => cycle.includes('OrderService') && cycle.includes('PaymentService')));
    assert.ok(order.layerViolations.some(violation => violation.includes('Domain -> Infrastructure')));
});

test('service graph excludes test doubles from production architecture', () => {
    const result = analyzeCodeIntelligence([{
        path: 'tests/FakeEmailService.cs',
        content: 'public class FakeEmailService { }'
    }]);

    assert.equal(result.serviceGraph.length, 0);
});

test('TypeScript AST import rules reject forbidden Clean Architecture dependencies', () => {
    const violations = analyzeTypeScriptLayerImports(
        `
            import { SqlOrderRepository } from "../../Infrastructure/Data/SqlOrderRepository";
            export { BillingController } from "../../Presentation/BillingController";
            import { Order } from "../Models/Order";
        `,
        'src/Domain/Orders/OrderService.ts'
    );

    assert.equal(violations.length, 2);
    assert.ok(violations.some(item => item.toLayer === 'Infrastructure'));
    assert.ok(violations.some(item => item.toLayer === 'Presentation'));
    assert.ok(violations.every(item => item.fromLayer === 'Domain'));
});

test('entity, semantic module, decision and provider strategy maps are source-backed', () => {
    const provider = `
public class HybridAIAnalysisService {
  private const int MAX_MONTHLY_AI_REQUESTS = 500;
  private readonly ConcurrentDictionary<string, DateTime> cooldown = new();
  private const bool EMERGENCY_DISABLE = false;
  private const string Endpoint = "https://generativelanguage.googleapis.com";
  // free-first fallback to the next paid key after HTTP 429
}`;
    const result = analyzeCodeIntelligence([
        { path: 'backend/src/Models/Project.cs', content: csharpModels },
        { path: 'backend/src/Services/HybridAIAnalysisService.cs', content: provider },
        { path: 'backend/src/Controllers/PaymentController.cs', content: 'class PaymentController { subscription billing; }' },
        { path: 'backend/src/Services/EntitlementService.cs', content: 'class EntitlementService { PlanLimits limits; }' }
    ]);

    const project = result.entityMap.find(entity => entity.name === 'Project');
    assert.ok(project.relationships.includes('1:N -> ProjectScan'));
    assert.ok(project.relationships.includes('N:1 -> User'));

    assert.ok(result.moduleMap.some(module => module.name === 'Billing' && module.confidence >= 60));
    assert.ok(result.moduleMap.some(module => module.name === 'Entitlements & Licensing'));
    assert.ok(result.decisionMap.some(decision => decision.title.includes('Max Monthly Ai Requests')));

    const gemini = result.aiProviderMap.find(item => item.providerName === 'Google Gemini');
    assert.equal(gemini.strategy, 'Free/priority key first');
    assert.equal(gemini.fallback, 'Ordered key fallback');
    assert.equal(gemini.cooldownEnabled, true);
    assert.equal(gemini.monthlyCapEnabled, true);
    assert.equal(gemini.emergencyDisableEnabled, true);
});

test('decision extraction rejects interpolated rendering code and keeps explicit source decisions', () => {
    const result = analyzeCodeIntelligence([
        {
            path: 'ContextGenerator.cs',
            content: `
                // Decision: Keep provider fallback deterministic
                private const int MAX_CONTEXT_TOKENS = 32000;
                private const int Pbkdf2Iterations = 100000;
                sb.AppendLine($"Decision: {decision.Decision}");
            `
        }
    ]);

    assert.ok(result.decisionMap.some(decision => decision.decision === 'Keep provider fallback deterministic'));
    assert.ok(result.decisionMap.some(decision => decision.title === 'Max Context Tokens'));
    assert.ok(result.decisionMap.some(decision => decision.title === 'Pbkdf 2 Iterations'));
    assert.equal(result.decisionMap.some(decision => decision.decision.includes('{decision.Decision}')), false);
});

test('git history contributes dated architecture decisions without ordinary commit noise', () => {
    const log = [
        'abcdef1234567890\x1f2026-07-01T10:30:00+03:00\x1ffeat(context): increase Team context limit',
        '1234567890abcdef\x1f2026-06-30T09:00:00+03:00\x1fdocs: fix typo',
        'fedcba0987654321\x1f2026-06-29T08:00:00+03:00\x1frefactor: switch provider fallback to Gemini'
    ].join('\n');

    const decisions = parseGitDecisionLog(log);

    assert.equal(decisions.length, 2);
    assert.equal(decisions[0].commitHash, 'abcdef1234');
    assert.equal(decisions[0].detectedAt, '2026-07-01T10:30:00+03:00');
    assert.match(decisions[0].decision, /increase Team context limit/i);
    assert.match(decisions[1].decision, /Gemini/i);
});
