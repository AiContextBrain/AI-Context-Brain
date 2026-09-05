import * as vscode from 'vscode';
import { ScanProjectCommand } from './commands/scanProject';
import { GenerateContextCommand } from './commands/generateContext';
import { ExportAiIdeContextCommand } from './commands/exportAiIdeContext';
import { NewProjectWizardCommand } from './commands/newProjectWizard';
import { ShowProjectMemoryCommand } from './commands/showProjectMemory';
import { AiExplainCommand } from './commands/aiExplain';
import { ApiClient } from './services/apiClient';
import { ProjectTreeProvider } from './providers/projectTreeProvider';
import { ArchitectureGuard } from './services/architectureGuard';
import { FileWatcher } from './services/fileWatcher';
import { ArchitectureFixProvider } from './providers/architectureFixProvider';

function getWebBase(): string {
    return vscode.workspace.getConfiguration('aiContextBrain').get<string>('webUrl') || 'https://aicontextbrain.me';
}
// ── Status bar item (global so we can update it anywhere)
let statusBarItem: vscode.StatusBarItem;
const PENDING_WIZARD_PROJECT_ID = 'aiContextBrain.pendingWizardProjectId';

function updateStatusBar(apiClient: ApiClient) {
    if (apiClient.isAuthenticated()) {
        statusBarItem.text = '$(check) AI Brain';
        statusBarItem.tooltip = 'AI Context Brain: Connected — click to open dashboard';
        statusBarItem.command = 'aiContextBrain.openDashboard';
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = '$(sign-in) AI Brain: Sign In';
        statusBarItem.tooltip = 'Click to sign in to AI Context Brain';
        statusBarItem.command = 'aiContextBrain.login';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    statusBarItem.show();
}

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Context Brain is now active!');

    const apiClient = new ApiClient(context);

    // ── Tree View
    const treeProvider = new ProjectTreeProvider(apiClient);
    vscode.window.registerTreeDataProvider('aiContextBrainProjectView', treeProvider);
    context.subscriptions.push(
        vscode.commands.registerCommand('aiContextBrain.refreshTree', () => treeProvider.refresh())
    );

    // ── Architecture Guard
    const archGuard = new ArchitectureGuard(apiClient);
    archGuard.initialize(context);
    AiExplainCommand.rememberEditor(vscode.window.activeTextEditor);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => AiExplainCommand.rememberEditor(editor))
    );

    // ── File Watcher (Background file synchronization)
    const fileWatcher = new FileWatcher();
    if (vscode.workspace.getConfiguration('aiContextBrain').get('autoSync', true)) {
        fileWatcher.initialize(context);
    }

    // ── "Fix with AI" Code Action QuickFix Provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file' },
            new ArchitectureFixProvider(),
            { providedCodeActionKinds: ArchitectureFixProvider.providedCodeActionKinds }
        )
    );

    // ── Command to apply fix
    context.subscriptions.push(
        vscode.commands.registerCommand('aiContextBrain.applyArchitectureFix', async (documentUri: vscode.Uri, diagnostic: vscode.Diagnostic, _ruleId: string) => {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Requesting AI fix...',
                cancellable: false
            }, async () => {
                try {
                    const document = await vscode.workspace.openTextDocument(documentUri);
                    const fileContent = document.getText();
                    const relativePath = vscode.workspace.asRelativePath(documentUri);

                    // Call backend suggest-fix
                    const fixResult = await apiClient.suggestFix({
                        filePath: relativePath,
                        fileContent: fileContent,
                        ruleName: diagnostic.message.split(':')[0] || 'Rule',
                        rulePattern: (diagnostic as any).rulePattern || '',
                        ruleType: (diagnostic as any).ruleType || 'Regex',
                        violationLine: diagnostic.range.start.line + 1,
                        autoFixSuggestion: (diagnostic as any).autoFixSuggestion || ''
                    });

                    if (fixResult && fixResult.suggestion) {
                        const option = await vscode.window.showInformationMessage(
                            `💡 AI Suggestion:\n${fixResult.suggestion}`,
                            'Apply Fix',
                            'Close'
                        );

                        if (option === 'Apply Fix') {
                            const edit = new vscode.WorkspaceEdit();
                            // If fixedContent is returned, replace whole content, otherwise show/insert suggestion
                            if (fixResult.fixedContent) {
                                edit.replace(documentUri, new vscode.Range(0, 0, document.lineCount, 0), fixResult.fixedContent);
                            } else {
                                // Default fallback: add comment suggestion on the line above
                                const commentText = `// AI Suggestion: ${fixResult.suggestion}`;
                                edit.insert(documentUri, new vscode.Position(diagnostic.range.start.line, 0), `${commentText}\n`);
                            }
                            await vscode.workspace.applyEdit(edit);
                        }
                    }
                } catch (e: any) {
                    vscode.window.showErrorMessage(`Failed to get fix suggestion: ${e?.message || e}`);
                }
            });
        })
    );

    // ── Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);

    const runPendingInitialization = async (): Promise<boolean> => {
        const projectId = context.globalState.get<string>(PENDING_WIZARD_PROJECT_ID);
        if (!projectId) return false;

        await apiClient.loadToken();
        if (!apiClient.isAuthenticated()) {
            const action = await vscode.window.showWarningMessage(
                'Sign in to connect the project created in AI Context Brain.',
                'Sign In',
                'Later'
            );
            if (action === 'Sign In') {
                await vscode.commands.executeCommand('aiContextBrain.login');
            }
            return false;
        }

        if (!vscode.workspace.workspaceFolders?.length) {
            const selected = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Use this project folder'
            });
            if (selected?.[0]) {
                await vscode.commands.executeCommand('vscode.openFolder', selected[0], false);
            }
            return false;
        }

        const completed = await new NewProjectWizardCommand(apiClient).initializeWithProjectId(projectId);
        await context.globalState.update(PENDING_WIZARD_PROJECT_ID, undefined);
        return completed;
    };

    // Handles login callbacks and one-click web wizard workspace initialization.
    const uriHandler = vscode.window.registerUriHandler({
        async handleUri(uri: vscode.Uri) {
            if (uri.path === '/auth') {
                const params = new URLSearchParams(uri.query);
                const token = params.get('token');
                if (token) {
                    await apiClient.saveTokenPublic(token);
                    updateStatusBar(apiClient);
                    if (context.globalState.get<string>(PENDING_WIZARD_PROJECT_ID)) {
                        await runPendingInitialization();
                    } else {
                        const action = await vscode.window.showInformationMessage(
                            'AI Context Brain: Logged in successfully.',
                            'Scan Project'
                        );
                        if (action === 'Scan Project') {
                            await vscode.commands.executeCommand('aiContextBrain.scanProject');
                        }
                    }
                } else {
                    vscode.window.showErrorMessage('Authorization failed: no token received.');
                }
                return;
            }

            if (uri.path === '/initialize') {
                const params = new URLSearchParams(uri.query);
                const projectId = params.get('projectId')?.trim() ?? '';
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
                    vscode.window.showErrorMessage('The project connection link is invalid or incomplete.');
                    return;
                }
                await context.globalState.update(PENDING_WIZARD_PROJECT_ID, projectId);
                await runPendingInitialization();
            }
        }
    });
    context.subscriptions.push(uriHandler);

    // ── Commands
    const commands = [

        // LOGIN — opens browser to web dashboard authorize page
        vscode.commands.registerCommand('aiContextBrain.login', async () => {
            const scheme = vscode.env.uriScheme;
            const callbackUri = `${scheme}://ai-project-brain.ai-project-brain/auth`;
            const authorizeUrl = `${getWebBase()}/authorize?redirect_uri=${encodeURIComponent(callbackUri)}&from=${scheme}`;
            await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));
            vscode.window.showInformationMessage(
                '🧠 A browser window has opened. Sign in and click "Authorize" to connect.',
                'Already done'
            );
        }),

        // REGISTER — opens browser to register tab
        vscode.commands.registerCommand('aiContextBrain.register', async () => {
            const scheme = vscode.env.uriScheme;
            const callbackUri = `${scheme}://ai-project-brain.ai-project-brain/auth`;
            const registerUrl = `${getWebBase()}/login?tab=register&from=${scheme}&returnUrl=${encodeURIComponent(`/authorize?redirect_uri=${encodeURIComponent(callbackUri)}`)}`;
            await vscode.env.openExternal(vscode.Uri.parse(registerUrl));
            vscode.window.showInformationMessage(
                '🧠 A browser window has opened. Create an account then click "Authorize".',
                'Already done'
            );
        }),

        // LOGOUT
        vscode.commands.registerCommand('aiContextBrain.logout', async () => {
            await apiClient.logout();
            updateStatusBar(apiClient);
            vscode.window.showInformationMessage('👋 Logged out from AI Context Brain');
        }),

        // CHECK LOGIN
        vscode.commands.registerCommand('aiContextBrain.checkLogin', async () => {
            if (apiClient.isAuthenticated()) {
                vscode.window.showInformationMessage('✅ AI Context Brain: You are signed in.');
            } else {
                const action = await vscode.window.showWarningMessage(
                    '🔒 Not signed in to AI Context Brain.',
                    'Sign In',
                    'Register',
                    'Later'
                );
                if (action === 'Sign In') vscode.commands.executeCommand('aiContextBrain.login');
                else if (action === 'Register') vscode.commands.executeCommand('aiContextBrain.register');
            }
        }),

        // OPEN DASHBOARD
        vscode.commands.registerCommand('aiContextBrain.openDashboard', () => {
            vscode.env.openExternal(vscode.Uri.parse(`${getWebBase()}/dashboard`));
        }),

        // SCAN PROJECT
        vscode.commands.registerCommand('aiContextBrain.scanProject', async () => {
            if (!apiClient.isAuthenticated()) {
                const action = await vscode.window.showWarningMessage(
                    '🔒 Sign in to AI Context Brain first.',
                    'Sign In', 'Cancel'
                );
                if (action === 'Sign In') vscode.commands.executeCommand('aiContextBrain.login');
                return;
            }
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }
            try {
                await new ScanProjectCommand(apiClient).execute();
            } catch (error: any) {
                vscode.window.showErrorMessage(`❌ Scan failed: ${error.message}`);
            }
        }),

        // GENERATE CONTEXT
        vscode.commands.registerCommand('aiContextBrain.generateContext', async () => {
            if (!apiClient.isAuthenticated()) {
                const action = await vscode.window.showWarningMessage(
                    '🔒 Sign in to AI Context Brain first.',
                    'Sign In', 'Cancel'
                );
                if (action === 'Sign In') vscode.commands.executeCommand('aiContextBrain.login');
                return;
            }
            try {
                await new GenerateContextCommand(apiClient).execute();
            } catch (error: any) {
                vscode.window.showErrorMessage(`❌ Context generation failed: ${error.message}`);
            }
        }),

        // EXPORT AI IDE CONTEXT
        vscode.commands.registerCommand('aiContextBrain.exportAiIdeContext', async () => {
            if (!apiClient.isAuthenticated()) {
                const action = await vscode.window.showWarningMessage(
                    '🔒 Sign in to export AI context with your project memory.',
                    'Sign In', 'Export without login'
                );
                if (action === 'Sign In') { vscode.commands.executeCommand('aiContextBrain.login'); return; }
            }
            try {
                await new ExportAiIdeContextCommand(apiClient).execute();
            } catch (error: any) {
                vscode.window.showErrorMessage(`❌ Export failed: ${error.message}`);
            }
        }),

        // SHOW PROJECT MEMORY PANEL
        vscode.commands.registerCommand('aiContextBrain.showProjectMemory', async () => {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }
            await new ShowProjectMemoryCommand(apiClient).execute();
        }),

        // NEW PROJECT WIZARD
        vscode.commands.registerCommand('aiContextBrain.newProjectWizard', async () => {
            await new NewProjectWizardCommand(apiClient).execute();
        }),

        // INITIALIZE LOCAL WORKSPACE
        vscode.commands.registerCommand('aiContextBrain.initializeLocalWorkspace', async (projectId?: string) => {
            const wizard = new NewProjectWizardCommand(apiClient);
            if (projectId) await wizard.initializeWithProjectId(projectId);
            else await wizard.initializeLocalOnly();
        }),

        // SHOW ROADMAP
        vscode.commands.registerCommand('aiContextBrain.showRoadmap', async () => {
            const panel = vscode.window.createWebviewPanel('roadmap', 'AI Context Brain — Roadmap', vscode.ViewColumn.One, {});
            panel.webview.html = getRoadmapHtml();
        }),

        // QUICK COPY CONTEXT
        vscode.commands.registerCommand('aiContextBrain.quickCopyContext', async () => {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }
            const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const contextFile = vscode.Uri.joinPath(vscode.Uri.file(projectPath), '.ai-context.md');
            try {
                const data = await vscode.workspace.fs.readFile(contextFile);
                await vscode.env.clipboard.writeText(Buffer.from(data).toString('utf-8'));
                vscode.window.showInformationMessage('AI Context copied. Paste it into Cursor, Claude Code, Copilot, Windsurf, Aider, or another AI assistant.');
            } catch {
                vscode.window.showInformationMessage('No .ai-context.md file found. Generating optimized context now...');
                await vscode.commands.executeCommand('aiContextBrain.generateContext');
            }
        }),

        // AI EXPLAIN CODE
        vscode.commands.registerCommand('aiContextBrain.aiExplain', async (target?: vscode.Uri) => {
            if (!apiClient.isAuthenticated()) {
                const action = await vscode.window.showWarningMessage(
                    '🔒 Sign in to use AI Context Brain explanations.',
                    'Sign In', 'Cancel'
                );
                if (action === 'Sign In') vscode.commands.executeCommand('aiContextBrain.login');
                return;
            }
            await new AiExplainCommand(apiClient).execute(target);
        })
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));

    // ── Startup
    const showSignInPrompt = async () => {
        const action = await vscode.window.showInformationMessage(
            '🧠 AI Context Brain: Sign in to start using AI context for your projects.',
            'Sign In',
            'Register',
            'Later'
        );
        if (action === 'Sign In') await vscode.commands.executeCommand('aiContextBrain.login');
        else if (action === 'Register') await vscode.commands.executeCommand('aiContextBrain.register');
    };

    setTimeout(async () => {
        await apiClient.loadToken();
        updateStatusBar(apiClient);

        if (context.globalState.get<string>(PENDING_WIZARD_PROJECT_ID)) {
            await runPendingInitialization();
        }

        // Show plan info in status bar if authenticated
        if (apiClient.isAuthenticated()) {
            try {
                const planInfo = await apiClient.getPlanFeatures();
                if (planInfo?.plan) {
                    statusBarItem.text = `$(check) AI Brain [${planInfo.plan}]`;
                    const autoScan = vscode.workspace.getConfiguration('aiContextBrain').get<boolean>('autoScan', false);
                    if (autoScan && vscode.workspace.workspaceFolders?.length) {
                        try {
                            await new ScanProjectCommand(apiClient).execute({ silent: true });
                        } catch (error) {
                            console.log('[AI Context Brain] Auto scan skipped:', error);
                        }
                    }
                    statusBarItem.tooltip = `AI Context Brain: ${planInfo.plan} plan — ${planInfo.usage?.scansUsed ?? 0}/${planInfo.features?.maxScansPerMonth ?? '?'} scans`;
                } else {
                    // Token is invalid/expired! Clear it completely.
                    await apiClient.logout();
                    updateStatusBar(apiClient);
                    await showSignInPrompt();
                }
            } catch {
                // Network offline/failure - do not clear the token
            }
        } else {
            await showSignInPrompt();
        }
    }, 1500);
}

