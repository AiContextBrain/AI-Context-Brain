// Utility functions for AI Context Brain extension

/**
 * Formats bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncates text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Validates if a path is a valid project root
 */
export function isValidProjectPath(path: string): boolean {
    // Check for common project indicators
    const indicators = [
        'package.json',
        '.csproj',
        'pom.xml',
        'Cargo.toml',
        'go.mod',
        'requirements.txt',
        'Gemfile',
        'composer.json'
    ];
    
    // This is a simplified check - in real implementation, you'd check file existence
    return indicators.some(indicator => path.toLowerCase().includes(indicator.toLowerCase()));
}

/**
 * Extracts file extension from filename
 */
export function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Checks if file is a code file
 */
export function isCodeFile(filename: string): boolean {
    const codeExtensions = [
        'ts', 'tsx', 'js', 'jsx',
        'cs', 'java', 'py', 'php',
        'go', 'rs', 'swift', 'kt',
        'cpp', 'c', 'h', 'rb'
    ];
    return codeExtensions.includes(getFileExtension(filename));
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

/**
 * Parses AI context JSON safely
 */
export function parseAiContext(contextJson: string): any | null {
    try {
        return JSON.parse(contextJson);
    } catch {
        return null;
    }
}

/**
 * Sanitizes file path for display
 */
export function sanitizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

/**
 * Extracts project name from path
 */
export function getProjectNameFromPath(path: string): string {
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || 'Unknown Project';
}

/**
 * Formats date for display
 */
export function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Capitalizes first letter of string
 */
export function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts camelCase to Title Case
 */
export function camelCaseToTitle(str: string): string {
    return str
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}
