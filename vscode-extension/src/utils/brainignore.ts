import * as path from 'path';
import * as fs from 'fs';

export interface IgnorePattern {
    pattern: string;
    isNegation: boolean;
    isDirectory: boolean;
}

export class BrainIgnore {
    private static readonly DEFAULT_PATTERNS = [
        '**/node_modules/**', '**/.git/**', '**/bin/**', '**/obj/**', '**/dist/**', '**/.next/**',
        '**/.brain-cache/**', '**/*.log', '**/.DS_Store', '**/Thumbs.db',
        '**/__pycache__/**', '**/*.pyc', '**/.pytest_cache/**', '**/.mypy_cache/**',
        '**/coverage/**', '**/.nyc_output/**', '**/.cache/**', '**/.tmp/**',
        '**/*.min.js', '**/*.min.css', '**/*.map',
        '**/*.mp4', '**/*.mp3', '**/*.zip', '**/*.tar.gz', '**/*.rar',
        '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.ico', '**/*.svg',
        '**/*.woff', '**/*.woff2', '**/*.ttf', '**/*.eot',
        '**/.vs/**', '**/.idea/**', '**/*.suo', '**/*.user',
        '**/vendor/**', '**/packages/**', '**/.terraform/**',
        '**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml'
    ];

    /**
     * Loads patterns from .brainignore and optionally .gitignore
     */
    public static async loadPatterns(projectPath: string): Promise<string[]> {
        const patternsSet = new Set<string>(this.DEFAULT_PATTERNS);
        
        // 1. Try to load .brainignore
        const brainIgnorePath = path.join(projectPath, '.brainignore');
        if (fs.existsSync(brainIgnorePath)) {
            try {
                const content = fs.readFileSync(brainIgnorePath, 'utf8');
                this.parseIgnoreContent(content).forEach(p => patternsSet.add(p));
            } catch (err) {
                console.error('Failed to read .brainignore', err);
            }
        } else {
            // Create default .brainignore if it doesn't exist
            try {
                const defaultContent = `# AI Context Brain — Ignore File\n# Patterns in this file are excluded from AI scanning\n\n# Build outputs\ndist/\nbuild/\nout/\nbin/\nobj/\n\n# Dependencies\nnode_modules/\nvendor/\n__pycache__/\n*.pyc\n\n# Temp and Logs\n*.log\n*.tmp\ncoverage/\n.nyc_output/\n\n# IDE settings\n.vs/\n.idea/\n`;
                fs.writeFileSync(brainIgnorePath, defaultContent, 'utf8');
            } catch (error) {
                console.warn('AI Context Brain could not create the default .brainignore file.', error);
            }
        }

        // 2. Try to load .gitignore optionally
        const gitIgnorePath = path.join(projectPath, '.gitignore');
        if (fs.existsSync(gitIgnorePath)) {
            try {
                const content = fs.readFileSync(gitIgnorePath, 'utf8');
                this.parseIgnoreContent(content).forEach(p => patternsSet.add(p));
            } catch (err) {
                console.error('Failed to read .gitignore', err);
            }
        }

        return Array.from(patternsSet);
    }

    /**
     * Converts list of gitignore-like patterns to VS Code findFiles exclude glob format
     */
    public static toVSCodeExcludeGlob(patterns: string[]): string {
        const cleanPatterns = patterns
            .filter(p => !p.startsWith('!')) // skip negation for VS Code excludes
            .map(p => {
                let glob = p.trim();
                // Normalize slashes
                glob = glob.replace(/\\/g, '/');
                
                // If it starts with / or ./, remove it for glob
                if (glob.startsWith('./')) {
                    glob = glob.substring(2);
                } else if (glob.startsWith('/')) {
                    glob = glob.substring(1);
                }

                // If it ends with /, make it recursive directory match
                if (glob.endsWith('/')) {
                    return `**/${glob}**`;
                }

                // Standard globbing
                if (!glob.includes('/') && !glob.startsWith('**')) {
                    return `**/${glob}`;
                }

                return glob;
            });

        // Merge into a VS Code brace block {pattern1,pattern2,...}
        if (cleanPatterns.length === 0) {
            return '';
        }
        if (cleanPatterns.length === 1) {
            return cleanPatterns[0];
        }
        return `{${cleanPatterns.join(',')}}`;
    }

    /**
     * Returns true if file path matches any ignore patterns (simple check)
     */
    public static shouldIgnore(filePath: string, patterns: string[]): boolean {
        const normPath = filePath.replace(/\\/g, '/');
        
        for (const pattern of patterns) {
            if (!pattern || pattern.startsWith('#')) {
                continue;
            }

            const cleanPattern = pattern.trim().replace(/\\/g, '/');
            const isNegation = cleanPattern.startsWith('!');
            const matchPattern = isNegation ? cleanPattern.substring(1) : cleanPattern;

            // Simple regex match for ignore pattern
            const regexStr = matchPattern
                .replace(/\./g, '\\.')
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\/$/, '/.*');
            
            const regex = new RegExp(regexStr.startsWith('/') ? '^' + regexStr : regexStr);
            
            if (regex.test(normPath)) {
                return !isNegation;
            }
        }
        return false;
    }

    private static parseIgnoreContent(content: string): string[] {
        return content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
    }
}
