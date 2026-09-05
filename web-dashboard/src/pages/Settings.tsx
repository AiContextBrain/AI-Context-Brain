import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppHeader from "./AppHeader";
import { trackEvent } from "../utils/analytics";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";

type Section = "general" | "ai" | "extension" | "api";

const SIDEBAR: { id: Section; icon: string; label: string }[] = [
  { id: "general",   icon: "GE", label: "General" },
  { id: "ai",        icon: "AI", label: "AI Settings" },
  { id: "extension", icon: "EX", label: "VSCode Extension" },
  { id: "api",       icon: "AP", label: "API & Keys" },
];

export default function Settings() {
  const { user, authFetch } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const querySection = searchParams.get("section") as Section | null;
  const [section, setSection] = useState<Section>(() => {
    if (querySection && ["general", "ai", "extension", "api"].includes(querySection)) {
      return querySection;
    }
    return "general";
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [planStatus, setPlanStatus] = useState<any>(null);

  const handleSectionChange = (newSection: Section) => {
    setSection(newSection);
    setSearchParams({ section: newSection });
  };

  useEffect(() => {
    if (querySection && ["general", "ai", "extension", "api"].includes(querySection) && querySection !== section) {
      setSection(querySection);
    }
  }, [querySection]);
  const [settings, setSettings] = useState({
    notifications: true,
    autoScan: false,
    darkMode: true,
    aiProvider: "auto" as "auto" | "gemini",
    maxTokens: 8000,
    contextFormat: "json" as "json" | "markdown",
    apiUrl: API_BASE,
  });

  const planName = user?.plan ?? "Free";
  const hasApiAccess = planName !== "Free";
  const maxContextTokens = planName === "Free" ? 2000 : 32000;
  const contextCapacityPercent = Math.min(100, Math.round((Math.min(settings.maxTokens, maxContextTokens) / maxContextTokens) * 100));
  const sidebar = SIDEBAR.filter(item => item.id !== "api" || hasApiAccess);
  const update = (key: string, val: any) => setSettings(s => ({ ...s, [key]: val }));

  useEffect(() => {
    if (!hasApiAccess && section === "api") {
      handleSectionChange("general");
    }
  }, [hasApiAccess, section]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await authFetch(`${API_BASE}/settings`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setSettings(s => ({ ...s, ...data }));
        }
      } catch {
        if (!cancelled) setSaveError("Settings could not be loaded.");
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    };

    loadSettings();
    return () => { cancelled = true; };
  }, [user, authFetch]);

  // Fetch plan status
  const fetchPlanStatus = useCallback(async () => {
    if (!user) return;
    try {
      const r = await authFetch(`${API_BASE}/user/plan-status`);
      if (r.ok) setPlanStatus(await r.json());
    } catch {}
  }, [user, authFetch]);

  useEffect(() => { fetchPlanStatus(); }, [fetchPlanStatus]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await authFetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...settings, maxTokens: Math.min(settings.maxTokens, maxContextTokens) }),
      });

      if (!response.ok) throw new Error("Settings save failed");

      const data = await response.json();
      setSettings(s => ({ ...s, ...data }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(user?.token ?? "");
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <AppHeader title="Settings" onSave={handleSave} saveLabel="Save Changes" saveState={saving ? "saving" : saved ? "saved" : "idle"} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-6 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sidebar.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSectionChange(s.id)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  section === s.id
                    ? "bg-white/[0.08] text-white"
                    : "bg-[#111422] text-[#8b91b3] border border-white/[0.06]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-6">
          <div className="hidden w-52 shrink-0 lg:block">
            <div className="card sticky top-24 space-y-0.5 p-2">
              {sidebar.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSectionChange(s.id)}
                  className={`sidebar-item w-full ${section === s.id ? "active" : ""}`}
                >
                  <span className="sidebar-icon">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {loadingSettings && (
              <div className="card mb-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Loading saved settings...
              </div>
            )}
            {saveError && (
              <div className="card mb-4 text-xs font-semibold" style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.25)" }}>
                {saveError}
              </div>
            )}

            {/* General */}
            {section === "general" && (
              <div className="space-y-6">
                <div className="card space-y-6">
                  <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>General Settings</h2>
                  {[
                    { key: "notifications", label: "Email Notifications", sub: "Receive context optimization reports and alerts" },
                    { key: "autoScan", label: "Auto Scan on Workspace Open", sub: "VS Code snippet: one silent metadata scan on open, no AI generation" },
                    { key: "darkMode", label: "Dark Mode", sub: "Always on — our only mode 🖤" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.sub}</p>
                      </div>
                      <button onClick={() => update(item.key, !(settings as any)[item.key])} disabled={item.key === "darkMode"}
                        className="relative w-11 h-6 rounded-full transition-all duration-200 disabled:opacity-50"
                        style={{ background: (settings as any)[item.key] ? "linear-gradient(135deg,#4f7cff,#6366f1)" : "var(--bg-muted)", border: "1px solid var(--border)" }}>
                        <span className="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full bg-white shadow"
                          style={{ left: (settings as any)[item.key] ? "calc(100% - 22px)" : "2px" }}/>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Subscription Plan & Limits */}
                {planStatus && (
                  <div className="card space-y-5" style={{ borderColor: "rgba(79,124,255,0.15)" }}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Subscription Plan & Limits</h3>
                      {planStatus.currentPlan === "Free" && (
                        <button onClick={() => navigate("/plans")} className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg"
                          style={{ background: "rgba(79,124,255,0.1)", color: "#4f7cff", border: "1px solid rgba(79,124,255,0.2)" }}>Upgrade</button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="rounded-xl p-3" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Current Plan</p>
                        <p className="text-sm font-extrabold mt-1" style={{ color: planStatus.currentPlan === "Free" ? "#8b91b3" : planStatus.currentPlan === "Pro" ? "#4f7cff" : "#8b5cf6" }}>{planStatus.currentPlan}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Max Context Size</p>
                        <p className="text-sm font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{(planStatus.maxContextSize / 1000).toFixed(0)}k</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Projects</p>
                        <p className="text-sm font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{planStatus.currentProjects} / {planStatus.maxProjects}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Context Refreshes</p>
                        <p className="text-sm font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{planStatus.usedContextRefreshes} / {planStatus.maxContextRefreshes}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>AI Requests</p>
                        <p className="text-sm font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{planStatus.usedAIRequests} / {planStatus.maxAIRequests}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Reset Date</p>
                        <p className="text-sm font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{new Date(planStatus.nextResetDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Settings */}
            {section === "ai" && (
              <div className="card space-y-6">
                <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>AI Settings</h2>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>AI Provider Routing</label>
                  <div className="rounded-xl p-4" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Server-managed fallback</p>
                    <p className="text-xs mt-1 leading-5" style={{ color: "var(--text-muted)" }}>
                      AI Context Brain uses Gemini priority routing in production. The free Gemini key is tried first, and the paid fallback key is used only while the preferred key is cooling down.
                      User-facing provider selection is disabled so quota, failover, and cooldown rules stay predictable.
                    </p>
                  </div>
                  <div className="hidden grid grid-cols-2 gap-3">
                    {[
                      { id: "auto",   icon: "AI", label: "Auto", sub: "Gemini priority fallback" },
                      { id: "gemini", icon: "G", label: "Gemini", sub: "Free key first, paid key fallback" },
                    ].map(p => (
                      <button key={p.id} onClick={() => update("aiProvider", p.id)}
                        className="card text-left p-4 transition-all duration-200"
                        style={settings.aiProvider === p.id ? { borderColor: "rgba(79,124,255,0.5)", background: "rgba(79,124,255,0.06)" } : {}}>
                        <div className="text-xl mb-2">{p.icon}</div>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{p.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.sub}</p>
                        {settings.aiProvider === p.id && <div className="mt-2 w-2 h-2 rounded-full" style={{ background: "#4f7cff" }}/>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Context Capacity Limit</label>
                    <span className="badge-blue">
                      {Math.min(settings.maxTokens, maxContextTokens).toLocaleString()} / {maxContextTokens.toLocaleString()} tokens ({contextCapacityPercent}%)
                    </span>
                  </div>
                  <input type="range" min={1000} max={maxContextTokens} step={1000} value={Math.min(settings.maxTokens, maxContextTokens)}
                    onChange={e => update("maxTokens", +e.target.value)}
                    className="w-full accent-blue-500" />
                  <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    <span>Compact</span><span>{planName === "Free" ? "Free allowance" : `${planName} limit`}</span><span>Full</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>Context Format</label>
                  <div className="flex gap-3">
                    {[{ id: "json", label: "JSON" }, { id: "markdown", label: "Markdown" }].map(f => (
                      <button key={f.id} onClick={() => update("contextFormat", f.id)}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                        style={settings.contextFormat === f.id
                          ? { background: "linear-gradient(135deg,#4f7cff,#6366f1)", color: "#fff", boxShadow: "0 4px 16px rgba(79,124,255,0.3)" }
                          : { background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Extension */}
            {section === "extension" && (
              <div className="card space-y-5">
                <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>AI Tool Extension</h2>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>API Base URL</label>
                  <input className="input font-mono text-sm" value={settings.apiUrl} onChange={e => update("apiUrl", e.target.value)} />
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Change only if using a self-hosted backend.</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>settings.json snippet</p>
                  <pre className="rounded-xl p-4 text-xs font-mono overflow-auto" style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "#a5b4fc" }}>
{`{
  "aiContextBrain.apiUrl": "${settings.apiUrl}",
  "aiContextBrain.autoScan": ${settings.autoScan},
  "aiContextBrain.autoSync": true,
  "aiContextBrain.autoExportOnScan": false
}`}
                  </pre>
                </div>
                <div className="mt-4">
                  <a href="https://marketplace.visualstudio.com/items?itemName=ai-project-brain.ai-project-brain"
                    target="_blank" rel="noreferrer" onClick={() => trackEvent("install_extension_click", { location: "settings_page" })}
                    className="btn-primary text-sm py-2.5 px-6 inline-flex">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.88V4.12a1.5 1.5 0 0 0-.85-1.533z"/></svg>
                    Open Marketplace
                  </a>
                </div>

                <hr className="border-white/[0.04] my-5" />

                <div>
                  <h3 className="text-sm font-bold mb-2 text-white">Repository Scan & Ignore Settings</h3>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
                    Excluding build directories, test files, and static assets helps optimize your context generation and stay within your plan's token capacity (<strong>{maxContextTokens.toLocaleString()} tokens</strong>). AI Context Brain reads exclusions directly from <code>.brainignore</code> or <code>.gitignore</code> files in the root of your project directory.
                  </p>
                  
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Recommended .brainignore template</span>
                    <button onClick={() => {
                      navigator.clipboard.writeText(`# AI Context Brain — Ignore File\n# Patterns in this file are excluded from AI scanning\n\n# Build outputs\ndist/\nbuild/\nout/\nbin/\nobj/\n\n# Dependencies\nnode_modules/\nvendor/\n__pycache__/\n*.pyc\n\n# Temp and Logs\n*.log\n*.tmp\ncoverage/\n.nyc_output/\n\n# IDE settings\n.vs/\n.idea/\n`);
                      showAlert("Template copied to clipboard!", "success");
                    }} className="text-[10px] text-blue-400 font-bold hover:underline">📋 Copy Template</button>
                  </div>
                  <pre className="rounded-xl p-4 text-xs font-mono overflow-auto" style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "#a5b4fc" }}>
{`# AI Context Brain — Ignore File
# Patterns in this file are excluded from AI scanning

# Build outputs
dist/
build/
out/
bin/
obj/

# Dependencies
node_modules/
vendor/
__pycache__/
*.pyc

# Temp and Logs
*.log
*.tmp
coverage/
.nyc_output/

# IDE settings
.vs/
.idea/`}
                  </pre>
                </div>
              </div>
            )}

            {/* API & Keys */}
            {section === "api" && hasApiAccess && (
              <div className="card space-y-5">
                <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>API & Keys</h2>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>Your Access Key</label>
                  <div className="flex gap-2">
                    <input type="password" className="input font-mono text-sm flex-1" value={user?.token ?? "Not available"} readOnly />
                    <button onClick={handleCopyKey} className={`${copied ? "btn-success" : "btn-secondary"} text-sm px-4 shrink-0`}>
                      {copied ? "✓" : "📋"}
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Use this key in your AI tool extension or API calls.</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>Available Endpoints</p>
                  <div className="space-y-2">
                    {[
                      { method: "POST", path: "/auth/login", desc: "Authenticate user" },
                      { method: "POST", path: "/project/scan-repo", desc: "Collect context signals" },
                      { method: "GET",  path: "/user/projects", desc: "List user projects" },
                      { method: "POST", path: "/project/generate-context", desc: "Generate optimized AI context" },
                      { method: "GET",  path: "/project/context-history", desc: "List context history" },
                    ].map(ep => (
                      <div key={ep.path} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
                        <span className={`badge text-xs ${ep.method === "GET" ? "badge-green" : "badge-blue"}`}>{ep.method}</span>
                        <code className="text-xs font-mono flex-1" style={{ color: "#a5b4fc" }}>{ep.path}</code>
                        <span className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>{ep.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
