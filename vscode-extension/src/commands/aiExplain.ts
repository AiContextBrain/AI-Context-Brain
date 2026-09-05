import * as vscode from 'vscode';
import * as path from 'path';
import { ApiClient } from '../services/apiClient';

interface ExplainPayload {
    selectedCode: string;
    surroundingCode: string;
    language: string;
    selectionStartLine: number;
    selectionEndLine: number;
}

export class AiExplainCommand {
    private static lastTextEditor: vscode.TextEditor | undefined;
    private apiClient: ApiClient;

    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
    }

    public static rememberEditor(editor: vscode.TextEditor | undefined): void {
        if (editor && AiExplainCommand.isExplainableEditor(editor)) {
            AiExplainCommand.lastTextEditor = editor;
        }
    }

    async execute(target?: vscode.Uri): Promise<void> {
        const editor = await this.resolveEditor(target);
        if (!editor) {
            vscode.window.showInformationMessage('Open a code file, select code or place the cursor on a line, then run Explain Code.');
            return;
        }

        const payload = this.buildExplainPayload(editor);
        if (!payload.selectedCode) {
            vscode.window.showInformationMessage('Select code or place the cursor on a non-empty code line to explain.');
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri) ?? vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const projectPath = workspaceFolder.uri.fsPath;
        const filePath = editor.document.uri.scheme === 'file'
            ? path.relative(projectPath, editor.document.uri.fsPath).replace(/\\/g, '/')
            : editor.document.uri.toString();

        const modes = [
            { label: '⚡ Quick Explain', description: 'Fast summary using local project memory (No AI cost)', id: 'quick' },
            { label: '🧠 Deep Explain', description: 'Architecture-aware relationships, services & routes (Pro & Team)', id: 'deep' },
            { label: '🔍 Deep Explain + Review', description: 'Deep security, performance, SOLID & code smells review (Team only)', id: 'review' }
        ];

        const selectedMode = await vscode.window.showQuickPick(modes, {
            placeHolder: 'Select explanation depth'
        });

        if (!selectedMode) {
            return; // User cancelled
        }

        await this.runExplanation(projectPath, filePath, payload, selectedMode.id, false);
    }

    private async runExplanation(
        projectPath: string,
        filePath: string,
        payload: ExplainPayload,
        mode: string,
        forceEscalate: boolean = false
    ): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `AI Context Brain: Explaining code (${mode === 'quick' ? 'Quick' : mode === 'deep' ? 'Deep' : 'Review'})...`,
                cancellable: false
            }, async (_progress) => {
                const response = await fetch(`${this.apiClient.getApiUrl()}/architectureguard/ai-explain`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${await this.apiClient.loadToken().then(() => (this.apiClient as any).token)}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        projectPath,
                        filePath,
                        codeSnippet: payload.selectedCode,
                        surroundingCode: payload.surroundingCode,
                        language: payload.language,
                        selectionStartLine: payload.selectionStartLine,
                        selectionEndLine: payload.selectionEndLine,
                        mode,
                        forceEscalate
                    })
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    if (response.status === 429) {
                        throw new Error(`${err.message || 'Limit reached'}. Used: ${err.used}/${err.limit}. Resets: ${err.resetDate ? new Date(err.resetDate).toLocaleDateString() : 'soon'}`);
                    }
                    if (response.status === 403) {
                        vscode.window.showErrorMessage(`Upgrade Required: ${err.message}`, 'Upgrade').then(sel => {
                            if (sel === 'Upgrade') {
                                vscode.env.openExternal(vscode.Uri.parse(err.upgradeUrl || 'https://aicontextbrain.me/pricing'));
                            }
                        });
                        return;
                    }
                    throw new Error(err.error || err.message || 'Explanation failed');
                }

                const data = await response.json();
                
                // Show the result in a new document panel
                const doc = await vscode.workspace.openTextDocument({
                    content: `# AI Context Brain Explanation\n\n**File:** \`${filePath}\`\n**Lines:** ${payload.selectionStartLine}-${payload.selectionEndLine}\n**Mode:** ${mode === 'quick' ? '⚡ Quick Explain' : mode === 'deep' ? '🧠 Deep Explain' : '🔍 Deep Explain + Review'}\n**Source:** ${data.source === 'deterministic-metadata' ? 'Local Project Memory (0 Token)' : 'Hybrid AI'}\n\n${data.explanation}`,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });

                // If it was a deterministic metadata response, suggest escalation
                if (data.source === 'deterministic-metadata') {
                    vscode.window.showInformationMessage(
                        `⚡ Quick Explain generated from local metadata. Need deeper analysis?`,
                        '🧠 Deep Explain',
                        '🔍 Deep Explain + Review'
                    ).then(async (selection) => {
                        if (selection === '🧠 Deep Explain') {
                            await this.runExplanation(projectPath, filePath, payload, 'deep', true);
                        } else if (selection === '🔍 Deep Explain + Review') {
                            await this.runExplanation(projectPath, filePath, payload, 'review', true);
                        }
                    });
                }
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`❌ AI Explain failed: ${error.message}`);
        }
    }

    private async resolveEditor(target?: vscode.Uri): Promise<vscode.TextEditor | undefined> {
        if (target) {
            const document = await vscode.workspace.openTextDocument(target);
            return vscode.window.showTextDocument(document, { preview: true, preserveFocus: false });
        }

        const active = vscode.window.activeTextEditor;
        if (active && AiExplainCommand.isExplainableEditor(active)) {
            AiExplainCommand.rememberEditor(active);
            return active;
        }

        const visibleWithSelection = vscode.window.visibleTextEditors.find(editor =>
            AiExplainCommand.isExplainableEditor(editor) && !editor.selection.isEmpty
        );
        if (visibleWithSelection) {
            AiExplainCommand.rememberEditor(visibleWithSelection);
            return visibleWithSelection;
        }

        const visibleCodeEditor = vscode.window.visibleTextEditors.find(editor => AiExplainCommand.isExplainableEditor(editor));
        if (visibleCodeEditor) {
            AiExplainCommand.rememberEditor(visibleCodeEditor);
            return visibleCodeEditor;
        }

        return AiExplainCommand.lastTextEditor;
    }

    private static isExplainableEditor(editor: vscode.TextEditor): boolean {
        return editor.document.uri.scheme === 'file' || editor.document.uri.scheme === 'untitled';
    }

    private buildExplainPayload(editor: vscode.TextEditor): ExplainPayload {
        const selectedText = editor.document.getText(editor.selection);
        if (selectedText.trim().length > 0) {
            const startLine = editor.selection.start.line;
            const endLine = Math.max(startLine, editor.selection.end.character === 0 ? editor.selection.end.line - 1 : editor.selection.end.line);
            return {
                selectedCode: selectedText.trim(),
                surroundingCode: this.getSurroundingCode(editor, startLine, endLine),
                language: this.resolveLanguage(editor.document),
                selectionStartLine: startLine + 1,
                selectionEndLine: endLine + 1
            };
        }

        const line = editor.document.lineAt(editor.selection.active.line);
        const activeLine = editor.selection.active.line;
        const selectedCode = line.text.trim().length > 0 ? line.text : '';
        return {
            selectedCode,
            surroundingCode: selectedCode ? this.getSurroundingCode(editor, activeLine, activeLine) : '',
            language: this.resolveLanguage(editor.document),
            selectionStartLine: activeLine + 1,
            selectionEndLine: activeLine + 1
        };
    }

    private getSurroundingCode(editor: vscode.TextEditor, startLine: number, endLine: number): string {
        const before = 80;
        const after = 100;
        const maxChars = 22000;
        const firstLine = Math.max(0, startLine - before);
        const lastLine = Math.min(editor.document.lineCount - 1, endLine + after);
        const lines: string[] = [];

        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
            const marker = lineNumber >= startLine && lineNumber <= endLine ? '>>>' : '   ';
            const lineLabel = String(lineNumber + 1).padStart(5, ' ');
            lines.push(`${marker} ${lineLabel}: ${editor.document.lineAt(lineNumber).text}`);
        }

        let content = lines.join('\n');
        if (content.length > maxChars) {
            const half = Math.floor(maxChars / 2);
            content = `${content.slice(0, half)}\n\n... surrounding code truncated around selection ...\n\n${content.slice(-half)}`;
        }

        return content;
    }

    private resolveLanguage(document: vscode.TextDocument): string {
        if (document.languageId && document.languageId !== 'plaintext') {
            return document.languageId;
        }

        const ext = path.extname(document.uri.fsPath || '').toLowerCase();
        const byExtension: Record<string, string> = {
            '.cs': 'csharp',
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.go': 'go',
            '.java': 'java',
            '.php': 'php',
            '.rb': 'ruby',
            '.rs': 'rust',
            '.json': 'json',
            '.md': 'markdown'
        };

        return byExtension[ext] || 'code';
    }
}
