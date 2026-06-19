import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ApiClient, GeneratedContextResponse } from './apiClient';

export interface ContextBuildResult {
    context: string;
    instructions: string;
    plan: string;
    maxTokens: number;
    source: string;
    fallback: boolean;
    quality?: any;
    confidence?: any;
    validation?: any;
    historySaved?: boolean;
}

// When plan lookup is unavailable, fall back to the Free allowance. The
// backend remains authoritative and a network failure must never imply Pro.
export const OPTIMISTIC_CONTEXT_TOKEN_LIMIT = 2000;

export async function getPlanTokenLimit(apiClient: ApiClient): Promise<{ plan: string; maxTokens: number }> {
    const planInfo = await apiClient.getPlanFeatures().catch(() => null);
    const maxTokens = planInfo?.features?.maxContextSizeTokens ?? planInfo?.features?.maxContextTokens ?? OPTIMISTIC_CONTEXT_TOKEN_LIMIT;
    return {
        plan: planInfo?.plan ?? 'Unknown',
        maxTokens
    };
}

export async function generateOptimizedContext(
    apiClient: ApiClient,
    projectPath: string,
    maxTokens: number,
    contextType: string = 'full'
): Promise<ContextBuildResult> {
    try {
        const response = await apiClient.generateContext(projectPath, maxTokens);
        const decorated = decorateBackendContext(response, contextType);
        return {
            context: filterContextByType(decorated, contextType),
            instructions: decorateInstructions(response.instructions, response),
            plan: response.plan ?? 'Unknown',
            maxTokens: response.maxTokens ?? maxTokens,
            source: response.source ?? 'backend',
            fallback: false,
            quality: response.quality,
            confidence: response.confidence,
            validation: response.validation,
            historySaved: response.historySaved
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isUsageLimitError(message)) {
            throw error;
        }
        const memory = await apiClient.getProjectMemory(projectPath).catch(() => null);
        const context = buildFallbackContext(memory, projectPath, message, maxTokens);
        return {
            context: filterContextByType(context, contextType),
            instructions: buildFallbackInstructions(memory, projectPath, message),
            plan: 'Unknown',
            maxTokens,
            source: 'local_fallback',
            fallback: true
        };
    }
}

function isUsageLimitError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('limit reached')
        || normalized.includes('usage limit')
        || normalized.includes('context_generation_limit_reached')
        || normalized.includes('ai_usage_limit_reached');
}

export async function writeContextFiles(projectPath: string, result: ContextBuildResult): Promise<void> {
    const contextUri = vscode.Uri.joinPath(vscode.Uri.file(projectPath), '.ai-context.md');
    await vscode.workspace.fs.writeFile(contextUri, Buffer.from(result.context, 'utf8'));

    const instructionsUri = vscode.Uri.joinPath(vscode.Uri.file(projectPath), 'AI_INSTRUCTIONS.md');
    await vscode.workspace.fs.writeFile(instructionsUri, Buffer.from(result.instructions, 'utf8'));
}

export function getEditorTargetPath(projectPath: string, editor: string): string {
    switch (editor) {
        case 'cursor':
            return path.join(projectPath, '.cursor', 'rules', 'ai-context-brain.mdc');
        case 'windsurf':
            return path.join(projectPath, '.windsurf', 'rules', 'ai-context-brain.md');
        case 'codex':
            return path.join(projectPath, 'AGENTS.md');
        case 'copilot':
            return path.join(projectPath, '.github', 'copilot-instructions.md');
        case 'claude':
            return path.join(projectPath, 'CLAUDE.md');
        case 'aider':
            return path.join(projectPath, 'CONVENTIONS.md');
        default:
            return path.join(projectPath, 'AI_INSTRUCTIONS.md');
    }
}

export function writeEditorExport(projectPath: string, editor: string, result: ContextBuildResult): string {
    const filePath = getEditorTargetPath(projectPath, editor);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, formatForEditor(editor, result));
    return filePath;
}

export function formatForEditor(editor: string, result: ContextBuildResult): string {
    const content = `${result.instructions.trim()}\n\n---\n\n${result.context.trim()}\n`;
    switch (editor) {
        case 'cursor':
            return `---\ndescription: AI Context Brain optimized project context\nglobs: **/*\n---\n\n${content}`;
        case 'windsurf':
            return `# AI Context Brain - Windsurf Rules\n\n${content}`;
        case 'codex':
            return `# AGENTS.md - AI Context Brain\n\n${content}`;
        case 'copilot':
            return `# GitHub Copilot Instructions - AI Context Brain\n\n${content}`;
        case 'claude':
            return `# CLAUDE.md - AI Context Brain\n\n${content}`;
        case 'aider':
            return `# Aider Conventions - AI Context Brain\n\n${content}`;
        default:
            return content;
    }
}

