import * as vscode from 'vscode';

const DEFAULT_API_URL = 'https://api.aicontextbrain.me';

export interface GeneratedContextResponse {
    context: string;
    instructions: string;
    plan?: string;
    maxTokens?: number;
    maxContextSizeTokens?: number;
    source?: string;
    historySaved?: boolean;
    quality?: any;
    confidence?: any;
    validation?: any;
}

export class ApiClient {
    private context: vscode.ExtensionContext;
    private token: string | undefined;
    private baseUrl: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.baseUrl = vscode.workspace.getConfiguration('aiContextBrain').get<string>('apiUrl') || DEFAULT_API_URL;
        
        // Load token from secure storage
        this.loadToken();
    }

    async loadToken(): Promise<void> {
        this.token = await this.context.secrets.get('aiContextBrain.apiToken');
    }

    private async saveToken(token: string): Promise<void> {
        await this.context.secrets.store('aiContextBrain.apiToken', token);
        this.token = token;
    }

    async saveTokenPublic(token: string): Promise<void> {
        await this.saveToken(token);
    }

    async authenticate(email: string, password: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Authentication failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        const token = data.token || data.user?.token;
        if (!token) {
            throw new Error('No token received from server');
        }

        await this.saveToken(token);
        return token;
    }

    async register(email: string, password: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || `Registration failed: ${response.statusText}`);
        }

        const data = await response.json();
        const token = data.token || data.user?.token;
        if (!token) {
            throw new Error('No token received from server');
        }
        await this.saveToken(token);
        return token;
    }

    async scanProject(projectPath: string, projectData: any): Promise<any> {
        this.ensureAuthenticated();

        const response = await fetch(`${this.baseUrl}/project/scan-repo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ projectPath, ...projectData })
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired. Please login again.');
            }
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 429) {
                throw new Error(`🚫 Scan limit reached (${errorData.limit} scans/month on ${errorData.plan} plan).\nUpgrade at: ${errorData.upgradeUrl || 'https://aicontextbrain.me/pricing'}`);
            }
            if (response.status === 403 && errorData.error === 'project_limit_reached') {
                throw new Error(`🚫 Project limit reached (${errorData.limit} projects on ${errorData.plan} plan).\nUpgrade at: ${errorData.upgradeUrl || 'https://aicontextbrain.me/pricing'}`);
            }
            throw new Error(errorData.message || `Scan failed: ${response.statusText}`);
        }

        return response.json();
    }

    async generateContext(projectPath: string, maxTokens: number = 2000): Promise<GeneratedContextResponse> {
        this.ensureAuthenticated();

        const response = await fetch(`${this.baseUrl}/project/generate-context`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ projectPath, maxTokens })
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired. Please login again.');
            }
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 429) {
                const reset = errorData.resetDate ? ` Resets ${new Date(errorData.resetDate).toLocaleDateString()}.` : '';
                const used = errorData.used !== undefined && errorData.limit !== undefined ? ` ${errorData.used}/${errorData.limit} used.` : '';
                const upgrade = errorData.upgradeUrl ? ` Upgrade: ${errorData.upgradeUrl}` : '';
                throw new Error(`${errorData.message || 'Usage limit reached.'}${used}${reset}${upgrade}`);
            }
            throw new Error(errorData.message || `Context generation failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            context: data.context || '',
            instructions: data.instructions || '',
            plan: data.plan,
            maxTokens: data.maxContextSizeTokens ?? data.maxTokens,
            maxContextSizeTokens: data.maxContextSizeTokens,
            source: data.source,
            historySaved: data.historySaved,
            quality: data.quality,
            confidence: data.confidence,
            validation: data.validation
        };
    }

    async getProjectMemory(projectPath: string): Promise<any> {
        this.ensureAuthenticated();

        const encodedPath = encodeURIComponent(projectPath);
        const response = await fetch(`${this.baseUrl}/project/project-memory?projectPath=${encodedPath}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired. Please login again.');
            }
            if (response.status === 404) {
                return null; // Project not found
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to get project memory: ${response.statusText}`);
        }

        return response.json();
    }

    async getUserProjects(): Promise<any[]> {
        this.ensureAuthenticated();

        const response = await fetch(`${this.baseUrl}/user/projects`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired. Please login again.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to get projects: ${response.statusText}`);
        }

        const data = await response.json();
        return data.projects || [];
    }

    async validateArchitecture(projectPath: string, filePath: string): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/architectureguard/validate-file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ projectPath, filePath })
        });
        if (!response.ok) return null;
        return response.json();
    }

    async updateProjectMemory(projectPath: string, update: { architectureRule?: string; codingConvention?: string; systemDecision?: string }): Promise<void> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/update-memory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ projectPath, ...update })
        });
        if (!response.ok && response.status !== 401) return;
        if (response.status === 401) { this.logout(); throw new Error('Session expired.'); }
    }

    async getPlanFeatures(): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/user/plan-features`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) { return null; }
        return response.json();
    }

    async suggestFix(data: { filePath: string; fileContent?: string; ruleName: string; rulePattern: string; ruleType: string; violationLine: number; autoFixSuggestion?: string }): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/architectureguard/suggest-fix`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to get fix suggestion');
        }
        return response.json();
    }

    async createArchitectureRule(data: any): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/architecture-rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create rule');
        return response.json();
    }

    async updateArchitectureRule(id: string, data: any): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/architecture-rules/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update rule');
        return response.json();
    }

    async deleteArchitectureRule(id: string): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/architecture-rules/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to delete rule');
        return response.json();
    }

    async toggleArchitectureRule(id: string): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/architecture-rules/${id}/toggle`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to toggle rule');
        return response.json();
    }

    async getRuleTemplates(): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/architecture-rules/templates`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to load templates');
        return response.json();
    }

    async initializeProject(projectPath: string): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ projectPath })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to initialize project on cloud.');
        }
        return response.json();
    }

    async getWizardBlueprint(projectId: string): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/${encodeURIComponent(projectId)}/wizard-blueprint`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired. Please login again.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to fetch blueprint: ${response.statusText}`);
        }
        return response.json();
    }

    async initializeLocal(projectId: string, localPath: string, workspaceName?: string): Promise<any> {
        this.ensureAuthenticated();
        const response = await fetch(`${this.baseUrl}/project/${encodeURIComponent(projectId)}/initialize-local`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ localPath, workspaceName })
        });
        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired. Please login again.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to initialize local workspace: ${response.statusText}`);
        }
        return response.json();
    }

    isAuthenticated(): boolean {
        return !!this.token;
    }

    async logout(): Promise<void> {
        await this.context.secrets.delete('aiContextBrain.apiToken');
        this.token = undefined;
    }

    private ensureAuthenticated(): void {
        if (!this.token) {
            throw new Error('Not authenticated. Please login first.');
        }
    }

    // Get current API URL (for debugging)
    getApiUrl(): string {
        return this.baseUrl;
    }
}

// Singleton instance
let apiClientInstance: ApiClient | undefined;

export function getApiClient(context?: vscode.ExtensionContext): ApiClient {
    if (!apiClientInstance && context) {
        apiClientInstance = new ApiClient(context);
    }
    if (!apiClientInstance) {
        throw new Error('ApiClient not initialized');
    }
    return apiClientInstance;
}
