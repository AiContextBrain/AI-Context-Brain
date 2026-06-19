import * as vscode from 'vscode';
import * as path from 'path';
import { BrainIgnore } from '../utils/brainignore';
import { PendingChangeEvent, PendingChangeService } from './pendingChangeService';

export class FileWatcher {
    private watcher: vscode.FileSystemWatcher | undefined;
    private debounceTimer: NodeJS.Timeout | undefined;
    private statusBarItem: vscode.StatusBarItem;
    private isEnabled: boolean = true;
    private defaultDebounceMs: number = 30000;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        this.setStatus('Active', 'AI Context Brain: Background file watcher active. No AI calls run in the background.');
    }

    /**
     * Initializes the background file watcher with workspace subscriptions
     */
    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const projectPath = workspaceFolders[0].uri.fsPath;
        const config = vscode.workspace.getConfiguration('aiContextBrain');
        this.isEnabled = config.get('autoSync', true);
        const debounceSeconds = config.get('autoSyncDebounceSeconds', 30);
        this.defaultDebounceMs = debounceSeconds * 1000;

        if (!this.isEnabled) {
            return;
        }

        // Load ignore patterns first to know what to watch/ignore
        const ignorePatterns = await BrainIgnore.loadPatterns(projectPath);

        // Watch everything, we will filter in event handlers
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        this.updatePendingStatus(projectPath);
        context.subscriptions.push(
            vscode.commands.registerCommand('aiContextBrain.refreshPendingChangesStatus', () => this.updatePendingStatus(projectPath))
        );

        // Listeners
        this.watcher.onDidCreate(uri => this.handleFileEvent(uri, projectPath, ignorePatterns, 'created'), null, context.subscriptions);
        this.watcher.onDidChange(uri => this.handleFileEvent(uri, projectPath, ignorePatterns, 'changed'), null, context.subscriptions);
        this.watcher.onDidDelete(uri => this.handleFileEvent(uri, projectPath, ignorePatterns, 'deleted'), null, context.subscriptions);

        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);
        context.subscriptions.push(this);
    }

    /**
     * Handle single file change event (with filtering against .brainignore)
     */
    private handleFileEvent(uri: vscode.Uri, projectPath: string, ignorePatterns: string[], event: PendingChangeEvent): void {
        const filePath = uri.fsPath;
        // Check if file is code and not ignored
        if (this.isCodeFile(filePath) && !BrainIgnore.shouldIgnore(filePath, ignorePatterns)) {
            PendingChangeService.add(projectPath, filePath, event);
            this.triggerDebouncedStatus(projectPath);
        }
    }

    /**
     * Debounce status updates only. Background watching never calls AI or uploads scans.
     */
    private triggerDebouncedStatus(projectPath: string): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.updatePendingStatus(projectPath);

        this.debounceTimer = setTimeout(() => {
            this.updatePendingStatus(projectPath);
        }, this.defaultDebounceMs);
    }

    /**
     * Display queued local metadata. Manual Scan Project consumes the queue and uploads one incremental scan.
     */
    private updatePendingStatus(projectPath: string): void {
        const count = PendingChangeService.count(projectPath);
        if (count === 0) {
            this.setStatus('Active', 'AI Context Brain: Background file watcher active. No AI calls run in the background.');
            return;
        }

        this.setStatus('Pending', `AI Context Brain: ${count} changed file${count === 1 ? '' : 's'} queued locally. Run Scan Project to refresh memory. No AI tokens used.`);
    }

    private setStatus(state: 'Active' | 'Pending' | 'Syncing' | 'Synced' | 'Error', tooltip: string): void {
        this.statusBarItem.text = `AI Brain: ${state}`;
        this.statusBarItem.tooltip = tooltip;
    }

    /**
     * Clean up watcher
     */
    public dispose(): void {
        if (this.watcher) {
            this.watcher.dispose();
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.statusBarItem.dispose();
    }

    private isCodeFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const codeExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.cs', '.py', '.java', '.cpp', '.c', '.h',
            '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.dart', '.vue'
        ];
        return codeExtensions.includes(ext);
    }
}