function decorateBackendContext(response: GeneratedContextResponse, contextType: string): string {
    const quality = response.quality?.overallScore ?? response.quality?.overall ?? response.quality?.score ?? 'n/a';
    const confidence = response.confidence?.overall ?? response.confidence?.overallScore ?? 'n/a';
    const warnings = Array.isArray(response.validation?.warnings) ? response.validation.warnings : [];
    const metadata = [
        '# AI Context Brain Optimized Context',
        '',
        '## Generation Metadata',
        `- Plan: ${response.plan ?? 'Unknown'}`,
        `- Requested Context Type: ${contextType}`,
        '- Context Capacity Applied: 100% of selected allowance',
        `- Context Utilization: ${response.validation?.tokenUtilization !== undefined ? Math.round(response.validation.tokenUtilization * 100) + '%' : 'n/a'}`,
        `- Source: ${response.source ?? 'backend'}`,
        `- Context History Saved: ${response.historySaved ? 'yes' : 'no'}`,
        `- Quality Score: ${quality}`,
        `- Confidence Score: ${confidence}`,
        `- Validation Warnings: ${warnings.length ? warnings.join('; ') : 'none'}`,
        '',
        '## Optimized Project Context',
        ''
    ].join('\n');

    return `${metadata}${response.context ?? ''}`.trim() + '\n';
}

function decorateInstructions(instructions: string, response: GeneratedContextResponse): string {
    const warnings = Array.isArray(response.validation?.warnings) ? response.validation.warnings : [];
    return [
        '# AI Context Brain Instructions',
        '',
        '## Generation Metadata',
        `- Plan: ${response.plan ?? 'Unknown'}`,
        '- Context Capacity Applied: 100% of selected allowance',
        `- Source: ${response.source ?? 'backend'}`,
        `- Context History Saved: ${response.historySaved ? 'yes' : 'no'}`,
        `- Validation Warnings: ${warnings.length ? warnings.join('; ') : 'none'}`,
        '',
        instructions?.trim() || 'Use the generated .ai-context.md as the source of truth before editing this repository.',
        '',
        '## Required AI Workflow',
        '- Read .ai-context.md before implementing changes.',
        '- Preserve architecture rules, naming rules, import rules, and folder boundaries.',
        '- Prefer existing services and modules over new abstractions.',
        '- Do not hardcode secrets, tokens, connection strings, or provider keys.',
        '- Keep changes scoped and verify builds/tests when possible.',
        ''
    ].join('\n');
}

