import * as vscode from 'vscode';
import { ApiClient } from '../services/apiClient';

export class ShowProjectMemoryCommand {
    constructor(private apiClient: ApiClient) {}

    async execute(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const projectPath = workspaceFolders[0].uri.fsPath;

        try {
            const memory = await this.apiClient.getProjectMemory(projectPath);
            
            const panel = vscode.window.createWebviewPanel(
                'projectMemory',
                'Project Memory',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.getProjectMemoryHtml(memory);

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    switch (message.command) {
                        case 'addRule':
                            await this.addArchitectureRule(projectPath, message.text);
                            break;
                        case 'addConvention':
                            await this.addCodingConvention(projectPath, message.text);
                            break;
                        case 'addDecision':
                            await this.addSystemDecision(projectPath, message.title, message.text);
                            break;
                    }
                },
                undefined
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to load project memory: ${errorMessage}`);
        }
    }

    private async addArchitectureRule(projectPath: string, rule: string): Promise<void> {
        try {
            await this.apiClient.updateProjectMemory(projectPath, { architectureRule: rule });
            vscode.window.showInformationMessage('Architecture rule added successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to add architecture rule: ${errorMessage}`);
        }
    }

    private async addCodingConvention(projectPath: string, convention: string): Promise<void> {
        try {
            await this.apiClient.updateProjectMemory(projectPath, { codingConvention: convention });
            vscode.window.showInformationMessage('Coding convention added successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to add coding convention: ${errorMessage}`);
        }
    }

    private async addSystemDecision(projectPath: string, title: string, decision: string): Promise<void> {
        try {
            await this.apiClient.updateProjectMemory(projectPath, {
                systemDecision: `${title}: ${decision}`
            });
            vscode.window.showInformationMessage('System decision added successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to add system decision: ${errorMessage}`);
        }
    }

    private getProjectMemoryHtml(memory: any): string {
        if (!memory) {
            return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
                </style>
            </head>
            <body>
                <h1>🧠 Project Memory</h1>
                <p>No project memory found. Please run a project scan first using the eklenti command!</p>
            </body>
            </html>`;
        }

        const framework = memory.framework || 'Unknown';
        const architectureType = memory.architectureType || 'Unknown';
        const databaseType = memory.databaseType || 'Unknown';
        const authSystem = memory.authSystem || 'Unknown';
        const lastScanDate = memory.lastScanDate ? new Date(memory.lastScanDate).toLocaleString() : 'Never';
        const filesCount = memory.metrics?.filesCount?.toLocaleString() ?? memory.metrics?.FilesCount?.toLocaleString() ?? '0';
        const linesOfCode = memory.metrics?.linesOfCode?.toLocaleString() ?? memory.metrics?.LinesOfCode?.toLocaleString() ?? '0';
        const architectureRules = memory.architectureRules || [];
        const codingConventions = memory.codingConventions || [];
        const systemDecisions = memory.systemDecisions || [];

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Project Memory</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 20px; 
                    color: var(--vscode-foreground); 
                    background: var(--vscode-editor-background);
                }
                h1 { color: var(--vscode-foreground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
                h2 { color: var(--vscode-foreground); margin-top: 30px; }
                .rule { background: var(--vscode-textBlockQuote-background); padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid var(--vscode-charts-orange); }
                .convention { background: var(--vscode-textBlockQuote-background); padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid var(--vscode-charts-green); }
                .decision { background: var(--vscode-textBlockQuote-background); padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid var(--vscode-charts-purple); }
                pre { background: var(--vscode-textBlockQuote-background); padding: 10px; border-radius: 4px; overflow-x: auto; }
                .add-button { 
                    background: var(--vscode-button-background); 
                    color: var(--vscode-button-foreground); 
                    border: none; 
                    padding: 8px 16px; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    margin: 10px 0;
                }
                .add-button:hover { background: var(--vscode-button-hoverBackground); }
                .input-group { margin: 10px 0; }
                input, textarea { 
                    width: 100%; 
                    padding: 8px; 
                    background: var(--vscode-input-background); 
                    color: var(--vscode-input-foreground); 
                    border: 1px solid var(--vscode-input-border); 
                    border-radius: 4px; 
                }
                .overview { 
                    background: var(--vscode-editor-background); 
                    padding: 15px; 
                    border-radius: 4px; 
                    margin: 10px 0; 
                    border: 1px solid var(--vscode-panel-border);
                }
            </style>
        </head>
        <body>
            <h1>🧠 Project Memory</h1>
            
            <div class="overview">
                <h3>Project Overview</h3>
                <p><strong>Framework:</strong> ${framework}</p>
                <p><strong>Architecture:</strong> ${architectureType}</p>
                <p><strong>Database:</strong> ${databaseType}</p>
                <p><strong>Authentication:</strong> ${authSystem}</p>
                <p><strong>Last Updated:</strong> ${lastScanDate}</p>
                <p><strong>Files:</strong> ${filesCount}</p>
                <p><strong>Lines of Code:</strong> ${linesOfCode}</p>
            </div>
            
            <h2>🏗️ Architecture Rules</h2>
            <button class="add-button" onclick="showAddRuleInput()">+ Add Architecture Rule</button>
            <div id="addRuleInput" class="input-group" style="display: none;">
                <input type="text" id="ruleInput" placeholder="Enter architecture rule..." />
                <button class="add-button" onclick="addRule()">Add Rule</button>
            </div>
            
            ${architectureRules.map((rule: any) => `
                <div class="rule">
                    <strong>${rule.name || rule.Name || 'Rule'}</strong><br>
                    ${rule.pattern || rule.Pattern || ''}<br>
                    ${rule.description || ''}<br>
                    ${rule.folderPath ? `📁 ${rule.folderPath}<br>` : ''}
                    <small>Created: ${rule.createdAt ? new Date(rule.createdAt).toLocaleDateString() : 'Unknown'}</small>
                </div>
            `).join('')}
            
            <h2>📝 Coding Conventions</h2>
            <button class="add-button" onclick="showAddConventionInput()">+ Add Coding Convention</button>
            <div id="addConventionInput" class="input-group" style="display: none;">
                <input type="text" id="conventionInput" placeholder="Enter coding convention..." />
                <button class="add-button" onclick="addConvention()">Add Convention</button>
            </div>
            
            ${codingConventions.map((conv: any) => `
                <div class="convention">
                    <strong>${conv.name || conv.Name || 'Convention'}</strong><br>
                    ${conv.rule || conv.Rule || ''}<br>
                    ${conv.example ? `<pre>${conv.example}</pre>` : ''}
                    <small>Created: ${conv.createdAt ? new Date(conv.createdAt).toLocaleDateString() : 'Unknown'}</small>
                </div>
            `).join('')}
            
            <h2>💡 System Decisions</h2>
            <button class="add-button" onclick="showAddDecisionInput()">+ Add System Decision</button>
            <div id="addDecisionInput" class="input-group" style="display: none;">
                <input type="text" id="decisionTitleInput" placeholder="Decision title..." />
                <textarea id="decisionInput" placeholder="Enter decision details..." rows="3"></textarea>
                <button class="add-button" onclick="addDecision()">Add Decision</button>
            </div>
            
            ${systemDecisions.map((decision: any) => `
                <div class="decision">
                    <strong>${decision.title || decision.Title || 'Decision'}</strong> (${decision.decisionDate ? new Date(decision.decisionDate).toLocaleDateString() : 'Unknown'})<br>
                    ${decision.decision || decision.Decision || ''}<br>
                    ${decision.reasoning ? `<em>${decision.reasoning}</em>` : ''}
                </div>
            `).join('')}
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function showAddRuleInput() {
                    document.getElementById('addRuleInput').style.display = 'block';
                    document.getElementById('ruleInput').focus();
                }
                
                function addRule() {
                    const rule = document.getElementById('ruleInput').value;
                    if (rule.trim()) {
                        vscode.postMessage({ command: 'addRule', text: rule });
                        document.getElementById('ruleInput').value = '';
                        document.getElementById('addRuleInput').style.display = 'none';
                    }
                }
                
                function showAddConventionInput() {
                    document.getElementById('addConventionInput').style.display = 'block';
                    document.getElementById('conventionInput').focus();
                }
                
                function addConvention() {
                    const convention = document.getElementById('conventionInput').value;
                    if (convention.trim()) {
                        vscode.postMessage({ command: 'addConvention', text: convention });
                        document.getElementById('conventionInput').value = '';
                        document.getElementById('addConventionInput').style.display = 'none';
                    }
                }
                
                function showAddDecisionInput() {
                    document.getElementById('addDecisionInput').style.display = 'block';
                    document.getElementById('decisionTitleInput').focus();
                }
                
                function addDecision() {
                    const title = document.getElementById('decisionTitleInput').value;
                    const decision = document.getElementById('decisionInput').value;
                    if (title.trim() && decision.trim()) {
                        vscode.postMessage({ command: 'addDecision', title: title, text: decision });
                        document.getElementById('decisionTitleInput').value = '';
                        document.getElementById('decisionInput').value = '';
                        document.getElementById('addDecisionInput').style.display = 'none';
                    }
                }
                
                // Handle Enter key in inputs
                document.getElementById('ruleInput')?.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') addRule();
                });
                
                document.getElementById('conventionInput')?.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') addConvention();
                });
            </script>
        </body>
        </html>`;
    }
}
