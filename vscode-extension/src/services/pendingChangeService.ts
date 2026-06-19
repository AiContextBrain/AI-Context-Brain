import * as fs from 'fs';
import * as path from 'path';

export type PendingChangeEvent = 'created' | 'changed' | 'deleted';

export interface PendingChange {
    path: string;
    event: PendingChangeEvent;
    timestamp: string;
    extension: string;
}

export class PendingChangeService {
    private static readonly CACHE_DIR = '.brain-cache';
    private static readonly PENDING_FILE = 'pending-changes.json';

    public static add(projectPath: string, absolutePath: string, event: PendingChangeEvent): PendingChange[] {
        const relPath = path.relative(projectPath, absolutePath).replace(/\\/g, '/');
        if (!relPath || relPath.startsWith('..')) {
            return this.load(projectPath);
        }

        const changes = this.load(projectPath);
        const withoutCurrent = changes.filter(change => change.path !== relPath);
        const next = [
            ...withoutCurrent,
            {
                path: relPath,
                event,
                timestamp: new Date().toISOString(),
                extension: path.extname(relPath).toLowerCase()
            }
        ];

        this.save(projectPath, next);
        return next;
    }

    public static load(projectPath: string): PendingChange[] {
        const filePath = this.getPendingFilePath(projectPath);
        if (!fs.existsSync(filePath)) {
            return [];
        }

        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return Array.isArray(parsed?.changes) ? parsed.changes : [];
        } catch {
            return [];
        }
    }

    public static count(projectPath: string): number {
        return this.load(projectPath).length;
    }

    public static clear(projectPath: string): void {
        this.save(projectPath, []);
    }

    private static save(projectPath: string, changes: PendingChange[]): void {
        const dirPath = path.join(projectPath, this.CACHE_DIR);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(
            this.getPendingFilePath(projectPath),
            JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), changes }, null, 2),
            'utf-8'
        );
    }

    private static getPendingFilePath(projectPath: string): string {
        return path.join(projectPath, this.CACHE_DIR, this.PENDING_FILE);
    }
}