function buildFallbackContext(memory: any, projectPath: string, reason: string, maxTokens: number): string {
    const name = memory?.name || memory?.projectPath?.split(/[\\/]/).pop() || projectPath.split(/[\\/]/).pop() || 'Project';
    const metrics = memory?.metrics ?? {};
    const tech = metrics.techStack ?? {};
    const modules = metrics.moduleMap ?? [];
    const importantFiles = metrics.importantFiles ?? [];
    const archSummary = metrics.architectureSummary;
    const rules = memory?.architectureRules ?? [];
    const conventions = memory?.codingConventions ?? [];
    const decisions = memory?.systemDecisions ?? [];
    const deps = metrics.dependencies ?? [];
    const folders = memory?.folderStructure ?? [];

    const lines: string[] = [
        '# AI Context Brain Fallback Context',
        '',
        '## Fallback Notice',
        '- This file was generated locally because the optimized backend context request failed.',
        '- This is not the full Pro/Team quality context output.',
        `- Failure Reason: ${reason}`,
        `- Requested Context Capacity: ${maxTokens.toLocaleString()} tokens`,
        '',
        '## Project Identity',
        `- Project: ${name}`,
        `- Root Directory: ${memory?.projectPath || projectPath}`,
        `- Framework: ${memory?.framework || 'Unknown'}`,
        `- Architecture: ${memory?.architectureType || 'Unknown'}`,
        `- Database: ${knownOrScanRequired(memory?.databaseType)}`,
        `- Authentication: ${knownOrScanRequired(memory?.authSystem)}`,
        `- Files: ${metrics.filesCount ?? metrics.FilesCount ?? 0}`,
        `- Lines of Code: ${(metrics.linesOfCode ?? metrics.LinesOfCode ?? 0).toLocaleString()}`,
        '',
        '## Tech Stack',
        `- Frontend: ${tech.frontend?.name ?? 'Unknown'}`,
        `- Backend: ${tech.backend?.name ?? 'Unknown'}`,
        `- Database: ${knownOrScanRequired(tech.database?.name ?? memory?.databaseType)}`,
        `- Auth: ${knownOrScanRequired(tech.auth?.name ?? memory?.authSystem)}`,
        `- ORM: ${tech.orm?.name ?? 'Unknown'}`,
        `- Package Manager: ${tech.packageManager?.name ?? 'Unknown'}`
    ];

    if (archSummary) {
        lines.push(
            '',
            '## Architecture Summary',
            `- Style: ${archSummary.style}`,
            `- Data Flow: ${archSummary.dataFlowDescription}`,
            `- Business Logic: ${archSummary.businessLogicLocation}`,
            `- UI Logic: ${archSummary.uiLogicLocation}`,
            `- API Logic: ${archSummary.apiLogicLocation}`
        );
    }

    if (modules.length) {
        lines.push('', '## Module Map');
        modules.forEach((m: any) => lines.push(`- ${m.name}: ${m.purpose}`));
    }

    if (importantFiles.length) {
        lines.push('', '## Important Files');
        importantFiles.slice(0, 12).forEach((f: any) => lines.push(`- ${f.path}: ${f.importance} AI behavior: ${f.aiBehavior}`));
    }

    if (rules.length) {
        lines.push('', '## Architecture Rules');
        rules.forEach((r: any) => lines.push(`- ${r.name || r.Name}: ${r.pattern || r.Pattern || r.description || ''}`));
    }

    if (conventions.length) {
        lines.push('', '## Coding Conventions');
        conventions.forEach((c: any) => lines.push(`- ${c.name || c.Name}: ${c.rule || c.Rule || ''}`));
    }

    if (decisions.length) {
        lines.push('', '## System Decisions');
        decisions.forEach((d: any) => lines.push(`- ${d.title || d.Title}: ${d.decision || d.Decision || ''}`));
    }

    if (deps.length) {
        lines.push('', '## Dependencies');
        deps.slice(0, 30).forEach((d: string) => lines.push(`- ${d}`));
    }

    if (folders.length) {
        lines.push('', '## Folder Structure');
        folders.slice(0, 30).forEach((f: string) => lines.push(`- ${f}`));
    }

    lines.push(
        '',
        '## AI Coding Rules',
        '- Preserve the service/controller/UI boundaries already present in the repository.',
        '- Reuse existing backend services, frontend context providers, and extension command patterns.',
        '- Do not bypass server-side plan enforcement or tenant-safe auth checks.',
        '- Never commit secrets or provider keys; use environment variables.',
        '- Prefer small, verifiable changes and keep generated context fresh after structural changes.'
    );

    return lines.join('\n') + '\n';
}

function buildFallbackInstructions(memory: any, projectPath: string, reason: string): string {
    const name = memory?.name || projectPath.split(/[\\/]/).pop() || 'Project';
    return [
        '# AI Context Brain Instructions',
        '',
        '## Fallback Notice',
        '- Optimized backend instructions were unavailable.',
        `- Failure Reason: ${reason}`,
        '- Read .ai-context.md before editing, but treat it as fallback quality.',
        '',
        `## Repository: ${name}`,
        '- Preserve existing architecture and naming patterns.',
        '- Reuse existing services before creating new abstractions.',
        '- Do not hardcode secrets or bypass auth/plan checks.',
        '- Run available tests/builds before finalizing changes.',
        ''
    ].join('\n');
}

function knownOrScanRequired(value: any): string {
    if (typeof value !== 'string' || !value.trim() || value === 'Unknown' || value === 'Not detected') {
        return 'fresh scan required';
    }
    return value;
}

function filterContextByType(context: string, contextType: string): string {
    if (contextType === 'full' || contextType === 'compressed') return context;
    const wanted = contextType === 'architecture'
        ? ['Architecture', 'Module', 'Important Files', 'AI Coding Rules', 'Generation Metadata']
        : ['Coding', 'AI Coding Rules', 'Architecture Rules', 'Generation Metadata', 'Important Files'];

    const lines = context.split('\n');
    const kept: string[] = [];
    let include = true;
    for (const line of lines) {
        if (line.startsWith('## ')) {
            include = wanted.some(section => line.includes(section));
        }
        if (line.startsWith('# ')) include = true;
        if (include) kept.push(line);
    }
    return kept.join('\n').trim() + '\n';
}
