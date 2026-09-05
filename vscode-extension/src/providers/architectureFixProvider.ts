import * as vscode from 'vscode';

export class ArchitectureFixProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    /**
     * Provides quick-fix code actions for architecture violations
     */
    public provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            // Check if diagnostic is from our extension
            if (diagnostic.source === 'AI Context Brain' || diagnostic.source === 'aiContextBrain') {
                const ruleId = diagnostic.code ? (diagnostic.code as any).value : '';
                const ruleName = diagnostic.message.split(':')[0] || 'Rule';
                
                // 1. Create a "Fix with AI" quick fix action
                const fixAction = new vscode.CodeAction(`🧠 Fix with AI: ${diagnostic.message}`, vscode.CodeActionKind.QuickFix);
                fixAction.diagnostics = [diagnostic];
                fixAction.command = {
                    title: 'Apply AI Architecture Fix',
                    command: 'aiContextBrain.applyArchitectureFix',
                    arguments: [document.uri, diagnostic, ruleId]
                };
                actions.push(fixAction);

                // 2. Create a "Suppress rule" action
                const suppressAction = new vscode.CodeAction(`Suppress rule: ${ruleName}`, vscode.CodeActionKind.QuickFix);
                suppressAction.diagnostics = [diagnostic];
                
                const edit = new vscode.WorkspaceEdit();
                const commentText = this.getCommentText(document.languageId, `ai-context-brain-disable-line ${ruleId}`);
                
                edit.insert(document.uri, new vscode.Position(diagnostic.range.start.line, 0), `${commentText}\n`);
                suppressAction.edit = edit;
                
                actions.push(suppressAction);
            }
        }

        return actions;
    }

    private getCommentText(languageId: string, text: string): string {
        switch (languageId) {
            case 'csharp':
            case 'typescript':
            case 'javascript':
            case 'java':
            case 'go':
                return `// ${text}`;
            case 'python':
            case 'ruby':
                return `# ${text}`;
            default:
                return `/* ${text} */`;
        }
    }
}
