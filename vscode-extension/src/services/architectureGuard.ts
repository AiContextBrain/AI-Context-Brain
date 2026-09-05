import * as vscode from 'vscode';
import { ApiClient } from './apiClient';
import ts from 'typescript';
import { analyzeTypeScriptLayerImports } from './codeIntelligenceAnalyzer';

export class ArchitectureGuard {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(private apiClient: ApiClient) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('aiContextBrain');
    }

    initialize(context: vscode.ExtensionContext): void {
        let timer: NodeJS.Timeout | undefined;
        
        // Listen for document changes (debounced to avoid performance storms)
        const changeSub = vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
            if (this.shouldValidateDocument(event.document)) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(async () => {
                    await this.validateDocument(event.document);
                }, 500);
            }
        });
        context.subscriptions.push(changeSub);

        // Listen for document saves
        const saveSub = vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
            if (this.shouldValidateDocument(document)) {
                await this.validateDocument(document);
            }
        });
        context.subscriptions.push(saveSub);

        // Listen for document opens
        const openSub = vscode.workspace.onDidOpenTextDocument(async (document: vscode.TextDocument) => {
            if (this.shouldValidateDocument(document)) {
                await this.validateDocument(document);
            }
        });
        context.subscriptions.push(openSub);
        context.subscriptions.push(this.diagnosticCollection);
    }

    private shouldValidateDocument(document: vscode.TextDocument): boolean {
        // Only validate code files
        const validLanguages = ['typescript', 'javascript', 'csharp', 'python', 'java', 'php', 'go', 'rust'];
        return validLanguages.includes(document.languageId);
    }

    async validateDocument(document: vscode.TextDocument): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        const projectPath = workspaceFolders[0].uri.fsPath;
        const filePath = document.uri.fsPath;

        try {
            // Basic validation without backend for real-time feedback
            const diagnostics = await this.performLocalValidation(document, projectPath);

            // If we have backend connection, perform advanced validation
            const backendValidation = await this.performBackendValidation(projectPath, filePath, document.getText());
            diagnostics.push(...backendValidation);

            // Show diagnostics
            this.diagnosticCollection.set(document.uri, diagnostics);

        } catch (error) {
            console.error('Validation error:', error);
        }
    }

    private async performLocalValidation(document: vscode.TextDocument, projectPath: string): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        const content = document.getText();
        const relativePath = document.uri.fsPath.substring(projectPath.length + 1);

        // Framework-specific validations
        const language = document.languageId;
        
        if (language === 'typescript' || language === 'javascript') {
            diagnostics.push(...this.validateTypeScript(content, relativePath));
        } else if (language === 'csharp') {
            diagnostics.push(...this.validateCSharp(content, relativePath));
        } else if (language === 'python') {
            diagnostics.push(...this.validatePython(content, relativePath));
        }

        // Architecture pattern validations
        diagnostics.push(...this.validateArchitecture(content, relativePath));

        return diagnostics;
    }

    private validateTypeScript(content: string, filePath: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const source = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true,
            filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );
        const add = (node: ts.Node, message: string, code: string): void => {
            const start = source.getLineAndCharacterOfPosition(node.getStart(source));
            const end = source.getLineAndCharacterOfPosition(node.getEnd());
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(start.line, start.character, end.line, end.character),
                message,
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = code;
            diagnostic.source = 'AI Context Brain AST';
            diagnostics.push(diagnostic);
        };
        const visit = (node: ts.Node): void => {
            if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.Let) === 0 && (node.flags & ts.NodeFlags.Const) === 0) {
                add(node, "Use 'const' or 'let' instead of 'var'", 'AI-TS001');
            }
            if (ts.isCatchClause(node) && node.block.statements.length === 0) {
                add(node.block, 'Empty catch block - handle exceptions properly', 'AI-TS002');
            }
            if (ts.isBinaryExpression(node)
                && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
                && ts.isPropertyAccessExpression(node.left)
                && node.left.expression.getText(source).startsWith('this.state')) {
                add(node.left, 'Use setState instead of direct state mutation', 'AI-REACT001');
            }
            if (ts.isCallExpression(node)
                && ts.isIdentifier(node.expression)
                && node.expression.text === 'eval') {
                add(node, 'Avoid eval(); it bypasses static analysis and can execute untrusted code', 'AI-TS003');
            }
            ts.forEachChild(node, visit);
        };
        visit(source);

        for (const violation of analyzeTypeScriptLayerImports(content, filePath)) {
            const start = source.getLineAndCharacterOfPosition(violation.start);
            const end = source.getLineAndCharacterOfPosition(violation.start + violation.length);
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(start.line, start.character, end.line, end.character),
                violation.message,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.code = 'AI-ARCH-IMPORT';
            diagnostic.source = 'AI Context Brain AST';
            diagnostics.push(diagnostic);
        }

        const parseDiagnostics = (source as ts.SourceFile & { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
        for (const diagnostic of parseDiagnostics) {
            const start = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            const item = new vscode.Diagnostic(
                new vscode.Range(start.line, start.character, start.line, start.character + Math.max(1, diagnostic.length ?? 1)),
                `TypeScript syntax: ${message}`,
                vscode.DiagnosticSeverity.Error
            );
            item.code = 'AI-TS-SYNTAX';
            item.source = 'AI Context Brain AST';
            diagnostics.push(item);
        }

        return diagnostics;
    }

    private validateCSharp(content: string, _filePath: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        // Check for async without await
        const asyncRegex = /\basync\b/g;
        let match;
        while ((match = asyncRegex.exec(content)) !== null) {
            // Check if there's an await after this async
            const afterAsync = content.substring(match.index, Math.min(match.index + 500, content.length));
            if (!afterAsync.includes('await')) {
                const position = this.getPosition(content, match.index);
                const range = new vscode.Range(position, position.translate(0, 5));
                const diagnostic = new vscode.Diagnostic(
                    range,
                    "Async method should contain await operator",
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = 'AI-CS001';
                diagnostic.source = 'AI Context Brain';
                diagnostics.push(diagnostic);
            }
        }

        // Check for empty catch blocks
        const catchRegex = /catch\s*\([^)]*\)\s*\{\s*\}/g;
        while ((match = catchRegex.exec(content)) !== null) {
            const position = this.getPosition(content, match.index);
            const range = new vscode.Range(position, position.translate(0, match[0].length));
            const diagnostic = new vscode.Diagnostic(
                range,
                'Empty catch block - handle exceptions properly',
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = 'AI-CS002';
            diagnostic.source = 'AI Context Brain';
            diagnostics.push(diagnostic);
        }

        return diagnostics;
    }

    private validatePython(content: string, _filePath: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        // Check for bare except clauses
        const bareExceptRegex = /except\s*:/g;
        let match;
        while ((match = bareExceptRegex.exec(content)) !== null) {
            const position = this.getPosition(content, match.index);
            const range = new vscode.Range(position, position.translate(0, match[0].length));
            const diagnostic = new vscode.Diagnostic(
                range,
                "Use 'except Exception:' instead of bare 'except:'",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = 'AI-PY001';
            diagnostic.source = 'AI Context Brain';
            diagnostics.push(diagnostic);
        }

        // Check for unused imports (basic check)
        const importRegex = /^import\s+(\w+)/gm;
        while ((match = importRegex.exec(content)) !== null) {
            const importedName = match[1];
            const importIndex = content.indexOf(match[0]);
            const afterImport = content.substring(importIndex + match[0].length);
            
            // Check if the imported module is used
            const usageRegex = new RegExp(`\\b${importedName}\\b`, 'g');
            const usages = afterImport.match(usageRegex);
            
            if (!usages || usages.length <= 1) {
                const position = this.getPosition(content, importIndex);
                const range = new vscode.Range(position, position.translate(0, match[0].length));
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Import '${importedName}' appears to be unused`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = 'AI-PY002';
                diagnostic.source = 'AI Context Brain';
                diagnostics.push(diagnostic);
            }
        }

        return diagnostics;
    }

    private validateArchitecture(content: string, filePath: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        // Check for Clean Architecture violations
        if (filePath.includes('Domain') && (filePath.includes('Infrastructure') || filePath.includes('Application'))) {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                "Domain layer should not depend on other layers",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = 'AI-ARCH001';
            diagnostic.source = 'AI Context Brain';
            diagnostics.push(diagnostic);
        }

        // Check for MVC violations
        if (filePath.includes('Models') && filePath.includes('Views')) {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                "Models should not be placed in Views folder",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = 'AI-ARCH002';
            diagnostic.source = 'AI Context Brain';
            diagnostics.push(diagnostic);
        }

        // Check for proper file naming conventions
        const filename = filePath.split(/[\\/]/).pop() || '';
        
        if (filename.includes('Component') && !this.isPascalCase(filename)) {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                "Component files should use PascalCase naming",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = 'AI-NAMING001';
            diagnostic.source = 'AI Context Brain';
            diagnostics.push(diagnostic);
        }

        return diagnostics;
    }

    private async performBackendValidation(projectPath: string, filePath: string, content: string): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];

        try {
            const result = await this.apiClient.validateArchitecture(projectPath, filePath, content);
            
            if (result && result.violations && result.violations.length > 0) {
                // Get project memory to fetch rule metadata
                const memory = await this.apiClient.getProjectMemory(projectPath);
                const rules = memory?.architectureRules || [];

                for (const violation of result.violations) {
                    let ruleId = 'AI-BACKEND001';
                    let severity = vscode.DiagnosticSeverity.Warning;
                    let autoFixSuggestion = '';
                    let ruleType = 'Regex';
                    let rulePattern = '';

                    // Find corresponding rule in memory
                    const matchedRule = rules.find((r: any) => 
                        violation.includes(r.name) || violation.includes(r.pattern)
                    );

                    if (matchedRule) {
                        ruleId = matchedRule.id;
                        ruleType = matchedRule.ruleType || 'Regex';
                        rulePattern = matchedRule.pattern || '';
                        autoFixSuggestion = matchedRule.autoFixSuggestion || '';
                        
                        if (matchedRule.severity === 'Error') {
                            severity = vscode.DiagnosticSeverity.Error;
                        } else if (matchedRule.severity === 'Info') {
                            severity = vscode.DiagnosticSeverity.Information;
                        }
                    }

                    const range = new vscode.Range(0, 0, 0, 1);
                    const diagnostic = new vscode.Diagnostic(range, violation, severity);
                    
                    // Attach metadata
                    diagnostic.code = { value: ruleId, target: vscode.Uri.parse(`https://aicontextbrain.me/rules/${ruleId}`) };
                    diagnostic.source = 'AI Context Brain';
                    
                    // Add custom metadata for the code action fix provider
                    (diagnostic as any).ruleType = ruleType;
                    (diagnostic as any).rulePattern = rulePattern;
                    (diagnostic as any).autoFixSuggestion = autoFixSuggestion;

                    diagnostics.push(diagnostic);
                }
            }
        } catch (error) {
            console.log('Backend validation not available:', error);
        }

        return diagnostics;
    }

    private getPosition(content: string, offset: number): vscode.Position {
        const lines = content.substring(0, offset).split('\n');
        const lineNumber = lines.length - 1;
        const characterNumber = lines[lines.length - 1].length;
        return new vscode.Position(lineNumber, characterNumber);
    }

    private isPascalCase(str: string): boolean {
        return /^[A-Z][a-zA-Z0-9]*$/.test(str.replace(/\.[^/.]+$/, ''));
    }

    clearDiagnostics(): void {
        this.diagnosticCollection.clear();
    }
}
