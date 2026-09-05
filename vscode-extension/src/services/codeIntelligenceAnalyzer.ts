import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ts from 'typescript';

const execFileAsync = promisify(execFile);

export interface AnalysisSourceFile {
    path: string;
    content: string;
}

export interface TypeScriptLayerImportViolation {
    importPath: string;
    fromLayer: string;
    toLayer: string;
    start: number;
    length: number;
    message: string;
}

export interface CodeIntelligenceResult {
    routeMap: any[];
    serviceGraph: any[];
    entityMap: any[];
    moduleMap: any[];
    decisionMap: any[];
    aiProviderMap: any[];
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);
const SCALAR_TYPES = new Set([
    'string', 'int', 'long', 'short', 'byte', 'bool', 'double', 'float', 'decimal',
    'datetime', 'datetimeoffset', 'guid', 'timespan', 'char', 'object'
]);

export function analyzeCodeIntelligence(files: AnalysisSourceFile[]): CodeIntelligenceResult {
    const result: CodeIntelligenceResult = {
        routeMap: [],
        serviceGraph: [],
        entityMap: [],
        moduleMap: [],
        decisionMap: [],
        aiProviderMap: []
    };

    for (const file of files) {
        const ext = path.extname(file.path).toLowerCase();
        if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
            analyzeTypeScript(file, result);
        } else if (ext === '.cs') {
            analyzeCSharp(file, result);
        }
        extractDecisionSignals(file, result.decisionMap);
    }

    applyServiceLifetimes(files, result.serviceGraph);
    result.moduleMap = buildSemanticModules(files);
    result.aiProviderMap = buildProviderStrategies(files);
    result.routeMap = uniqueBy(result.routeMap, route => `${route.httpMethod}:${route.route}:${route.controller}`);
    result.serviceGraph = uniqueBy(result.serviceGraph, service => `${service.name}:${service.path}`);
    enrichServiceGraph(result.serviceGraph);
    result.entityMap = consolidateEntities(result.entityMap);
    result.decisionMap = uniqueBy(result.decisionMap, decision => `${decision.title}:${decision.path}`).slice(0, 40);
    return result;
}

export function analyzeTypeScriptLayerImports(content: string, filePath: string): TypeScriptLayerImportViolation[] {
    const source = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const fromLayer = detectArchitectureLayer(filePath);
    if (!fromLayer) return [];

    const violations: TypeScriptLayerImportViolation[] = [];
    for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        const moduleSpecifier = statement.moduleSpecifier;
        if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) continue;
        const targetPath = `/${moduleSpecifier.text.replace(/^[.@/]+/, '')}/`;
        const toLayer = detectArchitectureLayer(targetPath);
        if (!toLayer || !isForbiddenLayerDependency(fromLayer, toLayer)) continue;
        violations.push({
            importPath: moduleSpecifier.text,
            fromLayer,
            toLayer,
            start: moduleSpecifier.getStart(source),
            length: moduleSpecifier.getWidth(source),
            message: `${fromLayer} layer cannot import ${toLayer} (${moduleSpecifier.text})`
        });
    }
    return violations;
}

export async function extractGitDecisions(projectPath: string): Promise<any[]> {
    try {
        const { stdout } = await execFileAsync(
            'git',
            ['log', '--date=iso-strict', '--pretty=format:%H%x1f%ad%x1f%s', '-n', '60'],
            { cwd: projectPath, timeout: 4000, windowsHide: true, maxBuffer: 256 * 1024 }
        );
        return parseGitDecisionLog(stdout);
    } catch {
        return [];
    }
}

export function parseGitDecisionLog(log: string): any[] {
    const intent = /\b(increase|decrease|switch|migrate|replace|adopt|enforce|remove|disable|enable|limit|architecture|auth|billing|subscription|provider|fallback|context|workspace|tenant)\b/i;
    return log.split(/\r?\n/)
        .map(line => line.split('\x1f'))
        .filter(parts => parts.length >= 3 && intent.test(parts.slice(2).join(' ')))
        .map(parts => {
            const subject = parts.slice(2).join(' ').replace(/^(feat|fix|refactor|perf|chore)(\([^)]*\))?:\s*/i, '');
            return {
                title: humanize(subject).slice(0, 100),
                decision: subject,
                reasoning: 'Recovered from repository change history; inspect the commit diff when the original rationale is needed.',
                category: inferDecisionCategory(subject),
                path: '.git',
                commitHash: parts[0].slice(0, 10),
                detectedAt: parts[1],
                confidence: 82
            };
        });
}

