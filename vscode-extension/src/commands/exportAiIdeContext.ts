import * as vscode from 'vscode';
import * as path from 'path';
import { ApiClient } from '../services/apiClient';
import {
    generateOptimizedContext,
    getPlanTokenLimit,
    OPTIMISTIC_CONTEXT_TOKEN_LIMIT,
    writeContextFiles,
    writeEditorExport
} from '../services/contextExportService';

export class ExportAiIdeContextCommand {
    constructor(private apiClient?: ApiClient) {}

    async autoExport(projectPath: string): Promise<void> {
        if (!this.apiClient) {
            throw new Error('Backend authentication is required for optimized auto-export.');
        }

        const editor = this.detectEditor();
        const plan = await getPlanTokenLimit(this.apiClient).catch(() => ({ plan: 'Unknown', maxTokens: OPTIMISTIC_CONTEXT_TOKEN_LIMIT }));
        const result = await generateOptimizedContext(this.apiClient, projectPath, plan.maxTokens, 'full');
        await writeContextFiles(projectPath, result);
        const filePath = writeEditorExport(projectPath, editor, result);
        console.log(`[AI Context Brain] Auto-exported optimized context to ${filePath}`);
    }

    async execute(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }
        const isGuest = !this.apiClient || !this.apiClient.isAuthenticated();

        const projectPath = workspaceFolders[0].uri.fsPath;
        const detectedEditor = this.detectEditor();
        const detectedLabel = detectedEditor === 'cursor' ? 'Cursor' : detectedEditor === 'windsurf' ? 'Windsurf' : 'VS Code';

        const options = [
            `Auto (${detectedLabel} detected)`,
            'Cursor (.cursor/rules/)',
            'Windsurf (.windsurf/rules/)',
            'OpenAI Codex (AGENTS.md)',
            'GitHub Copilot (.github/copilot-instructions.md)',
            'Aider (CONVENTIONS.md)',
            'Claude Code (CLAUDE.md)',
            'Generic AI Instructions'
        ];

        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select AI IDE to export optimized instructions for'
        });
        if (!choice) return;

        try {
            const targetEditor = this.resolveEditor(choice, detectedEditor);
            const plan = this.apiClient
                ? await getPlanTokenLimit(this.apiClient).catch(() => ({ plan: 'Free', maxTokens: OPTIMISTIC_CONTEXT_TOKEN_LIMIT }))
                : { plan: 'Guest', maxTokens: OPTIMISTIC_CONTEXT_TOKEN_LIMIT };
            
            const result = this.apiClient
                ? await generateOptimizedContext(this.apiClient, projectPath, plan.maxTokens, 'full')
                : {
                    context: `# AI Context Brain (Guest Mode)\n\nProject: ${path.basename(projectPath)}\n\n---\n*Generated with [AI Context Brain](https://aicontextbrain.me) — Make your AI coding assistant 10x smarter.*`,
                    instructions: `# AI Instructions for ${path.basename(projectPath)}\n\nUse generated .ai-context.md before editing this codebase.`,
                    plan: 'Guest',
                    maxTokens: OPTIMISTIC_CONTEXT_TOKEN_LIMIT,
                    source: 'local_guest',
                    fallback: true
                };

            await writeContextFiles(projectPath, result);
            const filePath = writeEditorExport(projectPath, targetEditor, result);
            const relativePath = path.relative(projectPath, filePath);
            const sourceLabel = isGuest ? '✨ Guest Local Mode' : (result.fallback ? 'fallback' : `${result.plan} / ${result.source}`);

            const action = await vscode.window.showInformationMessage(
                `AI context exported to ${relativePath} (${sourceLabel}).`,
                'Open File',
                isGuest ? 'Sign In for 32k Deep Memory' : ''
            );

            if (action === 'Open File') {
                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);
            } else if (action === 'Sign In for 32k Deep Memory') {
                vscode.env.openExternal(vscode.Uri.parse('https://aicontextbrain.me/login'));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to export: ${errorMessage}`);
        }
    }

    private detectEditor(): string {
        const appName = vscode.env.appName?.toLowerCase() ?? '';
        if (appName.includes('cursor')) return 'cursor';
        if (appName.includes('windsurf')) return 'windsurf';
        return 'vscode';
    }

    private resolveEditor(choice: string, detectedEditor: string): string {
        if (choice.startsWith('Auto')) return detectedEditor;
        if (choice.includes('Cursor')) return 'cursor';
        if (choice.includes('Windsurf')) return 'windsurf';
        if (choice.includes('Codex')) return 'codex';
        if (choice.includes('Copilot')) return 'copilot';
        if (choice.includes('Aider')) return 'aider';
        if (choice.includes('Claude')) return 'claude';
        return 'generic';
    }
}