export function deactivate() {
    console.log('AI Context Brain deactivated');
}

function getRoadmapHtml(): string {
    const shipped = [
        ['Scan Project', '✅ Shipped'],
        ['Generate AI Context', '✅ Shipped'],
        ['Export (Cursor/Copilot/ChatGPT)', '✅ Shipped'],
        ['Web Dashboard', '✅ Shipped'],
        ['Architecture Guard', '✅ Shipped'],
        ['Project Tree View', '✅ Shipped'],
        ['.brainignore Support', '✅ Shipped'],
        ['Incremental Scanning', '✅ Shipped'],
        ['Fix with AI', '✅ Shipped'],
        ['Background File Watcher', '✅ Shipped'],
        ['Custom Rules Engine', '✅ Shipped']
    ];
    const planned = [
        ['Advanced AI (GPT-4o / Claude / Gemini)', '🟡 Planned'],
        ['Team Workspace / Collaboration', '✅ Dashboard + API'],
        ['CI/CD + Docker Generation', '🟡 Planned'],
        ['Advanced Dashboard + Analytics', '🟡 Planned'],
        ['Real OAuth (GitHub / Google / Microsoft)', '🟡 Planned'],
    ];
    const rows = (items: string[][]) => items.map(([f, s]) =>
        `<tr><td style="padding:8px 12px">${f}</td><td style="padding:8px 12px;color:#8b91b3">${s}</td></tr>`
    ).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground);padding:24px;max-width:720px}
h1{font-size:1.5rem;margin-bottom:4px}h2{font-size:1.1rem;margin-top:28px;color:#4f7cff}
table{width:100%;border-collapse:collapse;margin-top:8px}
tr:nth-child(even){background:rgba(255,255,255,0.03)}
td{border-bottom:1px solid rgba(255,255,255,0.07);font-size:.875rem}
</style></head><body>
<h1>🧠 AI Context Brain — Roadmap</h1>
<p style="color:#8b91b3;font-size:.875rem">Current version: 1.3.0</p>
<h2>✅ Shipped Features</h2>
<table><tbody>${rows(shipped)}</tbody></table>
<h2>🟡 Planned Features</h2>
<table><tbody>${rows(planned)}</tbody></table>
<p style="margin-top:32px;font-size:.8rem;color:#8b91b3">Full roadmap: <a href="https://github.com/AiContextBrain/AI-Context-Brain/blob/main/ROADMAP.md" style="color:#4f7cff">github.com/AiContextBrain/AI-Context-Brain</a></p>
</body></html>`;
}