function analyzeTypeScript(file: AnalysisSourceFile, result: CodeIntelligenceResult): void {
    const source = ts.createSourceFile(
        file.path,
        file.content,
        ts.ScriptTarget.Latest,
        true,
        file.path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const visit = (node: ts.Node): void => {
        if (ts.isClassDeclaration(node) && node.name) {
            const className = node.name.text;
            const decorators = getDecorators(node);
            const controllerDecorator = decorators.find(value => value.name === 'Controller');
            const classRoute = controllerDecorator?.argument || '';
            const classAuth = authFromDecorators(decorators);

            if ((className.endsWith('Service') || decorators.some(value => value.name === 'Injectable')) && !isTestPath(file.path)) {
                const constructor = node.members.find(ts.isConstructorDeclaration);
                const dependencies = constructor?.parameters
                    .map(parameter => parameter.type?.getText(source) || parameter.name.getText(source))
                    .map(cleanTypeName)
                    .filter(Boolean) ?? [];
                result.serviceGraph.push({
                    name: className,
                    path: file.path,
                    sourceLine: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
                    dependsOn: [...new Set(dependencies)],
                    lifetime: decorators.some(value => value.name === 'Injectable') ? 'Container managed' : 'Unspecified',
                    purpose: inferPurpose(className, file.path)
                });
            }

            if (controllerDecorator || className.endsWith('Controller')) {
                for (const member of node.members) {
                    if (!ts.isMethodDeclaration(member) || !member.name) continue;
                    const methodDecorators = getDecorators(member);
                    const http = methodDecorators.find(value => HTTP_METHODS.has(value.name.toLowerCase()));
                    if (!http) continue;
                    const auth = mergeAuth(classAuth, authFromDecorators(methodDecorators));
                    result.routeMap.push({
                        httpMethod: http.name.toUpperCase(),
                        route: normalizeRoute(classRoute, http.argument),
                        controller: className,
                        action: member.name.getText(source),
                        sourceLine: source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1,
                        sourcePath: file.path,
                        ...auth,
                        ...inferOperationalGuards(member.getText(source), file.content),
                        purpose: `${className}.${member.name.getText(source)}`
                    });
                }
            }

            if (decorators.some(value => ['Entity', 'Table'].includes(value.name))) {
                result.entityMap.push(buildTypeScriptEntity(node, source, file.path));
            }
        }

        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const method = node.expression.name.text.toLowerCase();
            const receiver = node.expression.expression.getText(source);
            const route = stringArgument(node.arguments[0]);
            if (HTTP_METHODS.has(method) && route !== undefined && isLikelyHttpRouter(receiver)) {
                const chained = node.parent.getText(source).slice(0, 500);
                result.routeMap.push({
                    httpMethod: method.toUpperCase(),
                    route: normalizeRoute('', route),
                    controller: receiver,
                    action: 'minimal/express handler',
                    sourceLine: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
                    sourcePath: file.path,
                    ...inferTsChainedAuth(chained),
                    ...inferOperationalGuards(chained, file.content),
                    purpose: `Route declared in ${file.path}`
                });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
}

function analyzeCSharp(file: AnalysisSourceFile, result: CodeIntelligenceResult): void {
    const classes = findCSharpClasses(file.content);
    const dbSets = [...file.content.matchAll(/DbSet<\s*(\w+)\s*>\s+\w+/g)].map(match => match[1]);

    for (const cls of classes) {
        const attributes = parseCSharpAttributes(cls.attributes);
        const routePrefix = attributeArgument(attributes, 'Route')?.replace(/\[controller\]/gi, cls.name.replace(/Controller$/, '')) || '';
        const classAuth = authFromCSharpAttributes(attributes);

        if (cls.name.endsWith('Controller') || attributes.some(attribute => attribute.name === 'ApiController')) {
            const methods = findCSharpMethods(cls.body, cls.bodyStart);
            for (const method of methods) {
                const methodAttributes = parseCSharpAttributes(method.attributes);
                const http = methodAttributes.find(attribute => /^Http(Get|Post|Put|Delete|Patch)$/i.test(attribute.name));
                if (!http) continue;
                let auth = mergeAuth(
                    classAuth,
                    mergeAuth(authFromCSharpAttributes(methodAttributes), authFromMethodBody(method.body))
                );
                if (auth.authRequirement === 'Inherited/unspecified') auth = authResult('Anonymous');
                const methodText = method.body;
                result.routeMap.push({
                    httpMethod: http.name.replace(/^Http/i, '').toUpperCase(),
                    route: normalizeRoute(routePrefix, unquote(http.argument || '')),
                    controller: cls.name,
                    action: method.name,
                    sourceLine: lineAt(file.content, method.start),
                    sourcePath: file.path,
                    ...auth,
                    ...inferOperationalGuards(methodText, cls.body),
                    purpose: `${cls.name}.${method.name}`
                });
            }
        }

        if (isServiceClass(cls.name) && !isTestPath(file.path)) {
            const constructor = new RegExp(
                `(?:public|internal)\\s+${escapeRegex(cls.name)}\\s*\\(([^)]*)\\)`,
                's'
            ).exec(cls.body);
            const dependencies = constructor
                ? constructor[1].split(',')
                    .map(parameter => cleanTypeName(parameter.trim().split(/\s+/)[0] || ''))
                    .filter(Boolean)
                : [];
            result.serviceGraph.push({
                name: cls.name,
                path: file.path,
                sourceLine: lineAt(file.content, cls.start),
                dependsOn: [...new Set(dependencies)],
                lifetime: inferCSharpLifetime(cls.name, filesTextForLifetime(file.content, cls.name)),
                purpose: inferPurpose(cls.name, file.path)
            });
        }

        if (dbSets.includes(cls.name) || isLikelyEntity(cls, file.path)) {
            const relationships = extractCSharpRelationships(cls.body);
            result.entityMap.push({
                name: cls.name,
                tablePurpose: inferPurpose(cls.name, file.path),
                relationships,
                path: file.path,
                sourceLine: lineAt(file.content, cls.start)
            });
        }
    }

    for (const entityName of dbSets) {
        if (!result.entityMap.some(entity => entity.name === entityName)) {
            result.entityMap.push({
                name: entityName,
                tablePurpose: 'Entity registered in EF Core DbContext',
                relationships: [],
                path: file.path,
                sourceLine: lineAt(file.content, file.content.indexOf(`DbSet<${entityName}>`))
            });
        }
    }

    const groups = new Map<string, string>();
    for (const match of file.content.matchAll(/(?:var\s+)?(\w+)\s*=\s*\w+\.MapGroup\(\s*"([^"]+)"\s*\)/g)) {
        groups.set(match[1], match[2]);
    }
    const minimalRegex = /(\w+)\.Map(Get|Post|Put|Delete|Patch)\(\s*"([^"]*)"/g;
    for (const match of file.content.matchAll(minimalRegex)) {
        const start = match.index ?? 0;
        const statement = file.content.slice(start, Math.min(file.content.length, start + 900));
        result.routeMap.push({
            httpMethod: match[2].toUpperCase(),
            route: normalizeRoute(groups.get(match[1]) || '', match[3]),
            controller: 'Minimal API',
            action: match[1],
            sourceLine: lineAt(file.content, start),
            sourcePath: file.path,
            ...inferCSharpMinimalAuth(statement),
            ...inferOperationalGuards(statement, file.content),
            purpose: `Minimal API route in ${file.path}`
        });
    }
}

function getDecorators(node: ts.Node): Array<{ name: string; argument?: string }> {
    if (!ts.canHaveDecorators(node)) return [];
    return (ts.getDecorators(node) || []).map(decorator => {
        const expression = decorator.expression;
        if (ts.isCallExpression(expression)) {
            return { name: expression.expression.getText().split('.').pop() || '', argument: stringArgument(expression.arguments[0]) };
        }
        return { name: expression.getText().split('.').pop() || '' };
    });
}

function authFromDecorators(decorators: Array<{ name: string; argument?: string }>): any {
    if (decorators.some(value => ['Public', 'AllowAnonymous'].includes(value.name))) {
        return authResult('Anonymous');
    }
    const roles = decorators.find(value => ['Roles', 'RequireRole'].includes(value.name))?.argument;
    const policy = decorators.find(value => ['Policy', 'Authorize'].includes(value.name))?.argument;
    const guarded = decorators.some(value => ['UseGuards', 'Authorize', 'Auth'].includes(value.name));
    return authResult(roles ? 'Role restricted' : guarded || policy ? 'Bearer' : 'Inherited/unspecified', roles, policy);
}

function parseCSharpAttributes(value: string): Array<{ name: string; argument?: string }> {
    const result: Array<{ name: string; argument?: string }> = [];
    for (const match of value.matchAll(/\[\s*([\w.]+)(?:\s*\((.*?)\))?\s*\]/gs)) {
        result.push({ name: match[1].split('.').pop() || match[1], argument: match[2]?.trim() });
    }
    return result;
}

function authFromCSharpAttributes(attributes: Array<{ name: string; argument?: string }>): any {
    if (attributes.some(attribute => attribute.name === 'AllowAnonymous')) return authResult('Anonymous');
    const authorize = attributes.find(attribute => attribute.name === 'Authorize');
    const role = authorize?.argument?.match(/Roles\s*=\s*"([^"]+)"/i)?.[1]
        || attributes.find(attribute => /RequireRole|AdminOnly|OwnerOnly/i.test(attribute.name))?.argument;
    const policy = authorize?.argument?.match(/Policy\s*=\s*"([^"]+)"/i)?.[1]
        || attributes.find(attribute => /Policy|Permission/i.test(attribute.name))?.argument;
    const custom = attributes.find(attribute =>
        /Authorize|Permission|Authenticated|AdminOnly|OwnerOnly|RequireClaim/i.test(attribute.name)
    );
    return authResult(authorize || custom ? (role ? 'Role restricted' : 'Bearer') : 'Inherited/unspecified', unquote(role), unquote(policy), custom?.name);
}

