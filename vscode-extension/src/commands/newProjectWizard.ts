import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../services/apiClient';
import { GenerateContextCommand } from './generateContext';
import { ExportAiIdeContextCommand } from './exportAiIdeContext';
import { ScanProjectCommand } from './scanProject';
import { ProjectScaffoldService } from '../services/projectScaffoldService';

export class NewProjectWizardCommand {
    constructor(private apiClient: ApiClient) {}

    async execute(): Promise<void> {
        const webUrl = vscode.workspace.getConfiguration('aiContextBrain').get<string>('webUrl') || 'https://aicontextbrain.me';
        let wizardUrl = `${webUrl}/dashboard?wizard=true`;
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const folderName = path.basename(workspaceFolders[0].uri.fsPath);
            wizardUrl += `&projectName=${encodeURIComponent(folderName)}`;
        }

        await vscode.env.openExternal(vscode.Uri.parse(wizardUrl));
        
        vscode.window.showInformationMessage(
            'Opening Setup Wizard in your browser. When complete, click Open in VS Code to initialize the active workspace automatically.',
            'Got it'
        );
    }

    async initializeLocalOnly(): Promise<void> {
        const projectId = await vscode.window.showInputBox({
            prompt: 'Enter the Project ID generated from the Web Setup Wizard',
            placeHolder: 'e.g. 550e8400-e29b-41d4-a716-446655440000',
            ignoreFocusOut: true,
            validateInput: (val) => {
                if (!val || !val.trim()) {
                    return 'Project ID is required.';
                }
                return null;
            }
        });

        if (!projectId) {
            return;
        }

        await this.initializeWithProjectId(projectId);
    }

    async initializeWithProjectId(projectId: string): Promise<boolean> {
        await this.apiClient.loadToken();
        if (!this.apiClient.isAuthenticated()) {
            const action = await vscode.window.showWarningMessage(
                'Sign in to AI Context Brain to connect this project.',
                'Sign In',
                'Cancel'
            );
            if (action === 'Sign In') {
                await vscode.commands.executeCommand('aiContextBrain.login');
            }
            return false;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders?.length) {
            vscode.window.showErrorMessage('Open the project folder in VS Code before connecting it.');
            return false;
        }

        return this.initializeFromWeb(workspaceFolders[0].uri.fsPath, projectId.trim());
    }

    private async initializeFromWeb(projectPath: string, projectId: string): Promise<boolean> {

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Initializing workspace from Web Setup blueprint...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 10, message: 'Fetching project blueprint from cloud...' });
                const memory = await this.apiClient.getWizardBlueprint(projectId.trim());

                if (!memory) {
                    throw new Error(`No project blueprint found for ID: "${projectId.trim()}"`);
                }

                const localProjectName = path.basename(path.resolve(projectPath));
                progress.report({ increment: 20, message: 'Linking local workspace to cloud project...' });
                const initResult = await this.apiClient.initializeLocal(projectId.trim(), projectPath, localProjectName);

                progress.report({ increment: 30, message: 'Creating runnable starter files...' });
                const scaffold = new ProjectScaffoldService().create(projectPath, memory);

                progress.report({ increment: 50, message: 'Generating configuration templates...' });
                
                // Generate .gitignore if missing
                const gitignorePath = path.join(projectPath, '.gitignore');
                if (!fs.existsSync(gitignorePath)) {
                    const gitignoreContent = this.generateGitignore(memory.framework || '');
                    fs.writeFileSync(gitignorePath, gitignoreContent);
                }

                // Generate .brainignore if missing
                const brainignorePath = path.join(projectPath, '.brainignore');
                if (!fs.existsSync(brainignorePath)) {
                    const brainignoreContent = `# AI Context Brain - Ignore File\n# Exclude build artifacts and dependencies from AI context scanning\n\nbuild/\ndist/\nout/\nbin/\nobj/\nnode_modules/\nvendor/\n__pycache__/\n*.pyc\n`;
                    fs.writeFileSync(brainignorePath, brainignoreContent, 'utf8');
                }

                // Generate basic .env.example
                const envExamplePath = path.join(projectPath, '.env.example');
                if (!fs.existsSync(envExamplePath)) {
                    fs.writeFileSync(
                        envExamplePath,
                        this.generateEnvExample(
                            memory.framework || '',
                            memory.databaseType || 'None',
                            memory.authSystem || 'None'
                        ),
                        'utf8'
                    );
                }

                progress.report({ increment: 70, message: 'Creating project README & roadmap...' });
                const readmePath = path.join(projectPath, 'README.md');
                const blueprintPath = path.join(projectPath, 'AI_CONTEXT_BRAIN_BLUEPRINT.md');
                const projectDocumentPath = fs.existsSync(readmePath) ? blueprintPath : readmePath;
                const name = localProjectName;
                const framework = memory.framework || 'Unknown';
                const arch = memory.architectureType || 'Unknown';
                const db = memory.databaseType || 'None';
                const auth = memory.authSystem || 'None';

                let readmeContent = `# ${name}\n\n`;
                readmeContent += `Welcome to your new project! This workspace was created and structured using the **AI Context Brain Project Setup Wizard**.\n\n`;
                readmeContent += `## Architecture Overview\n`;
                readmeContent += `- **Framework / Tech Stack**: ${framework}\n`;
                readmeContent += `- **Architecture Design**: ${arch}\n`;
                readmeContent += `- **Database Persistence**: ${db}\n`;
                readmeContent += `- **Authentication System**: ${auth}\n\n`;

                if (Array.isArray(memory.systemDecisions) && memory.systemDecisions.length > 0) {
                    readmeContent += `## System Architecture Decisions\n\n`;
                    for (const decision of memory.systemDecisions) {
                        readmeContent += `### 📌 ${decision.title}\n`;
                        readmeContent += `> **Category**: ${decision.category || 'General'}\n\n`;
                        readmeContent += `${decision.decision}\n\n`;
                    }
                }

                let projectDocumentCreated = false;
                if (!fs.existsSync(projectDocumentPath)) {
                    fs.writeFileSync(projectDocumentPath, readmeContent, 'utf8');
                    projectDocumentCreated = true;
                }

                progress.report({ increment: 80, message: 'Scanning real repository metadata...' });
                const scanCmd = new ScanProjectCommand(this.apiClient);
                await scanCmd.execute({ silent: true, force: true, requireCloud: true });

                progress.report({ increment: 85, message: 'Downloading optimized AI rules...' });
                const generateCmd = new GenerateContextCommand(this.apiClient);
                await generateCmd.generateAndWrite(projectPath, undefined, 'full', false);

                progress.report({ increment: 92, message: 'Exporting IDE configurations...' });
                try {
                    const exportCmd = new ExportAiIdeContextCommand(this.apiClient);
                    await exportCmd.autoExport(projectPath);
                } catch (exportErr) {
                    console.log('IDE Context Export skipped/failed:', exportErr);
                }

                progress.report({ increment: 100, message: 'Done!' });
                
                if (initResult && initResult.alreadyInitialized) {
                    vscode.window.showInformationMessage(
                        `Workspace refreshed as ${localProjectName}. Starter files: ${scaffold.createdFiles} created, ${scaffold.existingFiles} preserved.`
                    );
                } else {
                    const documentResult = projectDocumentCreated
                        ? ` Created ${path.basename(projectDocumentPath)} without replacing existing documentation.`
                        : '';
                    vscode.window.showInformationMessage(
                        `Workspace initialized as ${localProjectName}. Starter files: ${scaffold.createdFiles} created, ${scaffold.existingFiles} preserved.${documentResult}`
                    );
                }
                return true;
            } catch (err: any) {
                vscode.window.showErrorMessage(`Initialization failed: ${err.message}`);
                return false;
            }
        });
    }

    private generateGitignore(framework: string): string {
        let gitignore = `# Dependencies\nnode_modules/\n\n# Build outputs\ndist/\nbuild/\nout/\n\n# Environment\n.env\n.env.local\n\n# OS and Logs\n.DS_Store\n*.log\n`;
        const lower = framework.toLowerCase();
        if (lower.includes('dotnet') || lower.includes('asp.net') || lower.includes('c#') || lower.includes('csharp')) {
            gitignore += `\n# .NET Build outputs\nbin/\nobj/\n*.user\n*.suo\n`;
        }
        if (lower.includes('python')) {
            gitignore += `\n# Python environment\n__pycache__/\n*.py[cod]\nvenv/\n.venv/\n`;
        }
        return gitignore;
    }

    private generateEnvExample(framework: string, databaseType: string, authType: string): string {
        const runtime = framework.toLowerCase();
        const database = databaseType.toLowerCase();
        let content = '# Generated by AI Context Brain Wizard\n';
        if (runtime.includes('asp.net') || runtime.includes('c#')) {
            content += 'ASPNETCORE_ENVIRONMENT=Development\nASPNETCORE_URLS=http://localhost:5000\n';
        } else if (runtime.includes('python') || runtime.includes('fastapi')) {
            content += 'APP_ENV=development\nPORT=8000\n';
        } else {
            content += 'NODE_ENV=development\nPORT=3000\n';
        }

        if (database.includes('postgres')) {
            content += 'DATABASE_URL="postgresql://user:password@localhost:5432/app"\n';
        } else if (database.includes('mysql')) {
            content += 'DATABASE_URL="mysql://user:password@localhost:3306/app"\n';
        } else if (database.includes('sql server') || database.includes('mssql')) {
            content += 'DATABASE_URL="Server=localhost;Database=app;User Id=sa;Password=change-me;TrustServerCertificate=True"\n';
        } else if (database.includes('mongo')) {
            content += 'DATABASE_URL="mongodb://localhost:27017/app"\n';
        } else if (database.includes('sqlite')) {
            content += 'DATABASE_URL="Data Source=app.db"\n';
        }

        if (authType.toLowerCase().includes('jwt')) {
            content += 'JWT_SECRET="replace-with-a-long-random-secret"\n';
        }
        if (authType.toLowerCase().includes('nextauth')) {
            content += 'AUTH_SECRET="replace-with-at-least-32-random-characters"\n';
            content += 'NEXTAUTH_URL="http://localhost:3000"\n';
        }

        return content;
    }

}
