import * as vscode from 'vscode';
import { ApiClient } from '../services/apiClient';
import { ExportAiIdeContextCommand } from './exportAiIdeContext';
import { BrainIgnore } from '../utils/brainignore';
import { FileHashService, HashCache } from '../services/fileHashService';
import { PendingChangeService } from '../services/pendingChangeService';
import { generateOptimizedContext, getPlanTokenLimit, OPTIMISTIC_CONTEXT_TOKEN_LIMIT, writeContextFiles } from '../services/contextExportService';
import * as path from 'path';
import * as fs from 'fs';

export class ScanProjectCommand {
    constructor(private apiClient: ApiClient) {}

    async execute(options: { silent?: boolean; force?: boolean; requireCloud?: boolean } = {}): Promise<void> {
        const silent = options.silent === true;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            if (!silent) {
                vscode.window.showErrorMessage('No workspace folder found');
            }
            return;
        }

        const projectPath = workspaceFolders[0].uri.fsPath;
        
        // Show progress indicator
        await vscode.window.withProgress({
            location: silent ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
            title: silent ? 'AI Context Brain sync' : 'Scanning Project',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Initializing scan...' });

            try {
                progress.report({ increment: 20, message: 'Analyzing project structure...' });

                // ── Local analysis (no backend needed)
                const localResult = await this.analyzeLocally(projectPath);

                if (silent && !options.force && !localResult.hasChanges) {
                    progress.report({ increment: 100, message: 'No content changes' });
                    return;
                }

                progress.report({ increment: 55, message: 'Uploading to AI Context Brain cloud...' });

                // ── Cloud upload
                try {
                    await this.apiClient.scanProject(projectPath, {
                        Name: localResult.name,
                        Framework: localResult.framework,
                        ArchitectureType: localResult.architectureType,
                        DatabaseType: localResult.databaseType,
                        AuthSystem: localResult.authSystem,
                        IsIncremental: localResult.isIncremental,
                        IsBackgroundSync: silent,
                        AddedFiles: localResult.addedFiles,
                        ModifiedFiles: localResult.modifiedFiles,
                        DeletedFiles: localResult.deletedFiles,
                        ChangedFiles: localResult.changedFiles,
                        Metrics: {
                            FilesCount: localResult.metrics.filesCount,
                            LinesOfCode: localResult.metrics.linesOfCode,
                            FoldersCount: localResult.metrics.foldersCount,
                            TotalSizeBytes: localResult.metrics.totalSizeBytes,
                            Dependencies: localResult.metrics.dependencies,
                            FileExtensions: localResult.metrics.fileExtensions,
                            LargestFiles: localResult.metrics.largestFiles,
                            RecentlyModifiedFiles: localResult.metrics.recentlyModifiedFiles,
                            IgnoredPaths: localResult.metrics.ignoredPaths,
                            TechStack: localResult.metrics.techStack,
                            ImportantFiles: localResult.metrics.importantFiles,
                            ModuleMap: localResult.metrics.moduleMap,
                            ArchitectureSummary: localResult.metrics.architectureSummary,
                            RouteMap: localResult.metrics.routeMap,
                            ServiceGraph: localResult.metrics.serviceGraph,
                            EntityMap: localResult.metrics.entityMap,
                            DtoMap: localResult.metrics.dtoMap,
                            AiProviderMap: localResult.metrics.aiProviderMap,
                            PlanEnforcementMap: localResult.metrics.planEnforcementMap,
                            ExtensionExportMap: localResult.metrics.extensionExportMap,
                            TestBuildMap: localResult.metrics.testBuildMap
                        },
                        FolderStructure: localResult.folderStructure,
                        DetectedPatterns: localResult.detectedPatterns
                    });
                    progress.report({ increment: 85, message: 'Saved to cloud ✓' });
                    PendingChangeService.clear(projectPath);
                    vscode.commands.executeCommand('aiContextBrain.refreshPendingChangesStatus');
                    vscode.commands.executeCommand('aiContextBrain.refreshTree');

                    // Auto-export to IDE-specific location
                    const autoExport = !silent && vscode.workspace.getConfiguration('aiContextBrain').get<boolean>('autoExportOnScan', false);
                    if (autoExport) {
                        try {
                            const exportCmd = new ExportAiIdeContextCommand(this.apiClient);
                            await exportCmd.autoExport(projectPath);
                            progress.report({ increment: 90, message: 'AI context exported to IDE ✓' });
                        } catch (e) {
                            console.log('Auto-export skipped:', e);
                        }
                    }
                } catch (uploadError: any) {
                    if (options.requireCloud) {
                        throw uploadError;
                    }
                    if (silent) {
                        console.log(`[AI Context Brain] Cloud sync skipped: ${uploadError?.message || uploadError}`);
                    } else {
                    vscode.window.showWarningMessage(`⚠️ Cloud sync skipped: ${uploadError?.message || uploadError}`);
                }

                }

                progress.report({ increment: 100, message: 'Done!' });

                if (silent) {
                    return;
                }

                const result = await vscode.window.showInformationMessage(
                    `✅ Scan complete! ${localResult.metrics.filesCount} files · ${localResult.framework} · ${localResult.architectureType}${localResult.isIncremental ? ' (Incremental)' : ''}`,
                    'Generate AI Context',
                    'View Details'
                );

                if (result === 'Generate AI Context') {
                    await this.generateAiContext(projectPath);
                } else if (result === 'View Details') {
                    this.showScanDetails(localResult);
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                if (!silent) {
                    vscode.window.showErrorMessage(`Scan failed: ${errorMessage}`);
                }
                throw error;
            }
        });
    }