function inferCSharpMinimalAuth(statement: string): any {
    const role = statement.match(/RequireAuthorization\(\s*policy\s*=>[\s\S]*?RequireRole\(\s*"([^"]+)"/i)?.[1]
        || statement.match(/RequireRole\(\s*"([^"]+)"/i)?.[1];
    const policy = statement.match(/RequireAuthorization\(\s*"([^"]+)"/i)?.[1];
    const anonymous = /\.AllowAnonymous\s*\(/i.test(statement);
    return authResult(anonymous ? 'Anonymous' : /\.RequireAuthorization\s*\(/i.test(statement) ? (role ? 'Role restricted' : 'Bearer') : 'Inherited/unspecified', role, policy);
}

function authFromMethodBody(body: string): any {
    if (/AllowAnonymous/i.test(body)) return authResult('Anonymous');
    if (/RequireAdmin|GetAdminUserAsync|UserRole\.Admin|IsInRole\(\s*"Admin"/i.test(body)) return authResult('Role restricted', 'Admin', undefined, 'RuntimeAdminCheck');
    if (/RequireTeamRole|GetTeamAccess|TeamRole\.(Owner|Admin|Member|Viewer)/i.test(body)) {
        const roles = [...body.matchAll(/TeamRole\.(Owner|Admin|Member|Viewer)/g)].map(match => match[1]);
        return authResult('Role restricted', [...new Set(roles)].join(',') || 'Team member', undefined, 'RuntimeTeamAccess');
    }
    if (/ResolveUserFromBearerTokenAsync|GetUserAsync\s*\(|GetUserFromTokenAsync|Authorization.*Bearer/i.test(body)) {
        return authResult('Bearer', undefined, undefined, 'RuntimeTokenResolver');
    }
    return authResult('Inherited/unspecified');
}

function inferTsChainedAuth(statement: string): any {
    const role = statement.match(/(?:requireRole|roles?)\(\s*['"`]([^'"`]+)/i)?.[1];
    const permission = statement.match(/(?:requirePermission|permission)\(\s*['"`]([^'"`]+)/i)?.[1];
    const guarded = /auth|guard|requireAuthorization|passport/i.test(statement);
    return authResult(guarded ? (role ? 'Role restricted' : 'Bearer') : 'Inherited/unspecified', role, undefined, permission ? `Permission:${permission}` : undefined);
}

function inferOperationalGuards(localText: string, _containingText: string): any {
    const tenantScoped = /UserId|OwnerUserId|TeamWorkspaceId|ProjectId|ResolveProjectAsync|FindAccessibleProject|tenant/i.test(localText);
    const rateLimited = /RateLimit|Throttle|429|TooManyRequests/i.test(localText);
    const planRequirement = localText.match(/PlanLimits\.(\w+)|UserPlan\.(Free|Pro|Team)|(?:requires?|Has)(Team|Paid|PriorityAI)/i);
    const featureFlag = localText.match(/Feature(?:Flag)?[.:_\s]*(\w+)|IsEnabled\(\s*"([^"]+)"/i);
    return {
        tenantScoped,
        rateLimited,
        planRequirement: planRequirement ? (planRequirement[1] || planRequirement[2] || planRequirement[3]) : undefined,
        featureFlag: featureFlag ? (featureFlag[1] || featureFlag[2]) : undefined
    };
}

function authResult(requirement: string, roles?: string, policy?: string, customAttribute?: string): any {
    return {
        authRequirement: requirement,
        roles: roles ? roles.split(',').map(value => value.trim()).filter(Boolean) : [],
        policy: policy || undefined,
        customAuthorization: customAttribute || undefined
    };
}

function mergeAuth(parent: any, child: any): any {
    if (child.authRequirement === 'Anonymous') return child;
    if (child.authRequirement !== 'Inherited/unspecified') return child;
    return parent;
}

function buildTypeScriptEntity(node: ts.ClassDeclaration, source: ts.SourceFile, filePath: string): any {
    const relationships: string[] = [];
    for (const member of node.members) {
        if (!ts.isPropertyDeclaration(member) || !member.type) continue;
        const decorators = getDecorators(member);
        const relation = decorators.find(value => /ManyToOne|OneToMany|ManyToMany|OneToOne/i.test(value.name));
        if (relation) relationships.push(`${relation.name} -> ${cleanTypeName(member.type.getText(source))}`);
    }
    return {
        name: node.name?.text || 'Entity',
        tablePurpose: inferPurpose(node.name?.text || 'Entity', filePath),
        relationships: [...new Set(relationships)],
        path: filePath,
        sourceLine: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
    };
}

function extractCSharpRelationships(body: string): string[] {
    const relationships: string[] = [];
    for (const match of body.matchAll(/public\s+(?:virtual\s+)?(?:ICollection|IList|List|IEnumerable)<\s*(\w+)\s*>\s+\w+/g)) {
        relationships.push(`1:N -> ${match[1]}`);
    }
    for (const match of body.matchAll(/public\s+(?:virtual\s+)?(\w+)\??\s+(\w+)\s*\{\s*get;/g)) {
        const type = match[1];
        if (!SCALAR_TYPES.has(type.toLowerCase()) && !/^I?(Collection|List|Enumerable|Dictionary)/.test(type) && !type.endsWith('Dto')) {
            relationships.push(`N:1 -> ${type}`);
        }
    }
    for (const match of body.matchAll(/public\s+(\w+)Id\s*\{/g)) {
        relationships.push(`FK -> ${match[1]}`);
    }
    return [...new Set(relationships)].slice(0, 12);
}

function buildSemanticModules(files: AnalysisSourceFile[]): any[] {
    const definitions = [
        ['Authentication', ['auth', 'token', 'login', 'password', 'identity'], 'Identity, sessions, verification and access authentication.'],
        ['Billing', ['payment', 'billing', 'paddle', 'subscription', 'invoice'], 'Subscription lifecycle, checkout and billing reconciliation.'],
        ['Entitlements & Licensing', ['entitlement', 'planlimit', 'license', 'usagecount'], 'Plan capabilities, quotas and server-side feature enforcement.'],
        ['Team Workspace', ['team', 'workspace', 'projectshare', 'invitation'], 'Shared project memory, membership and role collaboration.'],
        ['Project Memory', ['projectmemory', 'systemdecision', 'context history', 'aicontext'], 'Living project knowledge, decisions and context history.'],
        ['Repository Scanner', ['scanner', 'scanproject', 'filehash', 'brainignore'], 'Local repository discovery, incremental scans and metadata extraction.'],
        ['Semantic Compression', ['contextgenerator', 'contextvalidator', 'compression', 'token'], 'Prioritized context construction, validation and capacity optimization.'],
        ['Architecture Guard', ['architectureguard', 'rule', 'violation', 'roslyn', 'syntax'], 'Architecture rules, static analysis and code compliance.'],
        ['AI Provider Fallback', ['hybridai', 'aianalysis', 'gemini', 'cooldown', 'provider'], 'AI provider selection, free-first fallback, cache and cost protection.'],
        ['IDE Exports', ['contextexport', 'cursor', 'claude.md', 'copilot', 'windsurf', 'aider'], 'Assistant-specific context exports and IDE integration.'],
        ['Rate Limiting', ['ratelimit', 'throttle', 'too many requests'], 'Abuse protection and bounded request throughput.'],
        ['Workspace Analytics', ['analytics', 'activitylog', 'auditlog', 'usage overview'], 'Usage visibility, team activity and operational audit history.']
    ] as const;

    return definitions.map(([name, signals, purpose]) => {
        const scored = files.map(file => {
            const haystack = `${file.path}\n${file.content.slice(0, 24000)}`.toLowerCase();
            const matches = signals.filter(signal => haystack.includes(signal));
            return { path: file.path, score: matches.length, matches };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
        const totalSignals = new Set(scored.flatMap(item => item.matches)).size;
        return {
            name,
            purpose,
            keyFiles: scored.slice(0, 6).map(item => item.path),
            dependencies: inferModuleDependencies(name),
            status: scored.length ? 'Active' : 'Possible/Missing',
            riskLevel: /Auth|Billing|Entitlement|Provider/i.test(name) ? 'Critical' : 'Medium',
            editingGuidance: `Preserve existing ${name.toLowerCase()} boundaries and verify related tests after changes.`,
            confidence: Math.min(100, 35 + totalSignals * 13 + Math.min(scored.length, 4) * 4),
            coverageSignals: [...new Set(scored.flatMap(item => item.matches))]
        };
    }).filter(module => module.status === 'Active' || module.confidence >= 48);
}

function buildProviderStrategies(files: AnalysisSourceFile[]): any[] {
    const runtimeFiles = files.filter(file =>
        !/codeIntelligenceAnalyzer|scanProject|contextExport|readme|test|auditcontroller/i.test(file.path)
    );
    const combined = runtimeFiles.map(file => `${file.path}\n${file.content}`).join('\n');
    const providers = [
        { name: 'Google Gemini', evidence: /generativelanguage\.googleapis\.com|Gemini/i, env: ['AI_GEMINIAPIKEYS', 'GEMINI_API_KEYS', 'GEMINI_API_KEY'] },
        { name: 'OpenAI', evidence: /api\.openai\.com|OpenAIClient|@openai\//i, env: ['OPENAI_API_KEY'] },
        { name: 'Anthropic Claude', evidence: /api\.anthropic\.com|AnthropicClient|@anthropic-ai/i, env: ['ANTHROPIC_API_KEY'] }
    ];
    return providers.filter(provider => provider.evidence.test(combined)).map((provider, index) => {
        const source = runtimeFiles
            .filter(file => provider.evidence.test(file.content))
            .sort((a, b) => providerPathScore(b.path) - providerPathScore(a.path))[0];
        return {
            providerName: provider.name,
            envVarNames: provider.env.filter(name => combined.includes(name)),
            fallbackOrder: index + 1,
            path: source?.path || '',
            strategy: /free.?first|priority|keys\[0\]|FirstOrDefault/i.test(combined) ? 'Free/priority key first' : 'Configured provider',
            fallback: /fallback|next key|for\s*\(.*keys|cooldown/i.test(combined) ? 'Ordered key fallback' : 'Not detected',
            cooldownEnabled: /cooldown|TooManyRequests|429/i.test(combined),
            cacheEnabled: /cache|ConcurrentDictionary|memorycache/i.test(combined),
            monthlyCapEnabled: /monthly|MaxAiRequests|budget|usage cap/i.test(combined),
            emergencyDisableEnabled: /disable|kill.?switch|enabled\s*=\s*false/i.test(combined)
        };
    });
}

function extractDecisionSignals(file: AnalysisSourceFile, decisions: any[]): void {
    const constantRegex = /(?:const|static\s+readonly)\s+[\w<>?]+\s+([A-Za-z][A-Za-z0-9_]{3,})\s*=\s*([^;\n]+)/g;
    for (const match of file.content.matchAll(constantRegex)) {
        const title = humanize(match[1]).slice(0, 100);
        const value = match[2].trim().slice(0, 220);
        if (isDecisionNoise(title, value)) continue;
        if (!/limit|max|cap|minimum|iteration|strategy|provider|timeout|retention|token|plan|cache|architecture|fallback|cooldown|decision|reason/i.test(`${title} ${value}`)) continue;
        decisions.push({
            title,
            decision: `${match[1]} is configured as ${value}.`,
            reasoning: inferDecisionReason(match[1], value),
            category: inferDecisionCategory(match[1]),
            path: file.path,
            sourceLine: lineAt(file.content, match.index ?? 0),
            confidence: 76
        });
    }

    const commentRegex = /^\s*(?:\/\/|#|\/\*)\s*(?:Decision|ADR|Rationale|Reason)\s*:\s*([^*\r\n]+)/gim;
    for (const match of file.content.matchAll(commentRegex)) {
        const statement = match[1].trim().replace(/\*\/$/, '').trim();
        if (isDecisionNoise(statement, statement)) continue;
        decisions.push({
            title: humanize(statement).slice(0, 100),
            decision: statement,
            reasoning: 'Recorded explicitly in a source comment.',
            category: inferDecisionCategory(statement),
            path: file.path,
            sourceLine: lineAt(file.content, match.index ?? 0),
            confidence: 92
        });
    }
}

function findCSharpClasses(content: string): Array<{ name: string; attributes: string; body: string; start: number; bodyStart: number }> {
    const result: Array<{ name: string; attributes: string; body: string; start: number; bodyStart: number }> = [];
    const masked = maskCSharpNonCode(content);
    const regex = /((?:\s*\[[^\r\n]+]\s*)*)(?:public|internal|private|protected)?\s*(?:sealed\s+|static\s+|abstract\s+|partial\s+)*class\s+(\w+)[^{]*\{/g;
    const matches = [...masked.matchAll(regex)];
    for (let index = 0; index < matches.length; index++) {
        const match = matches[index];
        const open = (match.index ?? 0) + match[0].lastIndexOf('{');
        const nextClass = matches[index + 1]?.index ?? content.length;
        const close = matchingBrace(masked, open);
        const bodyEnd = close >= 0 ? close : nextClass;
        const attributes = content.slice(match.index ?? 0, (match.index ?? 0) + (match[1]?.length ?? 0));
        result.push({ name: match[2], attributes, body: content.slice(open + 1, bodyEnd), start: match.index ?? 0, bodyStart: open + 1 });
    }
    return result;
}

function findCSharpMethods(body: string, offset: number): Array<{ name: string; attributes: string; body: string; start: number }> {
    const result: Array<{ name: string; attributes: string; body: string; start: number }> = [];
    const masked = maskCSharpNonCode(body);
    const regex = /((?:\s*\[[^\r\n]+]\s*)+)(?:public|internal|private|protected)\s+(?:async\s+)?[\w<>,?.\s[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:\{|=>)/g;
    for (const match of masked.matchAll(regex)) {
        const localStart = match.index ?? 0;
        const expressionBodied = match[0].trimEnd().endsWith('=>');
        const open = expressionBodied ? -1 : masked.indexOf('{', localStart + match[0].length - 1);
        const close = open >= 0 ? matchingBrace(masked, open) : -1;
        const methodBody = open >= 0 && close >= 0 ? body.slice(open + 1, close) : match[0];
        const attributes = body.slice(localStart, localStart + (match[1]?.length ?? 0));
        result.push({ name: match[2], attributes, body: methodBody, start: offset + localStart });
    }
    return result;
}

function matchingBrace(content: string, open: number): number {
    let depth = 0;
    for (let index = open; index < content.length; index++) {
        const char = content[index];
        if (char === '{') depth++;
        if (char === '}' && --depth === 0) return index;
    }
    return -1;
}

export function maskCSharpNonCode(content: string): string {
    const masked = content.split('');
    const blank = (index: number): void => {
        if (masked[index] !== '\r' && masked[index] !== '\n') masked[index] = ' ';
    };

    for (let index = 0; index < content.length;) {
        if (content.startsWith('//', index)) {
            while (index < content.length && content[index] !== '\n') blank(index++);
            continue;
        }
        if (content.startsWith('/*', index)) {
            blank(index++);
            blank(index++);
            while (index < content.length && !content.startsWith('*/', index)) blank(index++);
            if (index < content.length) {
                blank(index++);
                blank(index++);
            }
            continue;
        }
        if (content.startsWith('"""', index)) {
            blank(index++);
            blank(index++);
            blank(index++);
            while (index < content.length && !content.startsWith('"""', index)) blank(index++);
            for (let count = 0; count < 3 && index < content.length; count++) blank(index++);
            continue;
        }
        if (content[index] === '"' || content[index] === '\'') {
            const quote = content[index];
            const verbatim = quote === '"' && index > 0 && content[index - 1] === '@';
            const interpolated = quote === '"' && (
                content[index - 1] === '$'
                || (content[index - 1] === '@' && content[index - 2] === '$')
                || (content[index - 1] === '$' && content[index - 2] === '@')
            );
            blank(index++);
            let interpolationDepth = 0;
            while (index < content.length) {
                if (interpolated && interpolationDepth === 0 && content[index] === '{' && content[index + 1] !== '{') {
                    interpolationDepth = 1;
                    blank(index++);
                    continue;
                }
                if (interpolated && interpolationDepth > 0) {
                    if (content[index] === '{') interpolationDepth++;
                    if (content[index] === '}') interpolationDepth--;
                    if ((content[index] === '"' || content[index] === '\'') && interpolationDepth > 0) {
                        const nestedQuote = content[index];
                        blank(index++);
                        while (index < content.length) {
                            if (content[index] === nestedQuote && content[index - 1] !== '\\') {
                                blank(index++);
                                break;
                            }
                            blank(index++);
                        }
                        continue;
                    }
                    blank(index++);
                    continue;
                }
                if (verbatim && content[index] === '"' && content[index + 1] === '"') {
                    blank(index++);
                    blank(index++);
                    continue;
                }
                if (content[index] === quote && (verbatim || content[index - 1] !== '\\')) {
                    blank(index++);
                    break;
                }
                blank(index++);
            }
            continue;
        }
        index++;
    }
    return masked.join('');
}

function isLikelyEntity(cls: { name: string; body: string }, filePath: string): boolean {
    if (!filePath.toLowerCase().includes('/models/')) return false;
    if (/Dto|Request|Response|Config|Options|Details|Result|Report$/.test(cls.name)) return false;
    return /public\s+\w+Id\s*\{|ICollection<|DateTime\s+CreatedAt/.test(cls.body);
}

function normalizeRoute(prefix: string, action?: string): string {
    const route = [unquote(prefix), unquote(action || '')]
        .map(value => value.replace(/^\//, '').replace(/\/$/, ''))
        .filter(Boolean)
        .join('/');
    return `/${route}`.replace(/\/+/g, '/').toLowerCase();
}

function stringArgument(node: ts.Node | undefined): string | undefined {
    return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

function cleanTypeName(value: string): string {
    return value
        .replace(/^(?:readonly\s+)?/, '')
        .replace(/<.*>/g, '')
        .replace(/[?{}[\]]/g, '')
        .split('|')[0]
        .trim();
}

function inferPurpose(name: string, filePath: string): string {
    return `${humanize(name)} domain component defined in ${filePath}.`;
}

function inferModuleDependencies(name: string): string[] {
    if (name === 'Billing') return ['Entitlements & Licensing', 'Authentication'];
    if (name === 'Team Workspace') return ['Authentication', 'Entitlements & Licensing', 'Project Memory'];
    if (name === 'Semantic Compression') return ['Project Memory', 'Repository Scanner'];
    if (name === 'Architecture Guard') return ['Repository Scanner', 'AI Provider Fallback'];
    if (name === 'IDE Exports') return ['Semantic Compression'];
    return [];
}

function inferDecisionReason(name: string, value: string): string {
    if (/limit|max|token/i.test(name)) return 'Bounds resource usage and keeps generated context within product capacity.';
    if (/timeout|cooldown/i.test(name)) return 'Protects reliability when an external dependency is slow or rate limited.';
    if (/provider|fallback/i.test(`${name} ${value}`)) return 'Maintains AI availability while controlling provider cost and failures.';
    return 'Detected from an explicit architecture/configuration constant in source.';
}

function inferDecisionCategory(name: string): string {
    if (/token|context|compression/i.test(name)) return 'Context';
    if (/plan|limit|usage/i.test(name)) return 'Entitlements';
    if (/provider|ai|fallback/i.test(name)) return 'AI Provider';
    return 'Architecture';
}

function inferCSharpLifetime(_name: string, content: string): string {
    if (/AddSingleton/.test(content)) return 'Singleton';
    if (/AddTransient/.test(content)) return 'Transient';
    if (/AddScoped/.test(content)) return 'Scoped';
    return 'Unspecified';
}

function applyServiceLifetimes(files: AnalysisSourceFile[], services: any[]): void {
    const registrations = files
        .filter(file => file.path.endsWith('.cs'))
        .map(file => file.content)
        .join('\n');
    for (const service of services) {
        const escaped = escapeRegex(service.name);
        const match = registrations.match(new RegExp(`Add(Scoped|Singleton|Transient)<[^>]*\\b${escaped}\\b|Add(Scoped|Singleton|Transient)\\(.*\\b${escaped}\\b`));
        service.lifetime = match ? (match[1] || match[2]) : service.lifetime;
    }
}

function enrichServiceGraph(services: any[]): void {
    const byNormalizedName = new Map<string, any>();
    for (const service of services) {
        service.referencedBy = [];
        service.circularDependencies = [];
        service.layerViolations = [];
        service.layer = detectArchitectureLayer(service.path) || 'Unclassified';
        byNormalizedName.set(normalizeServiceName(service.name), service);
    }

    for (const service of services) {
        service.dependsOn = [...new Set((service.dependsOn || []).filter((dependency: string) =>
            dependency
            && !/^(string|number|boolean|object|configuration|logger|httpclient)$/i.test(normalizeServiceName(dependency))
        ))];
        for (const dependency of service.dependsOn) {
            const target = byNormalizedName.get(normalizeServiceName(dependency));
            if (!target || target === service) continue;
            target.referencedBy.push(service.name);
            if (isForbiddenLayerDependency(service.layer, target.layer)) {
                service.layerViolations.push(`${service.layer} -> ${target.layer} (${target.name})`);
            }
        }
    }

    const adjacency = new Map<string, string[]>();
    for (const service of services) {
        adjacency.set(service.name, service.dependsOn
            .map((dependency: string) => byNormalizedName.get(normalizeServiceName(dependency))?.name)
            .filter(Boolean));
    }
    for (const service of services) {
        const cycles = findCyclesFrom(service.name, adjacency);
        service.circularDependencies = cycles.slice(0, 4);
        service.referencedBy = [...new Set(service.referencedBy)].sort();
        service.layerViolations = [...new Set(service.layerViolations)];
    }
}

function findCyclesFrom(start: string, adjacency: Map<string, string[]>): string[] {
    const cycles: string[] = [];
    const visit = (node: string, pathStack: string[], visiting: Set<string>): void => {
        if (pathStack.length > 12) return;
        for (const next of adjacency.get(node) || []) {
            if (next === start && pathStack.length > 0) {
                cycles.push([...pathStack, node, start].join(' -> '));
                continue;
            }
            if (visiting.has(next)) continue;
            visiting.add(next);
            visit(next, [...pathStack, node], visiting);
            visiting.delete(next);
        }
    };
    visit(start, [], new Set([start]));
    return [...new Set(cycles)];
}

function isServiceClass(name: string): boolean {
    return /(Service|Repository|Provider|Resolver|Generator|Scanner|Validator|Guard|Throttle)$/.test(name);
}

function isTestPath(filePath: string): boolean {
    return /(^|\/)(tests?|[^/]+\.tests?)(\/|$)/i.test(filePath.replace(/\\/g, '/'));
}

function isLikelyHttpRouter(receiver: string): boolean {
    const normalized = receiver.replace(/\s/g, '');
    return /(^|\.)(app|router|routes?|api|server|fastify)$/i.test(normalized)
        || /(?:Router|Routes|Api|Server)$/.test(normalized);
}

function normalizeServiceName(name: string): string {
    return name.replace(/^I(?=[A-Z])/, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function detectArchitectureLayer(filePath: string): string | undefined {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    if (normalized.includes('/domain/')) return 'Domain';
    if (normalized.includes('/application/')) return 'Application';
    if (normalized.includes('/infrastructure/') || normalized.includes('/data/')) return 'Infrastructure';
    if (normalized.includes('/controllers/') || normalized.includes('/presentation/') || normalized.includes('/pages/')) return 'Presentation';
    return undefined;
}

function isForbiddenLayerDependency(from: string, to: string): boolean {
    return (from === 'Domain' && ['Application', 'Infrastructure', 'Presentation'].includes(to))
        || (from === 'Application' && ['Infrastructure', 'Presentation'].includes(to));
}

function isDecisionNoise(title: string, value: string): boolean {
    const words = title.split(/\s+/).filter(Boolean);
    return words.length < 2
        || /[$@]?"[^"]*\{[^}]+}/.test(value)
        || /\b(AppendLine|WriteLine|ToString|nameof)\s*\(/.test(value)
        || /[{};]\s*\)?$/.test(value)
        || /\.(Decision|Title|Name|Value)\b/.test(value)
        || value.length < 2;
}

function filesTextForLifetime(content: string, _name: string): string {
    return content;
}

function attributeArgument(attributes: Array<{ name: string; argument?: string }>, name: string): string | undefined {
    return unquote(attributes.find(attribute => attribute.name === name)?.argument || '');
}

function unquote(value: string | undefined): string {
    return (value || '').trim().replace(/^["']|["']$/g, '');
}

function lineAt(content: string, index: number): number {
    return content.slice(0, Math.max(0, index)).split('\n').length;
}

function humanize(value: string): string {
    const normalized = value === value.toUpperCase() ? value.toLowerCase() : value;
    return normalized
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Za-z])(\d)/g, '$1 $2')
        .replace(/(\d)([A-Za-z])/g, '$1 $2')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
        const value = key(item).toLowerCase();
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
}

function consolidateEntities(entities: any[]): any[] {
    const byName = new Map<string, any>();
    for (const entity of entities) {
        const key = entity.name.toLowerCase();
        const current = byName.get(key);
        if (!current) {
            byName.set(key, entity);
            continue;
        }
        const currentScore = (current.relationships?.length ?? 0) * 10 + (/\/models\//i.test(current.path) ? 8 : 0);
        const candidateScore = (entity.relationships?.length ?? 0) * 10 + (/\/models\//i.test(entity.path) ? 8 : 0);
        const preferred = candidateScore > currentScore ? entity : current;
        preferred.relationships = [...new Set([...(current.relationships ?? []), ...(entity.relationships ?? [])])];
        byName.set(key, preferred);
    }
    return [...byName.values()];
}

function providerPathScore(filePath: string): number {
    if (/hybridai/i.test(filePath)) return 150;
    if (/aianalysis|provider/i.test(filePath)) return 100;
    if (/services\//i.test(filePath)) return 50;
    return 10;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
