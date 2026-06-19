import * as vscode from 'vscode';
import { ApiClient } from '../services/apiClient';
import { generateOptimizedContext, getPlanTokenLimit, OPTIMISTIC_CONTEXT_TOKEN_LIMIT, writeContextFiles } from '../services/contextExportService';

export class GenerateContextCommand {
    constructor(private apiClient: ApiClient) {}

    async execute(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const projectPath = workspaceFolders[0].uri.fsPath;
        const plan = await getPlanTokenLimit(this.apiClient).catch(() => ({ plan: 'Unknown', maxTokens: OPTIMISTIC_CONTEXT_TOKEN_LIMIT }));
        const fullContextLabel = `Generate Deep Context (100% ${plan.plan} capacity)`;

        const options = [
            fullContextLabel,
            'Generate Basic Context (compact capacity)',
            'Generate Architecture Context Only',
            'Generate Coding Context Only',
            'Custom Capacity Percentage'
        ];

        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select context generation option'
        });
        if (!choice) return;

        let maxTokens = plan.maxTokens;
        let contextType = 'full';

        if (choice === 'Generate Basic Context (compact capacity)') {
            maxTokens = Math.min(2000, plan.maxTokens);
            contextType = 'compressed';
        } else if (choice === 'Generate Architecture Context Only') {
            maxTokens = Math.min(4000, plan.maxTokens);
            contextType = 'architecture';
        } else if (choice === 'Generate Coding Context Only') {
            maxTokens = Math.min(4000, plan.maxTokens);
            contextType = 'coding';
        } else if (choice === 'Custom Capacity Percentage') {
            const customLimit = await vscode.window.showInputBox({
                prompt: 'Enter context capacity percentage for this generation (1-100)',
                validateInput: (value) => {
                    const num = parseInt(value, 10);
                    if (isNaN(num) || num < 1 || num > 100) {
                        return 'Please enter a percentage between 1 and 100';
                    }
                    return null;
                }
            });
            if (!customLimit) return;
            maxTokens = Math.max(100, Math.round(plan.maxTokens * (parseInt(customLimit, 10) / 100)));
        }

        await this.generateAndWrite(projectPath, maxTokens, contextType, true);
    }

    async generateAndWrite(projectPath: string, maxTokens?: number, contextType: string = 'full', openFile: boolean = false): Promise<void> {
        const plan = await getPlanTokenLimit(this.apiClient).catch(() => ({ plan: 'Unknown', maxTokens: OPTIMISTIC_CONTEXT_TOKEN_LIMIT }));
        const tokenLimit = maxTokens ?? plan.maxTokens;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating AI Context',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 15, message: 'Generating optimized context from backend...' });
            const result = await generateOptimizedContext(this.apiClient, projectPath, tokenLimit, contextType);

            progress.report({ increment: 70, message: 'Saving .ai-context.md and AI_INSTRUCTIONS.md...' });
            await writeContextFiles(projectPath, result);

            if (openFile) {
                progress.report({ increment: 90, message: 'Opening context file...' });
                const contextUri = vscode.Uri.joinPath(vscode.Uri.file(projectPath), '.ai-context.md');
                const document = await vscode.workspace.openTextDocument(contextUri);
                await vscode.window.showTextDocument(document);
            }

            progress.report({ increment: 100, message: 'Done!' });
            const sourceLabel = result.fallback ? 'fallback' : `${result.plan} / ${result.source}`;
            const utilization = result.maxTokens ? Math.min(100, Math.round((Math.round(result.context.length / 4) / result.maxTokens) * 100)) : 0;
            const action = await vscode.window.showInformationMessage(
                `AI context generated (${sourceLabel}). Context usage: ${utilization}%.`,
                'Copy to Clipboard',
                'View Context Details',
                'Generate Another'
            );

            if (action === 'Copy to Clipboard') {
                await vscode.env.clipboard.writeText(result.context);
                vscode.window.showInformationMessage('Context copied to clipboard');
            } else if (action === 'View Context Details') {
                await this.showContextDetails(result.context, contextType, result.maxTokens, result);
            } else if (action === 'Generate Another') {
                await this.execute();
            }

            if (plan.maxTokens <= 2000) {
                vscode.window.showInformationMessage(
                    'Free plan: compact context capacity. Upgrade to Pro for deep optimized context.',
                    'Upgrade'
                ).then(upgradeAction => {
                    if (upgradeAction === 'Upgrade') {
                        vscode.env.openExternal(vscode.Uri.parse('https://aicontextbrain.me/pricing'));
                    }
                });
            }
        });
    }

    private async showContextDetails(context: string, contextType: string, maxTokens: number, result: any): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'contextDetails',
            'AI Context Details',
            vscode.ViewColumn.One,
            {}
        );

        const estimatedUsage = Math.min(100, Math.round((Math.round(context.length / 4) / maxTokens) * 100));
        const lines = context.split('\n').length;
        const warnings = Array.isArray(result.validation?.warnings) ? result.validation.warnings : [];

        panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Context Details</title>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
                h1 { color: var(--vscode-foreground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
                .metric { background: var(--vscode-editor-background); padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid var(--vscode-charts-blue); }
                pre { background: var(--vscode-textBlockQuote-background); padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <h1>AI Context Details</h1>
            <div class="metric">
                <strong>Plan:</strong> ${result.plan}<br>
                <strong>Source:</strong> ${result.source}${result.fallback ? ' (fallback)' : ''}<br>
                <strong>Context Type:</strong> ${contextType}<br>
                <strong>Context Capacity:</strong> 100% of selected plan allowance<br>
                <strong>Characters:</strong> ${context.length.toLocaleString()}<br>
                <strong>Lines:</strong> ${lines.toLocaleString()}<br>
                <strong>Context Usage:</strong> ${estimatedUsage}%<br>
                <strong>Validation Warnings:</strong> ${warnings.length ? warnings.join('; ') : 'none'}
            </div>
            <h2>Context Preview</h2>
            <pre>${escapeHtml(context.substring(0, 3000))}${context.length > 3000 ? '\n\n... (truncated for preview)' : ''}</pre>
        </body>
        </html>`;
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
