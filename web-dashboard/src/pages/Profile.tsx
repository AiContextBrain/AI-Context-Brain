import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import AppHeader from "./AppHeader";
import { SkeletonBlock } from "../components/LoadingState";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";

function formatPlanLimit(limit: number): string {
  return Number.isFinite(limit) ? limit.toLocaleString() : "-";
}

interface SubInfo {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  willDowngradeAtPeriodEnd?: boolean;
  downgradeAt?: string | null;
  subscriptionId: string | null;
}

interface UsageInfo {
  projectsUsed: number;
  projectsLimit: number;
  scansUsed: number;
  scansLimit: number;
  scansResetDate: string;
}

export default function Profile() {
  const { user, logout, authFetch, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"profile" | "subscription" | "danger">("profile");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [billingAction, setBillingAction] = useState<"cancel" | "resume" | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username || "");
    fetchSubscription();
    fetchUsage();
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const r = await authFetch(`${API_BASE}/payment/subscription`);
      if (r.ok) setSub(await r.json());
    } catch {}
  };

  const fetchUsage = async () => {
    try {
      const r = await authFetch(`${API_BASE}/user/me`);
      if (r.ok) {
        const d = await r.json();
        setUsage(d.usage);
      }
    } catch {}
  };

  const updateSubscription = async (action: "cancel" | "resume") => {
    if (action === "cancel" && !confirm("Cancel at the end of the current billing period? Your paid access continues until the period ends.")) {
      return;
    }

    setBillingAction(action);
    try {
      const endpoint = action === "cancel"
        ? `${API_BASE}/payment/subscription/cancel`
        : `${API_BASE}/payment/subscription/resume`;
      const r = await authFetch(endpoint, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        showAlert(data.error || data.message || "Could not update subscription.", "error");
        return;
      }
      setSub({
        plan: data.plan ?? sub?.plan ?? user?.plan ?? "Free",
        status: data.status ?? sub?.status ?? "active",
        currentPeriodEnd: data.currentPeriodEnd ?? sub?.currentPeriodEnd ?? null,
        willDowngradeAtPeriodEnd: Boolean(data.willDowngradeAtPeriodEnd),
        downgradeAt: data.downgradeAt ?? null,
        subscriptionId: sub?.subscriptionId ?? null,
      });
      await fetchSubscription();
      await fetchUsage();
    } catch {
      showAlert("Network error.", "error");
    } finally {
      setBillingAction(null);
    }
  };

  const exportData = async () => {
    try {
      const r = await fetch(`${API_BASE}/user/export`, {
        headers: { Authorization: `Bearer ${user!.token}` }
      });
      if (!r.ok) {
        showAlert("Could not export data.", "error");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-context-brain-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showAlert("Network error.", "error");
    }
  };

  const initials = user?.email?.[0]?.toUpperCase() ?? "U";
  const planStatus = sub?.willDowngradeAtPeriodEnd
    ? "Cancels at period end"
    : sub?.status === "active" || !sub?.status || sub?.status === "none"
      ? "Active"
      : sub?.status === "cancelled" || sub?.status === "canceled"
        ? "Cancelled"
        : sub?.status;
  const planStatusClass = sub?.willDowngradeAtPeriodEnd
    ? "badge-blue"
    : sub?.status === "active" || !sub?.status || sub?.status === "none"
      ? "badge-green"
      : "badge-blue";

  const handleSave = async () => {
    if (!username.trim()) {
      showAlert("Username is required.", "error");
      return;
    }
    if (password && password.length < 8) {
      showAlert("Password must be at least 8 characters.", "error");
      return;
    }

    setSaving(true);
    try {
      const r = await authFetch(`${API_BASE}/user/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (r.ok) {
        setSaved(true);
        showAlert("Profile updated successfully!", "success");
        setTimeout(() => setSaved(false), 2000);
        setPassword("");
        await refreshUser();
      } else {
        showAlert(data.error || data.message || "Failed to update profile.", "error");
      }
    } catch {
      showAlert("Network error.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const TABS = [
    { id: "profile", label: "Profile" },
    { id: "subscription", label: "Subscription" },
    { id: "danger", label: "Danger Zone" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <AppHeader title="Profile" onSignOut={handleLogout} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Avatar section */}
        <div className="flex items-center gap-5 mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl" style={{ background: "linear-gradient(135deg,#4f7cff,#8b5cf6)", boxShadow: "0 8px 32px rgba(79,124,255,0.35)" }}>
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>{user?.email}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="badge-blue">{sub?.plan ?? user?.plan ?? "Free"} Plan</span>
              <span className={planStatusClass}>{planStatus}</span>
              {user?.isEmailVerified ? (
                <span className="badge-green">✓ Verified</span>
              ) : (
                <span className="badge-blue" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.2)" }}>⚠️ Unverified</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
              style={tab === t.id
                ? t.id === "danger"
                  ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }
                  : { background: "linear-gradient(135deg,#4f7cff,#6366f1)", color: "#fff", boxShadow: "0 4px 12px rgba(79,124,255,0.3)" }
                : { color: "var(--text-muted)" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab === "profile" && (
          <div className="card space-y-5">
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>Account Details</h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
              <div className="flex gap-2">
                <input className="input opacity-60 flex-1" value={user?.email ?? ""} disabled />
                {!user?.isEmailVerified && (
                  <button
                    disabled={sendingVerification}
                    onClick={async () => {
                      setSendingVerification(true);
                      try {
                        const r = await authFetch(`${API_BASE}/auth/resend-verification`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: user?.email }),
                        });
                        const data = await r.json();
                        if (r.ok) {
                          showAlert("Verification email resent!", "success");
                        } else {
                          showAlert(data.message || data.error || "Failed to resend verification.", "error");
                        }
                      } catch {
                        showAlert("Network error.", "error");
                      } finally {
                        setSendingVerification(false);
                      }
                    }}
                    className="btn-secondary text-xs py-2.5 px-4 shrink-0 disabled:opacity-50"
                    style={{ color: "#7ba3ff", borderColor: "rgba(79,124,255,0.25)" }}
                  >
                    {sendingVerification ? "Sending..." : "Resend Verification"}
                  </button>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {user?.isEmailVerified ? "Email is verified." : "Email is unverified. Click above to resend verification link."}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>Username</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>New Password</label>
              <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
            </div>
            <button onClick={handleSave} disabled={saving} className={`${saved ? "btn-success" : "btn-primary"} py-2.5 px-6 disabled:opacity-50`}>
              {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
            </button>
          </div>
        )}

        {/* Subscription Tab */}
        {tab === "subscription" && (
          <div className="space-y-4">
            {/* Current plan card */}
            <div className="card" style={{ background: "linear-gradient(135deg, rgba(79,124,255,0.06), rgba(139,92,246,0.06))", borderColor: "rgba(79,124,255,0.2)" }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                    {sub?.plan ?? user?.plan ?? "Free"} Plan
                  </h3>
                  {sub?.currentPeriodEnd && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {sub.willDowngradeAtPeriodEnd ? "Access until" : "Renews"} {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                  {sub?.willDowngradeAtPeriodEnd && (
                    <p className="text-xs mt-1" style={{ color: "#93c5fd" }}>
                      Your paid features remain active until the billing period ends.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${planStatusClass}`}>
                    {planStatus}
                  </span>
                  {sub?.subscriptionId && !sub?.willDowngradeAtPeriodEnd && (sub?.plan ?? user?.plan) !== "Free" && (
                    <button
                      onClick={() => updateSubscription("cancel")}
                      disabled={billingAction !== null}
                      className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
                      style={{ borderColor: "rgba(239,68,68,0.3)", color: "#f87171" }}
                    >
                      {billingAction === "cancel" ? "Cancelling..." : "Cancel at Period End"}
                    </button>
                  )}
                  {sub?.subscriptionId && sub?.willDowngradeAtPeriodEnd && (
                    <button
                      onClick={() => updateSubscription("resume")}
                      disabled={billingAction !== null}
                      className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                    >
                      {billingAction === "resume" ? "Resuming..." : "Resume Subscription"}
                    </button>
                  )}
                </div>
              </div>

              {/* Usage bars */}
              <div className="space-y-3">
                {usage ? (
                  <>
                    {[
                      { label: "Projects", used: usage.projectsUsed, max: usage.projectsLimit },
                      { label: "Scans this month", used: usage.scansUsed, max: usage.scansLimit },
                    ].map(u => (
                      <div key={u.label}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: "var(--text-secondary)" }}>{u.label}</span>
                          <span style={{ color: (u.max < 999 && u.used / u.max > 0.8) ? "#f87171" : "var(--text-muted)" }}>
                            {formatPlanLimit(u.used)} / {formatPlanLimit(u.max)}
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{
                            width: `${u.max >= 999 ? 0 : Math.min(100, (u.used / u.max) * 100)}%`,
                            background: (u.max < 999 && u.used / u.max > 0.8) ? "#ef4444" : undefined
                          }}/>
                        </div>
                      </div>
                    ))}
                    {usage.scansResetDate && (
                      <p className="text-xs pt-1" style={{ color: "var(--text-muted)" }}>
                        Scans reset {new Date(usage.scansResetDate).toLocaleDateString()}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <SkeletonBlock rows={4} />
                  </div>
                )}
              </div>
            </div>

            {/* Upgrade card — only show if not Team */}
            {(sub?.plan ?? user?.plan ?? "Free") !== "Team" && (
              <div className="card text-center py-8" style={{ borderColor: "rgba(79,124,255,0.2)" }}>
                <div className="text-3xl mb-3">⭐</div>
                <h3 className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                  {(sub?.plan ?? user?.plan ?? "Free") === "Free" ? "Upgrade to Pro" : "Upgrade to Team"}
                </h3>
                <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
                  {(sub?.plan ?? user?.plan ?? "Free") === "Free" ? (
                    <>
                      <span style={{ display: "none" }}>Up to 999 Project Memories</span>
                      Up to 999 Project Memories, 500 context refreshes/month, priority AI
                    </>
                  ) : (
                    "Shared workspace, up to 10 people, member access management and team activity history"
                  )}
                </p>
                <button onClick={() => navigate("/plans")} className="btn-primary py-2.5 px-8">View Plans</button>
              </div>
            )}
          </div>
        )}

        {/* Danger Zone Tab */}
        {tab === "danger" && (
          <div className="space-y-4">
            {[
              { icon: "📤", title: "Export Data", sub: "Download all your projects and context data.", btn: "Export", color: "#06b6d4", action: exportData },
              { icon: "🔄", title: "Reset All Data", sub: "Delete all scans and context. Projects remain.", btn: "Reset Data", color: "#f59e0b", action: () => confirm("Reset all data?") },
              { icon: "🗑️", title: "Delete Account", sub: "Permanently delete your account and all data. Irreversible.", btn: "Delete Account", color: "#ef4444", action: () => confirm("Are you absolutely sure?") },
            ].map(item => (
              <div key={item.title} className="card flex items-center justify-between gap-4" style={{ borderColor: `${item.color}25` }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>{item.icon}</div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.sub}</p>
                  </div>
                </div>
                <button onClick={item.action} className="btn-secondary text-xs py-2 px-4 shrink-0" style={{ borderColor: `${item.color}30`, color: item.color }}>{item.btn}</button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