    private async showScanDetails(scanResult: any): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'projectScanDetails',
            'Project Scan Details',
            vscode.ViewColumn.One,
            {}
        );

        panel.webview.html = this.getScanDetailsHtml(scanResult);
    }

    private async analyzeLocally(projectPath: string): Promise<any> {
        // 1. Load ignore patterns and create VS Code exclude glob
        const ignorePatterns = await BrainIgnore.loadPatterns(projectPath);
        const excludeGlob = BrainIgnore.toVSCodeExcludeGlob(ignorePatterns);

        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(projectPath, '**/*'),
            new vscode.RelativePattern(projectPath, excludeGlob)
        );

        const fileNames = files.map(f => f.fsPath);
        const filesCount = fileNames.length;

        // 2. Load hash cache
        const hashService = new FileHashService();
        const cache = hashService.loadHashCache(projectPath);

        // 3. Detect changes
        const changes = await hashService.detectChanges(projectPath, files, cache);
        const pendingChanges = PendingChangeService.load(projectPath);
        const pendingPaths = pendingChanges.map(change => change.path);
        const filesToAnalyze = [...new Set([...changes.added, ...changes.modified, ...pendingPaths])];
        const isIncremental = cache.lastScanTime !== new Date(0).toISOString() && filesToAnalyze.length < filesCount;

        // Detect frameworks (smart monorepo check)
        const frameworks: string[] = [];
        const hasCsproj   = fileNames.some(f => f.endsWith('.csproj'));
        const hasPackage  = fileNames.some(f => f.endsWith('package.json') && !f.includes('node_modules'));
        const hasPyreqs   = fileNames.some(f => f.endsWith('requirements.txt') || f.endsWith('pyproject.toml'));
        const hasGoMod    = fileNames.some(f => f.endsWith('go.mod'));
        const hasNext     = fileNames.some(f => f.endsWith('next.config.js') || f.endsWith('next.config.ts'));
        const hasVite     = fileNames.some(f => f.endsWith('vite.config.ts') || f.endsWith('vite.config.js'));

        if (hasCsproj)       frameworks.push('ASP.NET Core');
        if (hasNext)         frameworks.push('Next.js');
        if (hasVite)         frameworks.push('Vite');
        if (hasPackage && !hasNext && !hasVite) frameworks.push('Node.js');
        if (hasPyreqs)       frameworks.push('Python');
        if (hasGoMod)        frameworks.push('Go');

        const framework = frameworks.length > 0 ? frameworks.join(', ') : 'Unknown';

        // Detect architecture
        const paths = fileNames.map(f => path.relative(projectPath, f).replace(/\\/g, '/').toLowerCase());
        let architectureType = 'Standard';
        if (paths.some(p => p.includes('domain/') || p.includes('application/') || p.includes('infrastructure/'))) {
            architectureType = 'Clean Architecture';
        } else if (paths.some(p => p.includes('controllers/') && p.includes('models/'))) {
            architectureType = 'MVC';
        } else if (paths.some(p => p.includes('features/') || p.includes('modules/'))) {
            architectureType = 'Feature-based';
        }

        // Folder structure (top-level only, separating directories from files cleanly)
        const folderStructure = new Set<string>();
        for (const file of files) {
            const relPath = path.relative(projectPath, file.fsPath).replace(/\\/g, '/');
            const parts = relPath.split('/').filter(Boolean);
            if (parts.length > 1) {
                // It's inside a folder! The first part is the top-level folder name.
                folderStructure.add(parts[0] + '/');
            } else if (parts.length === 1) {
                // It's a file at the root level!
                folderStructure.add(parts[0]);
            }
        }
        const topFolders = [...folderStructure].sort((a, b) => {
            const aIsDir = a.endsWith('/');
            const bIsDir = b.endsWith('/');
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        }).slice(0, 20);

        const projectName = path.basename(projectPath) || 'Project';

        // ── Accurate code scanning (lines of code count, database/auth/dependencies analysis)
        let newlyAnalyzedLines = 0;
        let newlyAnalyzedSize = 0;
        let databaseType = 'Unknown';
        let authSystem = 'Unknown';
        const dependencies: string[] = [];
        
        const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.cs', '.py', '.go', '.java', '.cpp', '.h', '.html', '.css', '.json', '.md'];
        const updatedFiles: Record<string, any> = { ...cache.files };

        // Remove deleted files from cache
        for (const deletedFile of changes.deleted) {
            delete updatedFiles[deletedFile];
        }

        let processedFiles = 0;

        // Map files for quick URI lookup
        const fileUriMap = new Map<string, vscode.Uri>();
        for (const file of files) {
            const relPath = path.relative(projectPath, file.fsPath).replace(/\\/g, '/');
            fileUriMap.set(relPath, file);
        }

        const structuralFiles = files.filter(file => {
            const relPath = path.relative(projectPath, file.fsPath).replace(/\\/g, '/').toLowerCase();
            const fileName = path.basename(file.fsPath).toLowerCase();
            return !relPath.includes('node_modules/')
                && !relPath.includes('/dist/')
                && !relPath.includes('/out/')
                && !relPath.includes('/bin/')
                && !relPath.includes('/obj/')
                && (
                    fileName === 'package.json' ||
                    fileName.endsWith('.csproj') ||
                    fileName === 'appsettings.json' ||
                    fileName === 'program.cs' ||
                    fileName === 'applicationdbcontext.cs' ||
                    relPath.includes('authcontroller.cs') ||
                    relPath.includes('hybridaianalysisservice.cs') ||
                    relPath.includes('backend/src/dtos/') ||
                    relPath.includes('backend/src/models/') ||
                    relPath.includes('backend/src/controllers/') ||
                    relPath.includes('backend/src/services/')
                );
        });

        for (const file of structuralFiles) {
            try {
                const fsPath = file.fsPath;
                const relPath = path.relative(projectPath, fsPath).replace(/\\/g, '/').toLowerCase();
                const content = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(file));
                const lowerContent = content.toLowerCase();

                if (lowerContent.includes('usenpgsql') || lowerContent.includes('npgsql') || lowerContent.includes('postgresql')) {
                    databaseType = 'PostgreSQL';
                } else if (databaseType === 'Unknown' && (lowerContent.includes('usesqlite') || lowerContent.includes('entityframeworkcore.sqlite'))) {
                    databaseType = 'SQLite';
                } else if (databaseType === 'Unknown' && lowerContent.includes('usemysql')) {
                    databaseType = 'MySQL';
                } else if (databaseType === 'Unknown' && lowerContent.includes('usesqlserver')) {
                    databaseType = 'SQL Server';
                }

                if (lowerContent.includes('applicationdbcontext') && lowerContent.includes('dbset<') && databaseType === 'Unknown') {
                    databaseType = 'Entity Framework Core persistence';
                }

                if (relPath.includes('authcontroller.cs') ||
                    lowerContent.includes('generatejwttoken') ||
                    lowerContent.includes('refreshtokenhash') ||
                    lowerContent.includes('rfc2898derivebytes') ||
                    lowerContent.includes('bearer token')) {
                    authSystem = 'JWT Auth + refresh token rotation';
                } else if (authSystem === 'Unknown' && lowerContent.includes('jwtbearer')) {
                    authSystem = 'JWT Auth';
                }

                if (fsPath.endsWith('package.json')) {
                    const pkg = JSON.parse(content);
                    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                    dependencies.push(...Object.keys(allDeps));
                } else if (fsPath.endsWith('.csproj')) {
                    const regex = /PackageReference\s+Include="([^"]+)"/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        dependencies.push(match[1]);
                    }
                }
            } catch {
                // Structural scan is best-effort; deep scan still runs below.
            }
        }

        // Scan only added/modified files
        for (const relPath of filesToAnalyze) {
            const file = fileUriMap.get(relPath);
            if (!file) continue;

            const fsPath = file.fsPath;
            const ext = path.extname(fsPath).toLowerCase();
            
            try {
                const stat = fs.statSync(fsPath);
                
                if (ext && textExtensions.includes(ext) && processedFiles < 300) {
                    const hashData = await hashService.computeFileHash(file);
                    
                    newlyAnalyzedLines += hashData.lines;
                    newlyAnalyzedSize += hashData.size;

                    updatedFiles[relPath] = {
                        hash: hashData.hash,
                        lines: hashData.lines,
                        size: hashData.size,
                        lastModified: stat.mtimeMs
                    };

                    processedFiles++;

                    // Parse content for database/auth/dependencies
                    const data = await vscode.workspace.fs.readFile(file);
                    const content = new TextDecoder('utf-8').decode(data);
                    const lowerContent = content.toLowerCase();

                    // Real Database Detection
                    if (databaseType === 'Unknown') {
                        if (lowerContent.includes('npgsql') || lowerContent.includes('postgresql')) databaseType = 'PostgreSQL';
                        else if (lowerContent.includes('sqlite') || lowerContent.includes('entityframeworkcore.sqlite')) databaseType = 'SQLite';
                        else if (lowerContent.includes('mongodb') || lowerContent.includes('mongoose')) databaseType = 'MongoDB';
                        else if (lowerContent.includes('mysql') || lowerContent.includes('pomelo')) databaseType = 'MySQL';
                        else if (lowerContent.includes('sqlserver') || lowerContent.includes('entityframeworkcore.sqlserver')) databaseType = 'SQL Server';
                    }

                    // Real Auth System Detection
                    if (authSystem === 'Unknown') {
                        if (lowerContent.includes('aspnetcore.identity') || lowerContent.includes('microsoft.aspnetcore.identity')) authSystem = 'ASP.NET Core Identity';
                        else if (lowerContent.includes('next-auth') || lowerContent.includes('nextauth')) authSystem = 'NextAuth';
                        else if (lowerContent.includes('firebase.auth') || lowerContent.includes('firebaseadmin')) authSystem = 'Firebase Auth';
                        else if (lowerContent.includes('jsonwebtoken') || lowerContent.includes('jwtbearer')) authSystem = 'JWT Auth';
                        else if (lowerContent.includes('passport.initialize')) authSystem = 'Passport.js';
                    }

                    // Real Dependency Parsing
                    if (fsPath.endsWith('package.json')) {
                        try {
                            const pkg = JSON.parse(content);
                            const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                            dependencies.push(...Object.keys(allDeps));
                        } catch {
                            // Ignore malformed package metadata and continue scanning other files.
                        }
                    } else if (fsPath.endsWith('.csproj')) {
                        const regex = /PackageReference\s+Include="([^"]+)"/g;
                        let match;
                        while ((match = regex.exec(content)) !== null) {
                            dependencies.push(match[1]);
                        }
                    }
                }
            } catch (err) {
                console.log(`Failed to process file ${fsPath}:`, err);
            }
        }

        // Get metrics for unchanged files
        const unchangedMetrics = hashService.getUnchangedMetrics(cache, changes.unchanged);
        let totalLines = newlyAnalyzedLines + unchangedMetrics.totalLines;
        let totalSize = newlyAnalyzedSize + unchangedMetrics.totalSizeBytes;

        // Save new cache
        const newCache: HashCache = {
            version: 1,
            lastScanTime: new Date().toISOString(),
            files: updatedFiles
        };
        hashService.saveHashCache(projectPath, newCache);

        // Fallback package-based detection
        const depsLower = dependencies.map(d => d.toLowerCase());
        if (databaseType === 'Unknown') {
            if (depsLower.some(d => d.includes('npgsql') || d.includes('postgresql'))) databaseType = 'PostgreSQL';
            else if (depsLower.some(d => d.includes('sqlite'))) databaseType = 'SQLite';
            else if (depsLower.some(d => d.includes('mongodb') || d.includes('mongoose'))) databaseType = 'MongoDB';
            else if (depsLower.some(d => d.includes('mysql') || d.includes('pomelo'))) databaseType = 'MySQL';
            else if (depsLower.some(d => d.includes('sqlserver') || d.includes('entityframeworkcore.sqlserver'))) databaseType = 'SQL Server';
        }

        if (authSystem === 'Unknown') {
            if (depsLower.some(d => d.includes('identity') || d.includes('aspnetcore.identity'))) authSystem = 'ASP.NET Core Identity';
            else if (depsLower.some(d => d.includes('next-auth') || d.includes('nextauth'))) authSystem = 'NextAuth';
            else if (depsLower.some(d => d.includes('firebase'))) authSystem = 'Firebase Auth';
            else if (depsLower.some(d => d.includes('jsonwebtoken') || d.includes('jwtbearer') || d.includes('jwt'))) authSystem = 'JWT Auth';
            else if (depsLower.some(d => d.includes('passport'))) authSystem = 'Passport.js';
        }

        // Fallback heuristic if no lines scanned
        if (totalLines === 0) {
            totalLines = filesCount * 30;
        }
        if (totalSize === 0) {
            totalSize = filesCount * 2048;
        }

        // --- NEW ENRICHED CODE STARTS HERE ---
        // 1. Compute Largest and Recently Modified files
        const allFilesMetrics = [];
        const fileExtensions: Record<string, number> = {};
        for (const file of files) {
            try {
                const fsPath = file.fsPath;
                const stat = fs.statSync(fsPath);
                const relPath = path.relative(projectPath, fsPath).replace(/\\/g, '/');
                const ext = path.extname(fsPath).toLowerCase() || '[none]';
                fileExtensions[ext] = (fileExtensions[ext] ?? 0) + 1;
                allFilesMetrics.push({
                    path: relPath,
                    sizeBytes: stat.size,
                    lastModified: stat.mtimeMs
                });
            } catch {
                // A transient stat failure should not abort the repository scan.
            }
        }

        const largestFiles = allFilesMetrics
            .sort((a, b) => b.sizeBytes - a.sizeBytes)
            .slice(0, 5)
            .map(x => ({
                path: x.path,
                sizeBytes: x.sizeBytes,
                lines: updatedFiles[x.path]?.lines || Math.round(x.sizeBytes / 60) || 0
            }));

        const recentlyModifiedFiles = allFilesMetrics
            .sort((a, b) => b.lastModified - a.lastModified)
            .slice(0, 5)
            .map(x => ({
                path: x.path,
                sizeBytes: x.sizeBytes,
                lines: updatedFiles[x.path]?.lines || Math.round(x.sizeBytes / 60) || 0,
                lastModified: new Date(x.lastModified).toISOString()
            }));

        // 2. Tech Stack Detection
        let detectedFrontend = { name: 'Unknown', confidence: 0.0 };
        let detectedBackend = { name: 'Unknown', confidence: 0.0 };
        let detectedDatabase = { name: 'Unknown', confidence: 0.0 };
        let detectedAuth = { name: 'Unknown', confidence: 0.0 };
        let detectedOrm = { name: 'Not detected', confidence: 0.0 };
        let detectedPackageManager = { name: 'npm', confidence: 1.0 };
        let detectedDeployment = { name: 'Local Executable', confidence: 0.5 };
        let detectedMonorepo = { name: 'None', confidence: 0.8 };
        const detectedAiProviders: { name: string, confidence: number }[] = [];

        // PackageManager
        const lowerFiles = fileNames.map(f => f.toLowerCase());
        if (lowerFiles.some(f => f.endsWith('pnpm-lock.yaml'))) detectedPackageManager = { name: 'pnpm', confidence: 1.0 };
        else if (lowerFiles.some(f => f.endsWith('yarn.lock'))) detectedPackageManager = { name: 'yarn', confidence: 1.0 };
        else if (lowerFiles.some(f => f.endsWith('package-lock.json'))) detectedPackageManager = { name: 'npm', confidence: 1.0 };
        else if (hasCsproj) detectedPackageManager = { name: 'NuGet', confidence: 1.0 };
        else if (hasPyreqs) detectedPackageManager = { name: 'pip', confidence: 1.0 };

        // Frontend
        if (hasNext) detectedFrontend = { name: 'Next.js', confidence: 1.0 };
        else if (hasVite) {
            const hasReactDep = depsLower.some(d => d.includes('react'));
            detectedFrontend = { name: hasReactDep ? 'React (Vite)' : 'Vite Client', confidence: 1.0 };
        } else if (depsLower.some(d => d.includes('react'))) {
            detectedFrontend = { name: 'React', confidence: 0.95 };
        }

        // Backend
        if (hasCsproj) detectedBackend = { name: 'ASP.NET Core', confidence: 1.0 };
        else if (hasNext) detectedBackend = { name: 'Next.js API Routes', confidence: 0.9 };
        else if (depsLower.some(d => d.includes('express'))) detectedBackend = { name: 'Express.js', confidence: 1.0 };
        else if (hasPyreqs) {
            const hasDjango = depsLower.some(d => d.includes('django'));
            detectedBackend = { name: hasDjango ? 'Django' : 'FastAPI/Flask', confidence: 0.9 };
        }

        // DB
        if (databaseType !== 'Unknown') {
            detectedDatabase = { name: databaseType, confidence: 0.95 };
        }

        // Auth
        if (authSystem !== 'Unknown') {
            detectedAuth = { name: authSystem, confidence: 0.95 };
        }

        // ORM
        if (depsLower.some(d => d.includes('entityframeworkcore') || d.includes('efcore') || d.includes('entityframework'))) {
            detectedOrm = { name: 'Entity Framework Core', confidence: 1.0 };
        } else if (depsLower.some(d => d.includes('prisma'))) {
            detectedOrm = { name: 'Prisma', confidence: 1.0 };
        } else if (depsLower.some(d => d.includes('mongoose'))) {
            detectedOrm = { name: 'Mongoose', confidence: 1.0 };
        } else if (depsLower.some(d => d.includes('sequelize'))) {
            detectedOrm = { name: 'Sequelize', confidence: 1.0 };
        } else if (depsLower.some(d => d.includes('typeorm'))) {
            detectedOrm = { name: 'TypeORM', confidence: 1.0 };
        }

        // Monorepo
        if (lowerFiles.some(f => f.endsWith('pnpm-workspace.yaml'))) {
            detectedMonorepo = { name: 'pnpm workspaces', confidence: 1.0 };
        } else if (lowerFiles.some(f => f.endsWith('lerna.json'))) {
            detectedMonorepo = { name: 'Lerna', confidence: 1.0 };
        } else if (lowerFiles.some(f => f.endsWith('nx.json'))) {
            detectedMonorepo = { name: 'Nx', confidence: 1.0 };
        }

        // Deployment
        if (lowerFiles.some(f => f.endsWith('dockerfile') || f.endsWith('docker-compose.yml'))) {
            detectedDeployment = { name: 'Docker', confidence: 0.9 };
        } else if (lowerFiles.some(f => f.endsWith('vercel.json'))) {
            detectedDeployment = { name: 'Vercel', confidence: 1.0 };
        } else if (lowerFiles.some(f => f.endsWith('netlify.toml'))) {
            detectedDeployment = { name: 'Netlify', confidence: 1.0 };
        }

        // AI Providers
        if (depsLower.some(d => d.includes('openai'))) detectedAiProviders.push({ name: 'OpenAI API', confidence: 0.95 });
        if (depsLower.some(d => d.includes('anthropic'))) detectedAiProviders.push({ name: 'Anthropic API', confidence: 0.95 });
        if (depsLower.some(d => d.includes('generative-ai') || d.includes('gemini'))) detectedAiProviders.push({ name: 'Google Gemini API', confidence: 0.95 });
        if (depsLower.some(d => d.includes('langchain'))) detectedAiProviders.push({ name: 'LangChain', confidence: 0.9 });

        // 3. Important Files
        const importantFiles = [];
        const importantFilesCheck = [
            { path: 'Program.cs', category: 'EntryPoint', importance: 'Application entry point and service bootstrap configuration.', behavior: 'Keep startup configurations modular; register newly created services explicitly with proper lifetimes.' },
            { path: 'extension.ts', category: 'EntryPoint', importance: 'VS Code Extension entry point registering commands and watchers.', behavior: 'Follow VS Code API lifecycle guidelines; dispose registered items properly.' },
            { path: 'package.json', category: 'Config', importance: 'NodeJS dependencies, scripts, and extension triggers.', behavior: 'Maintain correct version scopes; do not add redundant libraries.' },
            { path: 'tsconfig.json', category: 'Config', importance: 'TypeScript compiler rules and path mappings.', behavior: 'Strict typing is enabled. Avoid using "any".' },
            { path: 'appsettings.json', category: 'Config', importance: 'Configuration parameters and database connection strings.', behavior: 'Do not commit credentials directly. Bind to environment variables.' },
            { path: '.env.example', category: 'Env', importance: 'Template for local environment variables.', behavior: 'Document any new environment variables here.' },
            { path: 'web-dashboard/src/pages/Dashboard.tsx', category: 'UI', importance: 'Main dashboard landing page coordinating all workspace modules.', behavior: 'Maintain consistent CSS variables and responsive flex/grid wrappers.' },
            { path: 'backend/src/Controllers/ProjectController.cs', category: 'Controller', importance: 'REST controller handling project syncs and AI context requests.', behavior: 'Always authorize requests and sanitize path strings before disk reads.' },
            { path: 'backend/src/Services/ProjectMemoryService.cs', category: 'Service', importance: 'Core business service managing database reads/writes of project context.', behavior: 'Utilize EF Core async methods; ensure transaction scopes are handled properly.' },
            { path: 'backend/src/Data/ApplicationDbContext.cs', category: 'Auth / Model', importance: 'EF Core Database context defining relational mappings and entities.', behavior: 'Perform database migrations on changes.' }
        ];

        for (const check of importantFilesCheck) {
            const foundPath = paths.find(p => p === check.path.toLowerCase() || p.endsWith('/' + check.path.toLowerCase()));
            if (foundPath) {
                const originalPath = fileNames.find(f => path.relative(projectPath, f).replace(/\\/g, '/').toLowerCase() === foundPath);
                if (originalPath) {
                    importantFiles.push({
                        path: path.relative(projectPath, originalPath).replace(/\\/g, '/'),
                        category: check.category,
                        importance: check.importance,
                        aiBehavior: check.behavior
                    });
                }
            }
        }

        // 4. Module Map (enriched with finer-grained modules)
        const moduleMap: any[] = [];
        const foldersList = [...folderStructure].map(f => f.replace('/', ''));

        // Module detection based on file analysis
        const moduleDetectors: { name: string; purpose: string; riskLevel: string; editingGuidance: string; keyFilePatterns: string[]; depNames: string[] }[] = [
            { name: 'Authentication', purpose: 'User registration, login, JWT/refresh token management, email verification, and password reset.', riskLevel: 'Critical', editingGuidance: 'Never bypass token validation or expose secrets. Test auth flows end-to-end after changes.', keyFilePatterns: ['auth'], depNames: ['Database', 'Email'] },
            { name: 'Projects', purpose: 'Project CRUD, scan uploads, context generation triggers, and context history management.', riskLevel: 'High', editingGuidance: 'Preserve tenant scoping and plan enforcement on all project endpoints.', keyFilePatterns: ['project'], depNames: ['Database', 'Context Generation'] },
            { name: 'Context Generation', purpose: 'Builds optimized .ai-context.md and AI_INSTRUCTIONS.md from project memory with semantic compression.', riskLevel: 'High', editingGuidance: 'Changes affect all AI assistant outputs. Validate token utilization and section completeness.', keyFilePatterns: ['contextgenerator', 'contextvalidator', 'contextexport'], depNames: ['Project Memory'] },
            { name: 'Architecture Guard', purpose: 'Validates codebase against architecture rules with 6 rule paradigms and AI-powered fix suggestions.', riskLevel: 'Medium', editingGuidance: 'Keep rule evaluation deterministic. AI suggest-fix requires paid plan gating.', keyFilePatterns: ['architectureguard'], depNames: ['AI Providers', 'Projects'] },
            { name: 'Billing & Payments', purpose: 'Paddle subscription lifecycle, plan enforcement, delayed cancellation, and usage metering.', riskLevel: 'Critical', editingGuidance: 'Webhook signature verification is mandatory. Never expose Paddle API keys.', keyFilePatterns: ['payment', 'billing', 'planlimit'], depNames: ['Database'] },
            { name: 'Email / Notifications', purpose: 'Transactional email via Resend API for verification, password reset, and admin test emails.', riskLevel: 'Medium', editingGuidance: 'Use environment variables for API keys. Test with admin test-email endpoint.', keyFilePatterns: ['email', 'resend'], depNames: ['External API'] },
            { name: 'AI Providers', purpose: 'Google Gemini runtime analysis with ordered free-first and paid-fallback keys, cooldown, bounded caching, and emergency disable.', riskLevel: 'Critical', editingGuidance: 'Never expose API keys. Respect global monthly caps and per-key cooldowns.', keyFilePatterns: ['aianalysis', 'hybridai', 'aiprovider'], depNames: ['External API'] },
            { name: 'Team Workspace', purpose: 'Shared project workspaces with Owner/Admin/Member/Viewer roles and project sharing.', riskLevel: 'High', editingGuidance: 'Validate team plan status and member limits. Check IsActiveTeamWorkspace before access.', keyFilePatterns: ['team'], depNames: ['Database', 'Billing'] },
            { name: 'Dashboard Client', purpose: 'React SPA displaying project memories, context history, settings, team management, and billing.', riskLevel: 'Medium', editingGuidance: 'Keep UI plan feature exposure in sync with backend enforcement flags.', keyFilePatterns: ['dashboard', 'web-dashboard'], depNames: ['API Layer'] },
            { name: 'IDE Integration', purpose: 'VS Code extension for local scans, file watching, context export, and architecture guard integration.', riskLevel: 'Medium', editingGuidance: 'Follow VS Code API lifecycle. Dispose resources properly. Test in Extension Development Host.', keyFilePatterns: ['vscode-extension', 'extension.ts'], depNames: ['API Layer'] },
            { name: 'Usage Tracking', purpose: 'Tracks scan counts, context generation counts, and AI request counts per user with atomic increments.', riskLevel: 'High', editingGuidance: 'Use atomic SQL updates for counters. Never allow client-side count manipulation.', keyFilePatterns: ['scancount', 'usagecount', 'contextgenerationcount'], depNames: ['Database'] },
        ];

        for (const detector of moduleDetectors) {
            const matchedFiles = paths.filter(p => detector.keyFilePatterns.some(pattern => p.toLowerCase().includes(pattern)));
            if (matchedFiles.length > 0 || (detector.name === 'Dashboard Client' && foldersList.includes('web-dashboard')) || (detector.name === 'IDE Integration' && foldersList.includes('vscode-extension'))) {
                moduleMap.push({
                    name: detector.name,
                    purpose: detector.purpose,
                    keyFiles: matchedFiles.slice(0, 4).map(p => {
                        const original = fileNames.find(f => path.relative(projectPath, f).replace(/\\/g, '/').toLowerCase() === p);
                        return original ? path.relative(projectPath, original).replace(/\\/g, '/') : p;
                    }),
                    dependencies: detector.depNames,
                    status: 'Active',
                    riskLevel: detector.riskLevel,
                    editingGuidance: detector.editingGuidance
                });
            }
        }

        if (moduleMap.length === 0) {
            moduleMap.push({
                name: 'Core Application',
                purpose: 'Main codebase containing all controllers, services, and models.',
                keyFiles: filesCount > 0 ? [paths[0]] : [],
                dependencies: ['External Libraries'],
                status: 'Active',
                riskLevel: 'Medium',
                editingGuidance: 'Follow existing patterns and conventions.'
            });
        }

        // 5. Architecture Summary
        let archStyle = 'Standard / Custom';
        let dataFlow = 'Incoming client requests are mapped to controllers/pages, processed, and written to persistent storage.';
        let businessLogic = 'Inferred to live in services or application layers.';
        let uiLogic = 'Frontend components and layouts.';
        let apiLogic = 'Backend routes and controllers.';
        let configLocation = 'Root config files (.env, appsettings.json, package.json).';

        if (architectureType === 'Clean Architecture') {
            archStyle = 'Clean Architecture / DDD';
            dataFlow = 'API Controllers -> Application Commands/Queries -> Domain Entities & Repository Interfaces (read via Infrastructure DB context).';
            businessLogic = 'Application layer (CQRS, Use Cases) and Domain entities.';
            uiLogic = 'Not applicable or separated UI layer.';
            apiLogic = 'WebAPI Controllers and Middlewares.';
            configLocation = 'WebAPI appsettings.json and environment bindings.';
        } else if (architectureType === 'MVC') {
            archStyle = 'Model-View-Controller (MVC)';
            dataFlow = 'Views trigger Controller endpoints -> Controllers query Models / Database -> Controllers return rendered Views or Data.';
            businessLogic = 'Controllers and Services/Helper layers.';
            uiLogic = 'Views folder (.cshtml, templates or client pages).';
            apiLogic = 'Controllers folder handling requests.';
            configLocation = 'Root config files and database connection configs.';
        } else if (foldersList.includes('backend') && foldersList.includes('web-dashboard')) {
            archStyle = 'Monorepo - Client/Server SPA + API';
            dataFlow = 'Vite React Dashboard (Frontend SPA) communicates with ASP.NET Core API Server (Backend) via REST HTTP requests.';
            businessLogic = 'backend/src/Services/ (C# services).';
            uiLogic = 'web-dashboard/src/pages/ and /components (TypeScript/Vite).';
            apiLogic = 'backend/src/Controllers/ (C# Controllers).';
            configLocation = 'Root configs in both backend/ and web-dashboard/ folders.';
        }

        const architectureSummary = {
            style: archStyle,
            dataFlowDescription: dataFlow,
            businessLogicLocation: businessLogic,
            uiLogicLocation: uiLogic,
            apiLogicLocation: apiLogic,
            configLocation: configLocation
        };

        // ── 6. Pro/Team Deep Code Analysis ──
        const routeMap: any[] = [];
        const serviceGraph: any[] = [];
        const entityMap: any[] = [];
        const dtoMap: any[] = [];
        const aiProviderMap: any[] = [];
        const planEnforcementMap: any[] = [];
        const extensionExportMap: any[] = [];
        const testBuildMap: any[] = [];

        // Read files for deep analysis with source files prioritized over generated outputs.
        const deepAnalysisExts = ['.cs', '.ts', '.tsx', '.js', '.jsx'];
        const priorityScore = (filePath: string): number => {
            const relPath = path.relative(projectPath, filePath).replace(/\\/g, '/').toLowerCase();
            if (relPath.includes('node_modules/') || relPath.includes('/dist/') || relPath.includes('/out/') || relPath.includes('/bin/') || relPath.includes('/obj/')) return -100;
            if (relPath.includes('backend/src/controllers/')) return 100;
            if (relPath.includes('backend/src/data/') || relPath.includes('backend/src/models/')) return 95;
            if (relPath.includes('backend/src/dtos/')) return 94;
            if (relPath.includes('backend/src/services/')) return 92;
            if (relPath.includes('vscode-extension/src/')) return 85;
            if (relPath.includes('web-dashboard/src/')) return 70;
            if (relPath.includes('tests/')) return 60;
            return 20;
        };
        const filesToDeepAnalyze = files
            .filter(f => deepAnalysisExts.includes(path.extname(f.fsPath).toLowerCase()))
            .map(f => ({ file: f, score: priorityScore(f.fsPath) }))
            .filter(item => item.score >= 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 400)
            .map(item => item.file);

        for (const file of filesToDeepAnalyze) {
            try {
                const data = await vscode.workspace.fs.readFile(file);
                const content = new TextDecoder('utf-8').decode(data);
                const relPath = path.relative(projectPath, file.fsPath).replace(/\\/g, '/');
                const fileName = path.basename(file.fsPath);
                const lowerPath = relPath.toLowerCase();

                // ── Route/Endpoint Detection (C# Controllers) ──
                if (lowerPath.includes('controller') && fileName.endsWith('.cs')) {
                    const controllerName = fileName.replace('.cs', '');
                    const controllerSegment = controllerName.replace(/Controller$/, '').toLowerCase();
                    const controllerRouteMatch = content.match(/\[Route\("([^"]+)"\)\]/);
                    const controllerRoute = (controllerRouteMatch?.[1] || '[controller]').replace('[controller]', controllerSegment);
                    const hasAuth = content.includes('[Authorize]') || content.includes('ResolveUserFromBearerTokenAsync');
                    const routeRegex = /\[(Http(?:Get|Post|Put|Delete|Patch))(?:\("([^"]*?)"\))?\]/g;
                    const normalizeRoute = (prefix: string, actionRoute: string | undefined): string => {
                        const parts = [prefix, actionRoute || '']
                            .map(p => p.replace(/^\//, '').replace(/\/$/, ''))
                            .filter(Boolean);
                        return `/${parts.join('/')}`.replace(/\/+/g, '/').toLowerCase();
                    };
                    let routeMatch: RegExpExecArray | null;
                    while ((routeMatch = routeRegex.exec(content)) !== null) {
                        const afterAttribute = content.slice(routeMatch.index, routeMatch.index + 700);
                        const actionMatch = afterAttribute.match(/public\s+(?:async\s+)?[\w<>,\s?]+\s+(\w+)\s*\(/);
                        routeMap.push({
                            httpMethod: routeMatch[1].replace('Http', '').toUpperCase(),
                            route: normalizeRoute(controllerRoute, routeMatch[2]),
                            controller: controllerName,
                            authRequirement: hasAuth ? 'Bearer Token' : 'Public endpoint',
                            purpose: `${controllerName}.${actionMatch?.[1] || 'endpoint'}`
                        });
                    }
                }

                // ── Service Class Detection ──
                if (fileName.endsWith('.cs') && (lowerPath.includes('service') || lowerPath.includes('services/'))) {
                    const classRegex = /public\s+class\s+(\w+Service\w*)/g;
                    let classMatch: RegExpExecArray | null;
                    while ((classMatch = classRegex.exec(content)) !== null) {
                        const serviceName = classMatch[1];
                        // Detect constructor-injected dependencies
                        const depRegex = /private\s+readonly\s+I?(\w+)\s+_/g;
                        const deps: string[] = [];
                        let depMatch: RegExpExecArray | null;
                        while ((depMatch = depRegex.exec(content)) !== null) {
                            deps.push(depMatch[1]);
                        }
                        serviceGraph.push({
                            name: serviceName,
                            path: relPath,
                            dependsOn: deps.slice(0, 8),
                            purpose: `Service class in ${path.dirname(relPath)}`
                        });
                    }
                }

                // ── Entity / Model Detection ──
                if (fileName.endsWith('.cs') && (lowerPath.includes('models/') || lowerPath.includes('data/'))) {
                    // Detect DbSet entries
                    const dbSetRegex = /DbSet<(\w+)>/g;
                    let dbSetMatch: RegExpExecArray | null;
                    while ((dbSetMatch = dbSetRegex.exec(content)) !== null) {
                        const entityName = dbSetMatch[1];
                        if (!entityMap.some(e => e.name === entityName)) {
                            entityMap.push({
                                name: entityName,
                                tablePurpose: `Entity managed by DbContext`,
                                relationships: [],
                                path: relPath
                            });
                        }
                    }
                    // Detect model classes with navigation properties
                    const modelClassRegex = /public\s+class\s+(\w+)(?:\s*:\s*\w+)?\s*\{/g;
                    let modelMatch: RegExpExecArray | null;
                    while ((modelMatch = modelClassRegex.exec(content)) !== null) {
                        const entityName = modelMatch[1];
                        if (entityName.endsWith('DbContext') || entityName.endsWith('Dto') || entityName.endsWith('Request') || entityName.endsWith('Response')) continue;
                        const navPropRegex = /public\s+(?:virtual\s+)?(?:ICollection<|List<|IList<)(\w+)>/g;
                        const rels: string[] = [];
                        let navMatch: RegExpExecArray | null;
                        while ((navMatch = navPropRegex.exec(content)) !== null) {
                            rels.push(`HasMany -> ${navMatch[1]}`);
                        }
                        const singleNavRegex = /public\s+(?:virtual\s+)?(\w+)\?\s+\w+\s*\{/g;
                        let singleMatch: RegExpExecArray | null;
                        while ((singleMatch = singleNavRegex.exec(content)) !== null) {
                            const typeName = singleMatch[1];
                            if (['string', 'int', 'bool', 'DateTime', 'Guid', 'long', 'double', 'decimal', 'List', 'Dictionary', 'UserPlan', 'TimeSpan'].includes(typeName)) continue;
                            rels.push(`BelongsTo -> ${typeName}`);
                        }
                        if (!entityMap.some(e => e.name === entityName) && (lowerPath.includes('models/') || rels.length > 0)) {
                            entityMap.push({
                                name: entityName,
                                tablePurpose: `Domain entity in ${path.dirname(relPath)}`,
                                relationships: [...new Set(rels)].slice(0, 6),
                                path: relPath
                            });
                        }
                    }
                }

                // ── DTO Detection ──
                if (fileName.endsWith('.cs') && (lowerPath.includes('dto') || lowerPath.includes('request') || lowerPath.includes('response'))) {
                    const dtoClassRegex = /public\s+class\s+(\w+(?:Dto|Request|Response|Result|Report|Details|Config|Options)\w*)/g;
                    let dtoMatch: RegExpExecArray | null;
                    while ((dtoMatch = dtoClassRegex.exec(content)) !== null) {
                        dtoMap.push({
                            name: dtoMatch[1],
                            usedBy: `Controllers/Services in ${path.dirname(relPath)}`,
                            purpose: `Data transfer object`,
                            path: relPath
                        });
                    }
                }

                // ── AI Provider Detection ──
                // Provider names in docs, exports, or scanner rules are not runtime integrations.
                // Require concrete SDK/client/HTTP evidence before reporting a provider.
                const providerDetectors = [
                    {
                        providerName: 'Google Gemini',
                        envVarNames: ['GEMINI_API_KEYS'],
                        evidence: /generativelanguage\.googleapis\.com|@google\/generative-ai|Google\.GenerativeAI|GeminiClient/i
                    },
                    {
                        providerName: 'OpenAI',
                        envVarNames: ['OPENAI_API_KEYS'],
                        evidence: /api\.openai\.com|@openai\/|\bOpenAIClient\b|\bnew\s+OpenAI\s*\(/i
                    },
                    {
                        providerName: 'Anthropic Claude',
                        envVarNames: ['ANTHROPIC_API_KEY'],
                        evidence: /api\.anthropic\.com|@anthropic-ai\/sdk|\bAnthropicClient\b|\bnew\s+Anthropic\s*\(/i
                    }
                ];
                for (const detector of providerDetectors) {
                    if (detector.evidence.test(content) && !aiProviderMap.some(p => p.providerName === detector.providerName)) {
                        aiProviderMap.push({
                            providerName: detector.providerName,
                            envVarNames: detector.envVarNames,
                            fallbackOrder: aiProviderMap.length + 1,
                            path: relPath
                        });
                    }
                }

                // ── Plan Enforcement Detection ──
                if (content.includes('PlanLimits') || content.includes('MaxContextTokens') || content.includes('MaxContextSizeTokens') || content.includes('ScanCount') || content.includes('ContextGenerationCount')) {
                    const limitRegex = /(?:PlanLimits\.(\w+)|Max(\w+Tokens|Projects|TeamMembers)|(ScanCount|ContextGenerationCount|AiRequestCount))\b/g;
                    let limitMatch: RegExpExecArray | null;
                    while ((limitMatch = limitRegex.exec(content)) !== null) {
                        const name = limitMatch[1] || limitMatch[2] || limitMatch[3];
                        if (!planEnforcementMap.some(p => p.name === name && p.path === relPath)) {
                            planEnforcementMap.push({
                                name,
                                type: name.includes('Count') ? 'Counter' : name.includes('Max') ? 'Limit' : 'Gate',
                                value: null,
                                path: relPath
                            });
                        }
                    }
                }

                // ── Extension Export Detection ──
                if (content.includes('.cursor/rules') || content.includes('CLAUDE.md') || content.includes('copilot-instructions') || content.includes('.windsurf')) {
                    const exportTargets: { editor: string; filePath: string; desc: string }[] = [
                        { editor: 'Cursor', filePath: '.cursor/rules/ai-context-brain.mdc', desc: 'Cursor IDE rules with YAML frontmatter' },
                        { editor: 'Claude Code', filePath: 'CLAUDE.md', desc: 'Claude Code project instructions' },
                        { editor: 'GitHub Copilot', filePath: '.github/copilot-instructions.md', desc: 'GitHub Copilot workspace instructions' },
                        { editor: 'Windsurf', filePath: '.windsurf/rules/ai-context-brain.md', desc: 'Windsurf IDE rules' },
                        { editor: 'Codex', filePath: 'AGENTS.md', desc: 'OpenAI Codex agent instructions' },
                        { editor: 'Aider', filePath: 'CONVENTIONS.md', desc: 'Aider conventions file' },
                    ];
                    for (const target of exportTargets) {
                        if (content.includes(target.filePath) || content.includes(target.editor.toLowerCase())) {
                            if (!extensionExportMap.some(e => e.targetEditor === target.editor)) {
                                extensionExportMap.push({
                                    targetEditor: target.editor,
                                    filePath: target.filePath,
                                    description: target.desc
                                });
                            }
                        }
                    }
                }

                // ── Test File Detection ──
                if (lowerPath.match(/\.(test|spec)\.(ts|js|mjs|cs|py)$/) || lowerPath.includes('tests/') || lowerPath.includes('__tests__/')) {
                    testBuildMap.push({
                        name: fileName,
                        type: 'Test',
                        command: fileName.endsWith('.mjs') || fileName.endsWith('.js') ? `node ${relPath}` : fileName.endsWith('.cs') ? 'dotnet test' : `npx jest ${relPath}`,
                        path: relPath
                    });
                }
            } catch {
                // Skip files that can't be read
            }
        }

        // ── Build command detection from package.json files ──
        for (const file of files) {
            if (file.fsPath.endsWith('package.json') && !file.fsPath.includes('node_modules')) {
                try {
                    const data = await vscode.workspace.fs.readFile(file);
                    const content = new TextDecoder('utf-8').decode(data);
                    const pkg = JSON.parse(content);
                    const relDir = path.relative(projectPath, path.dirname(file.fsPath)).replace(/\\/g, '/') || '.';
                    if (pkg.scripts) {
                        if (pkg.scripts.build) testBuildMap.push({ name: `${relDir} build`, type: 'Build', command: `cd ${relDir} && npm run build`, path: `${relDir}/package.json` });
                        if (pkg.scripts.compile) testBuildMap.push({ name: `${relDir} compile`, type: 'Compile', command: `cd ${relDir} && npm run compile`, path: `${relDir}/package.json` });
                        if (pkg.scripts.test) testBuildMap.push({ name: `${relDir} test`, type: 'Test', command: `cd ${relDir} && npm test`, path: `${relDir}/package.json` });
                        if (pkg.scripts.dev) testBuildMap.push({ name: `${relDir} dev`, type: 'Build', command: `cd ${relDir} && npm run dev`, path: `${relDir}/package.json` });
                    }
                } catch {
                    // Ignore malformed package metadata and retain other detected build commands.
                }
            }
        }

        // Backend build detection
        if (hasCsproj) {
            const csprojFile = fileNames.find(f => f.endsWith('.csproj'));
            if (csprojFile) {
                const relDir = path.relative(projectPath, path.dirname(csprojFile)).replace(/\\/g, '/') || '.';
                testBuildMap.push({ name: `${relDir} dotnet build`, type: 'Build', command: `cd ${relDir} && dotnet build`, path: `${relDir}/${path.basename(csprojFile)}` });
            }
        }

        return {
            name: projectName,
            path: projectPath,
            framework,
            architectureType,
            databaseType,
            authSystem,
            isIncremental,
            hasChanges: changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0,
            pendingContextUpdate: changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0,
            pendingChangeCount: pendingChanges.length,
            pendingChangedFiles: pendingPaths,
            addedFiles: changes.added.length,
            modifiedFiles: changes.modified.length,
            deletedFiles: changes.deleted.length,
            changedFiles: [...changes.added, ...changes.modified, ...changes.deleted],
            folderStructure: topFolders,
            detectedPatterns: [framework, architectureType, databaseType !== 'Unknown' ? databaseType : null, authSystem !== 'Unknown' ? authSystem : null].filter(Boolean) as string[],
            metrics: {
                filesCount,
                linesOfCode: totalLines,
                foldersCount: topFolders.filter(f => f.endsWith('/')).length,
                totalSizeBytes: totalSize,
                dependencies: [...new Set(dependencies)].slice(0, 30),
                fileExtensions,
                largestFiles: largestFiles,
                recentlyModifiedFiles: recentlyModifiedFiles,
                ignoredPaths: ignorePatterns,
                techStack: {
                    frontend: detectedFrontend.name !== 'Unknown' ? detectedFrontend : null,
                    backend: detectedBackend.name !== 'Unknown' ? detectedBackend : null,
                    database: detectedDatabase.name !== 'Unknown' ? detectedDatabase : null,
                    auth: detectedAuth.name !== 'Unknown' ? detectedAuth : null,
                    orm: detectedOrm.name !== 'Not detected' ? detectedOrm : null,
                    packageManager: detectedPackageManager,
                    deployment: detectedDeployment.name !== 'Local Executable' ? detectedDeployment : null,
                    monorepo: detectedMonorepo.name !== 'None' ? detectedMonorepo : null,
                    aiProviders: detectedAiProviders
                },
                importantFiles: importantFiles,
                moduleMap: moduleMap,
                architectureSummary: architectureSummary,
                routeMap: routeMap.length > 0 ? routeMap : undefined,
                serviceGraph: serviceGraph.length > 0 ? serviceGraph : undefined,
                entityMap: entityMap.length > 0 ? entityMap : undefined,
                dtoMap: dtoMap.length > 0 ? dtoMap : undefined,
                aiProviderMap: aiProviderMap.length > 0 ? aiProviderMap : undefined,
                planEnforcementMap: planEnforcementMap.length > 0 ? planEnforcementMap : undefined,
                extensionExportMap: extensionExportMap.length > 0 ? extensionExportMap : undefined,
                testBuildMap: testBuildMap.length > 0 ? testBuildMap : undefined
            }
        };
    }

    private async generateAiContext(projectPath: string): Promise<void> {
        try {
            const plan = await getPlanTokenLimit(this.apiClient).catch(() => ({ plan: 'Unknown', maxTokens: OPTIMISTIC_CONTEXT_TOKEN_LIMIT }));
            const result = await generateOptimizedContext(this.apiClient, projectPath, plan.maxTokens, 'full');
            await writeContextFiles(projectPath, result);

            const contextUri = vscode.Uri.joinPath(vscode.Uri.file(projectPath), '.ai-context.md');
            const document = await vscode.workspace.openTextDocument(contextUri);
            await vscode.window.showTextDocument(document);
            const sourceLabel = result.fallback ? 'fallback' : `${result.plan} / ${result.source}`;
            vscode.window.showInformationMessage(`AI context saved to .ai-context.md (${sourceLabel}, ${result.context.length} chars)`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to generate AI context: ${errorMessage}`);
        }
    }

    private buildContextFromMemory(memory: any, projectPath: string): string {
        const name = memory.name || memory.projectPath?.split(/[\\/]/).pop() || projectPath.split(/[\\/]/).pop();
        const lines: string[] = [
            `# AI Context Brain Context`,
            `Generated: ${new Date().toISOString()}`,
            `Project: ${name} (${memory.projectPath || projectPath})`,
            ``,
            `## Project Overview`,
            `- Framework: ${memory.framework || 'Unknown'}`,
            `- Architecture: ${memory.architectureType || 'Unknown'}`,
            `- Database: ${this.knownOrScanRequired(memory.databaseType)}`,
            `- Authentication: ${this.knownOrScanRequired(memory.authSystem)}`,
            `- Files: ${memory.metrics?.filesCount ?? memory.metrics?.FilesCount ?? 0}`,
            `- Lines of Code: ${(memory.metrics?.linesOfCode ?? memory.metrics?.LinesOfCode ?? 0).toLocaleString()}`,
            `- Folders: ${memory.metrics?.foldersCount ?? memory.metrics?.FoldersCount ?? 0}`,
        ];

        if (memory.folderStructure?.length) {
            lines.push(``, `## Folder Structure`);
            memory.folderStructure.slice(0, 20).forEach((f: string) => lines.push(`- ${f}`));
        }

        const rules = memory.architectureRules ?? [];
        if (rules.length) {
            lines.push(``, `## Architecture Rules`);
            rules.forEach((r: any) => lines.push(`- **${r.name || r.Name}**: ${r.pattern || r.Pattern || ''}`));
        }

        const conventions = memory.codingConventions ?? [];
        if (conventions.length) {
            lines.push(``, `## Coding Conventions`);
            conventions.forEach((c: any) => lines.push(`- **${c.name || c.Name}**: ${c.rule || c.Rule || ''}`));
        }

        const decisions = memory.systemDecisions ?? [];
        if (decisions.length) {
            lines.push(``, `## System Decisions`);
            decisions.forEach((d: any) => lines.push(`- **${d.title || d.Title}**: ${d.decision || d.Decision || ''}`));
        }

        const deps = memory.metrics?.dependencies ?? memory.metrics?.Dependencies ?? [];
        if (deps.length) {
            lines.push(``, `## Dependencies`);
            deps.slice(0, 15).forEach((d: string) => lines.push(`- ${d}`));
        }

        return lines.join('\n');
    }

    private knownOrScanRequired(value: any): string {
        if (typeof value !== 'string' || !value.trim() || value === 'Unknown' || value === 'Not detected') {
            return 'fresh scan required';
        }
        return value;
    }

    private async showProjectMemory(projectPath: string): Promise<void> {
        try {
            const memory = await this.apiClient.getProjectMemory(projectPath).catch(() => null);
            const panel = vscode.window.createWebviewPanel('projectMemory', 'Project Memory', vscode.ViewColumn.One, {});
            panel.webview.html = memory ? this.getProjectMemoryHtml(memory) : '<body style="font-family:sans-serif;padding:20px"><h2>No project memory found.</h2><p>Scan your project first.</p></body>';
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to load project memory: ${errorMessage}`);
        }
    }

    private getScanDetailsHtml(scanResult: any): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Project Scan Details</title>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
                h1 { color: var(--vscode-foreground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
                h2 { color: var(--vscode-foreground); margin-top: 30px; }
                .metric { background: var(--vscode-editor-background); padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 4px solid var(--vscode-charts-blue); }
                .pattern { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 4px 8px; margin: 2px; border-radius: 3px; display: inline-block; }
                ul { list-style-type: none; padding: 0; }
            </style>
        </head>
        <body>
            <h1>🔍 Project Scan Results</h1>
            
            <h2>📊 Project Overview</h2>
            <div class="metric"><strong>Framework:</strong> ${scanResult.framework}</div>
            <div class="metric"><strong>Architecture:</strong> ${scanResult.architectureType}</div>
            <div class="metric"><strong>Database:</strong> ${scanResult.databaseType}</div>
            <div class="metric"><strong>Authentication:</strong> ${scanResult.authSystem}</div>
            
            <h2>📈 Metrics</h2>
            <div class="metric"><strong>Files:</strong> ${scanResult.metrics.filesCount.toLocaleString()}</div>
            <div class="metric"><strong>Lines of Code:</strong> ${scanResult.metrics.linesOfCode.toLocaleString()}</div>
            <div class="metric"><strong>Folders:</strong> ${scanResult.metrics.foldersCount}</div>
            <div class="metric"><strong>Total Size:</strong> ${this.formatBytes(scanResult.metrics.totalSizeBytes)}</div>
            
            <h2>🏗️ Folder Structure</h2>
            <ul>
                ${scanResult.folderStructure.map((folder: string) => `<li>📁 ${folder}</li>`).join('')}
            </ul>
            
            <h2>🎯 Detected Patterns</h2>
            <div>
                ${scanResult.detectedPatterns.map((pattern: string) => `<span class="pattern">${pattern}</span>`).join('')}
            </div>
            
            <h2>📦 Dependencies</h2>
            <ul>
                ${scanResult.metrics.dependencies.slice(0, 20).map((dep: string) => `<li>📦 ${dep}</li>`).join('')}
            </ul>
        </body>
        </html>`;
    }

    private getProjectMemoryHtml(memory: any): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Project Memory</title>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
                h1 { color: var(--vscode-foreground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
                h2 { color: var(--vscode-foreground); margin-top: 30px; }
                .rule { background: var(--vscode-editor-background); padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid var(--vscode-charts-orange); }
                .convention { background: var(--vscode-editor-background); padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid var(--vscode-charts-green); }
                .decision { background: var(--vscode-editor-background); padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid var(--vscode-charts-purple); }
                pre { background: var(--vscode-textBlockQuote-background); padding: 10px; border-radius: 4px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>🧠 Project Memory</h1>
            <p><strong>Last Updated:</strong> ${new Date(memory.lastScanDate).toLocaleString()}</p>
            
            <h2>🏗️ Architecture Rules</h2>
            ${memory.architectureRules.map((rule: any) => `
                <div class="rule">
                    <strong>${rule.name}</strong><br>
                    ${rule.pattern}<br>
                    ${rule.description ? `<em>${rule.description}</em><br>` : ''}
                    ${rule.folderPath ? `📁 ${rule.folderPath}<br>` : ''}
                </div>
            `).join('')}
            
            <h2>📝 Coding Conventions</h2>
            ${memory.codingConventions.map((conv: any) => `
                <div class="convention">
                    <strong>${conv.name}</strong><br>
                    ${conv.rule}<br>
                    ${conv.example ? `<pre>${conv.example}</pre>` : ''}
                </div>
            `).join('')}
            
            <h2>💡 System Decisions</h2>
            ${memory.systemDecisions.map((decision: any) => `
                <div class="decision">
                    <strong>${decision.title}</strong> (${new Date(decision.decisionDate).toLocaleDateString()})<br>
                    ${decision.decision}<br>
                    ${decision.reasoning ? `<em>${decision.reasoning}</em>` : ''}
                </div>
            `).join('')}
        </body>
        </html>`;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
