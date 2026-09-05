import * as vscode from 'vscode';
import { ApiClient } from '../services/apiClient';

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined | null | void> = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectData: any = null;

    constructor(private apiClient: ApiClient) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
        if (!element) {
            // Root level - show project overview
            return this.getRootItems();
        } else {
            // Child items based on parent
            return this.getChildItems(element);
        }
    }

    private async getRootItems(): Promise<ProjectTreeItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [new ProjectTreeItem('No workspace open', vscode.TreeItemCollapsibleState.None, undefined, undefined)];
        }

        try {
            const projectPath = workspaceFolders[0].uri.fsPath;
            this.projectData = await this.apiClient.getProjectMemory(projectPath).catch(() => null);

            if (!this.projectData) {
                return [
                    new ProjectTreeItem('Project not scanned', vscode.TreeItemCollapsibleState.None, {
                        command: 'aiContextBrain.scanProject',
                        title: 'Scan Project'
                    })
                ];
            }

            return [
                new ProjectTreeItem(
                    `📊 ${this.projectData.framework} Project`,
                    vscode.TreeItemCollapsibleState.Expanded,
                    undefined,
                    'Project overview',
                    'overview'
                ),
                new ProjectTreeItem(
                    '🏗️ Architecture Rules',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    `${this.projectData.architectureRules?.length || 0} rules`,
                    'architecture'
                ),
                new ProjectTreeItem(
                    '📝 Coding Conventions',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    `${this.projectData.codingConventions?.length || 0} conventions`,
                    'conventions'
                ),
                new ProjectTreeItem(
                    '💡 System Decisions',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    `${this.projectData.systemDecisions?.length || 0} decisions`,
                    'decisions'
                ),
                new ProjectTreeItem(
                    '📈 Project Metrics',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    `${this.projectData.metrics?.filesCount || 0} files`,
                    'metrics'
                ),
                new ProjectTreeItem(
                    '🔄 Actions',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    'Quick actions',
                    'actions'
                )
            ];
        } catch (error) {
            return [
                new ProjectTreeItem('❌ Error loading project data', vscode.TreeItemCollapsibleState.None, undefined, undefined)
            ];
        }
    }

    private async getChildItems(element: ProjectTreeItem): Promise<ProjectTreeItem[]> {
        if (!this.projectData) {
            return [];
        }

        const context = element.contextValue;
        if (context === 'architecture') {
                return this.projectData.architectureRules?.map((rule: any) => 
                    new ProjectTreeItem(
                        `📋 ${rule.name}`,
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        rule.pattern
                    )
                ) || [];
        }
        
        if (context === 'conventions') {
            return this.projectData.codingConventions?.map((conv: any) => 
                    new ProjectTreeItem(
                        `📝 ${conv.name}`,
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        conv.rule
                    )
                ) || [];
        }
        
        if (context === 'decisions') {
            return this.projectData.systemDecisions?.map((decision: any) => 
                    new ProjectTreeItem(
                        `💡 ${decision.title}`,
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        `${decision.decision} (${new Date(decision.decisionDate).toLocaleDateString()})`
                    )
                ) || [];
        }
        
        if (context === 'metrics') {
            const metrics = this.projectData.metrics || {};
                return [
                    new ProjectTreeItem(
                        `📁 Files: ${metrics.filesCount?.toLocaleString() || 0}`,
                        vscode.TreeItemCollapsibleState.None,
                        undefined
                    ),
                    new ProjectTreeItem(
                        `📄 Lines of Code: ${metrics.linesOfCode?.toLocaleString() || 0}`,
                        vscode.TreeItemCollapsibleState.None,
                        undefined
                    ),
                    new ProjectTreeItem(
                        `📂 Folders: ${metrics.foldersCount || 0}`,
                        vscode.TreeItemCollapsibleState.None,
                        undefined
                    ),
                    new ProjectTreeItem(
                        `💾 Size: ${this.formatBytes(metrics.totalSizeBytes || 0)}`,
                        vscode.TreeItemCollapsibleState.None,
                        undefined
                    )
                ];
        }
        
        if (context === 'actions') {
            return [
                    new ProjectTreeItem(
                        '🔍 Scan Project',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'aiContextBrain.scanProject',
                            title: 'Scan Project'
                        }
                    ),
                    new ProjectTreeItem(
                        '🧠 Show Project Memory',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'aiContextBrain.showProjectMemory',
                            title: 'Show Project Memory'
                        }
                    ),
                    new ProjectTreeItem(
                        '📄 Generate AI Context',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'aiContextBrain.generateContext',
                            title: 'Generate AI Context'
                        }
                    ),
                    new ProjectTreeItem(
                        '🆕 New Project Wizard',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'aiContextBrain.newProjectWizard',
                            title: 'New Project Wizard'
                        }
                    )
                ];
        }
        
        return [];
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export class ProjectTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly tooltip?: string,
        contextValue?: string
    ) {
        super(label, collapsibleState);

        if (command) {
            this.command = command;
        }

        if (contextValue) {
            this.contextValue = contextValue;
        }

        this.tooltip = tooltip || this.label;
    }
}
