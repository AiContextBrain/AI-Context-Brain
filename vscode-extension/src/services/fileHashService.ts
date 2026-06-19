import * as crypto from 'crypto';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface FileHashEntry {
    hash: string;
    lines: number;
    size: number;
    lastModified: number;
}

export interface HashCache {
    version: number;
    lastScanTime: string;
    files: Record<string, FileHashEntry>;
}

export interface ChangeDetection {
    added: string[];
    modified: string[];
    deleted: string[];
    unchanged: string[];
}

export class FileHashService {
    private static readonly CACHE_DIR = '.brain-cache';
    private static readonly CACHE_FILE = 'hashes.json';

    /**
     * Compute SHA-256 hash of a file's content
     */
    public async computeFileHash(fileUri: vscode.Uri): Promise<{ hash: string; lines: number; size: number }> {
        try {
            const data = await vscode.workspace.fs.readFile(fileUri);
            const content = new TextDecoder('utf-8').decode(data);
            
            // Hash content
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            const lines = content.split('\n').length;
            const size = data.byteLength;

            return { hash, lines, size };
        } catch (err) {
            console.error(`Error hashing file: ${fileUri.fsPath}`, err);
            return { hash: '', lines: 0, size: 0 };
        }
    }

    /**
     * Load cached file hashes from disk
     */
    public loadHashCache(projectPath: string): HashCache {
        const cachePath = path.join(projectPath, FileHashService.CACHE_DIR, FileHashService.CACHE_FILE);
        if (fs.existsSync(cachePath)) {
            try {
                const data = fs.readFileSync(cachePath, 'utf-8');
                return JSON.parse(data) as HashCache;
            } catch (err) {
                console.error('Failed to read hash cache', err);
            }
        }

        return {
            version: 1,
            lastScanTime: new Date(0).toISOString(),
            files: {}
        };
    }

    /**
     * Save updated hashes to disk
     */
    public saveHashCache(projectPath: string, cache: HashCache): void {
        const dirPath = path.join(projectPath, FileHashService.CACHE_DIR);
        if (!fs.existsSync(dirPath)) {
            try {
                fs.mkdirSync(dirPath, { recursive: true });
            } catch (error) {
                console.warn('AI Context Brain could not create its local hash cache directory.', error);
            }
        }

        const cachePath = path.join(dirPath, FileHashService.CACHE_FILE);
        try {
            fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
        } catch (err) {
            console.error('Failed to write hash cache', err);
        }
    }

    /**
     * Detect added, modified, deleted and unchanged files in a project
     */
    public async detectChanges(
        projectPath: string,
        currentFileUris: vscode.Uri[],
        cache: HashCache
    ): Promise<ChangeDetection> {
        const added: string[] = [];
        const modified: string[] = [];
        const unchanged: string[] = [];
        
        const currentPathsMap = new Map<string, vscode.Uri>();
        
        for (const fileUri of currentFileUris) {
            const relPath = path.relative(projectPath, fileUri.fsPath).replace(/\\/g, '/');
            currentPathsMap.set(relPath, fileUri);

            const cachedEntry = cache.files[relPath];
            if (!cachedEntry) {
                added.push(relPath);
            } else {
                try {
                    const stats = fs.statSync(fileUri.fsPath);
                    if (stats.mtimeMs !== cachedEntry.lastModified) {
                        const hashData = await this.computeFileHash(fileUri);
                        if (hashData.hash && hashData.hash === cachedEntry.hash) {
                            cache.files[relPath] = {
                                hash: cachedEntry.hash,
                                lines: hashData.lines,
                                size: hashData.size,
                                lastModified: stats.mtimeMs
                            };
                            unchanged.push(relPath);
                        } else {
                            modified.push(relPath);
                        }
                    } else {
                        unchanged.push(relPath);
                    }
                } catch {
                    modified.push(relPath); // fallback to scanning if stats fail
                }
            }
        }

        // Deleted files are in cache but not in current list
        const deleted = Object.keys(cache.files).filter(p => !currentPathsMap.has(p));

        return { added, modified, deleted, unchanged };
    }

    /**
     * Get metrics for all unchanged files
     */
    public getUnchangedMetrics(cache: HashCache, unchangedPaths: string[]): { totalLines: number; totalSizeBytes: number } {
        let totalLines = 0;
        let totalSizeBytes = 0;

        for (const relPath of unchangedPaths) {
            const entry = cache.files[relPath];
            if (entry) {
                totalLines += entry.lines;
                totalSizeBytes += entry.size;
            }
        }

        return { totalLines, totalSizeBytes };
    }
}
