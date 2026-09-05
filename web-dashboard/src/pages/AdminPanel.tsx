import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingState, { InlineSpinner, SkeletonBlock } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import AppHeader from "./AppHeader";
import BulkEmailModal from "../components/BulkEmailModal";
import { getAnalyticsConfig, saveAnalyticsConfig, initAnalytics } from "../utils/analytics";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";

type AdminTab = "overview" | "users" | "beta" | "activity" | "feedback" | "audit" | "emails" | "system" | "analytics";

interface AdminOverview {
  generatedAt: string;
  totals: {
    users: number;
    verifiedUsers: number;
    bannedUsers: number;
    tempEmailUsers: number;
    projects: number;
    projectScans: number;
    optimizedContexts: number;
    feedback: number;
    activityLogs: number;
    auditLogs: number;
    emailLogs: number;
    activeIdeConnections: number;
    newUsersThisMonth: number;
    scansThisMonth: number;
    contextsThisMonth: number;
  };
  usersByPlan: { plan: string; count: number }[];
  usersByRole: { role: string; count: number }[];
  feedbackByCategory: { category: string; count: number; averageRating: number }[];
  recentActivity: AdminActivity[];
  recentFeedback: AdminFeedback[];
}

interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: string;
  plan: string;
  isEmailVerified: boolean;
  isBanned: boolean;
  banReason?: string | null;
  bannedAt?: string | null;
  isTempEmail: boolean;
  trustScore: number;
  adminNotes?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  lastActivityAt?: string | null;
  registrationSource?: string | null;
  country?: string | null;
  subscriptionStatus?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  isBetaTester: boolean;
  betaGrantedAt?: string | null;
  betaExpiresAt?: string | null;
  scanResetDate?: string | null;
  scanLimitOverride?: number | null;
  contextLimitOverride?: number | null;
  aiRequestLimitOverride?: number | null;
  usage: {
    scans: number;
    scanLimit: number;
    contexts: number;
    contextLimit: number;
    aiRequests: number;
    aiRequestLimit: number;
  };
  counts: {
    projects: number;
    feedback: number;
    ideConnections: number;
    teamMemberships: number;
  };
}

interface AdminActivity {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  projectId?: string | null;
  projectName: string;
  details?: string | null;
  createdAt: string;
  source?: string;
  actorEmail?: string;
}

interface AdminFeedback {
  id: string;
  content: string;
  rating: number;
  category: string;
  status: string;
  priority: string;
  adminNote?: string | null;
  relatedFeature?: string | null;
  createdAt: string;
  userId?: string | null;
  userEmail: string;
}

interface AuditLogItem {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetUserId: string;
  targetEmail: string;
  details?: string | null;
  createdAt: string;
}

interface EmailLogItem {
  id: string;
  userId?: string | null;
  recipientEmail: string;
  emailType: string;
  subject: string;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
}

interface AdminBetaApplication {
  id: number;
  fullName: string;
  email: string;
  country?: string;
  linkedInOrGithubUrl?: string;
  primaryIde?: string;
  primaryStack?: string;
  projectType?: string;
  willTestRealProject: boolean;
  willProvideFeedback: boolean;
  motivation?: string;
  currentProblem?: string;
  status: string;
  adminNote?: string;
  hasActivationToken: boolean;
  tokenExpiresAt?: string;
  tokenUsedAt?: string;
  betaGrantedAt?: string;
  betaExpiresAt?: string;
  onboarded: boolean;
  feedbackReceived: boolean;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminBetaLinkedAccount {
  id: string;
  emailVerified: boolean;
  ideConnected: boolean;
  projectsCreated: number;
  firstScanCompleted: boolean;
  contextGenerated: boolean;
}

const tabs: { id: AdminTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "OV" },
  { id: "users", label: "Users", icon: "US" },
  { id: "beta", label: "Beta Apps", icon: "BT" },
  { id: "activity", label: "Logs", icon: "LG" },
  { id: "feedback", label: "Feedback", icon: "FB" },
  { id: "audit", label: "Audit", icon: "AU" },
  { id: "emails", label: "Emails", icon: "EM" },
  { id: "system", label: "System", icon: "SY" },
  { id: "analytics", label: "Analytics", icon: "AN" },
];

const planColor: Record<string, string> = {
  Free: "#8b91b3",
  Pro: "#4f7cff",
  Team: "#8b5cf6",
};

function formatDate(value?: string | null) {
  if (!value) return "never";
  return new Date(value).toLocaleString();
}

function number(value: number | undefined) {
  return (value ?? 0).toLocaleString();
}

function usagePct(used: number, limit: number) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function MetricCard({ label, value, hint, color = "#4f7cff" }: { label: string; value: string | number; hint?: string; color?: string }) {
  return (
    <div className="card p-5" style={{ background: "rgba(13,15,26,0.68)", borderColor: `${color}24` }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8b91b3]">{label}</p>
          <p className="mt-2 text-3xl font-black" style={{ color }}>{value}</p>
        </div>
        <div className="h-9 w-9 rounded-xl border" style={{ background: `${color}12`, borderColor: `${color}24` }} />
      </div>
      {hint && <p className="mt-3 text-xs font-medium text-[#606783]">{hint}</p>}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-10 text-center" style={{ background: "rgba(13,15,26,0.52)" }}>
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-xs text-[#8b91b3]">{body}</p>
    </div>
  );
}

export default function AdminPanel() {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<AdminActivity[]>([]);
  const [feedback, setFeedback] = useState<AdminFeedback[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>([]);
  const [betaApps, setBetaApps] = useState<AdminBetaApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState("all");
  const [betaStatusFilter, setBetaStatusFilter] = useState("all");
  const [testEmail, setTestEmail] = useState(user?.email ?? "");
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBetaAppId, setSelectedBetaAppId] = useState<number | null>(null);
  const [selectedBetaAppDetail, setSelectedBetaAppDetail] = useState<{application: AdminBetaApplication, linkedAccount: AdminBetaLinkedAccount | null} | null>(null);
  const { showAlert } = useAlert();
  
  // Bulk Email State
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const toggleEmailSelection = (email: string) => {
    setSelectedEmails(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const [analyticsConfig, setAnalyticsConfig] = useState(() => getAnalyticsConfig());

  const handleSaveAnalytics = async () => {
    const response = await authFetch(`${API_BASE}/admin/analytics-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyticsConfig),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      showAlert(data.message || "Analytics settings could not be saved.", "error");
      return;
    }
    const saved = await response.json();
    setAnalyticsConfig(saved);
    saveAnalyticsConfig(saved);
    initAnalytics(saved);
    showAlert("Site-wide analytics settings saved.", "success");
  };

  const loadAdminData = async (isRefresh = false) => {
    if (!user || user.role !== "Admin") return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (planFilter !== "all") params.set("plan", planFilter);

      const activityParams = new URLSearchParams();
      if (actionFilter !== "all") activityParams.set("action", actionFilter);
      if (search.trim()) activityParams.set("search", search.trim());

      const feedbackParams = new URLSearchParams();
      if (feedbackFilter !== "all") feedbackParams.set("category", feedbackFilter);
      if (feedbackStatusFilter !== "all") feedbackParams.set("status", feedbackStatusFilter);

      const betaParams = new URLSearchParams();
      if (betaStatusFilter !== "all") betaParams.set("status", betaStatusFilter);
      if (search.trim()) betaParams.set("search", search.trim());

      const [overviewRes, usersRes, activityRes, feedbackRes, auditRes, emailRes, analyticsRes, betaRes] = await Promise.all([
        authFetch(`${API_BASE}/admin/overview`),
        authFetch(`${API_BASE}/admin/users?${params.toString()}`),
        authFetch(`${API_BASE}/admin/timeline?${activityParams.toString()}`),
        authFetch(`${API_BASE}/admin/feedback?${feedbackParams.toString()}`),
        authFetch(`${API_BASE}/admin/audit-logs`),
        authFetch(`${API_BASE}/admin/email-logs`),
        authFetch(`${API_BASE}/admin/analytics-config`),
        authFetch(`${API_BASE}/admin/beta-applications?${betaParams.toString()}`),
      ]);

      if ([overviewRes, usersRes, activityRes, feedbackRes].some((r) => r.status === 403)) {
        setError("Admin role required for this console.");
        return;
      }

      if (!overviewRes.ok || !usersRes.ok || !activityRes.ok || !feedbackRes.ok) {
        setError("Admin data could not be loaded. Check backend logs and access role.");
        return;
      }

      const overviewData = await overviewRes.json();
      const usersData = await usersRes.json();
      const activityData = await activityRes.json();
      const feedbackData = await feedbackRes.json();
      const auditData = auditRes.ok ? await auditRes.json() : { auditLogs: [] };
      const emailData = emailRes.ok ? await emailRes.json() : { emailLogs: [] };
      const betaData = betaRes.ok ? await betaRes.json() : { applications: [] };
      if (!betaRes.ok) {
        const betaError = await betaRes.json().catch(() => ({}));
        setError(betaError.message || betaError.error || "Beta applications could not be loaded. Check backend logs or database migrations.");
        showAlert(betaError.message || betaError.error || "Beta applications could not be loaded.", "error");
      }
      setOverview(overviewData);
      setUsers(usersData.users ?? []);
      setActivity(activityData.timeline ?? activityData.activity ?? []);
      setFeedback(feedbackData.feedback ?? feedbackData.feedbacks ?? []);
      if (analyticsRes.ok) setAnalyticsConfig(await analyticsRes.json());
      setAuditLogs(auditData.auditLogs ?? []);
      setEmailLogs(emailData.emailLogs ?? []);
      setBetaApps(betaData.applications ?? []);
    } catch {
      setError("Network error while loading admin console.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.role !== "Admin") {
      navigate("/dashboard");
      return;
    }
    loadAdminData();
  }, [user]);

  const latestGeneratedAt = overview?.generatedAt ? formatDate(overview.generatedAt) : "not loaded";

  // ---- Admin Actions ----
  const adminAction = async (url: string, method: string, body?: any, successMsg?: string) => {
    setActionLoading(url);
    try {
      const opts: any = { method, headers: { "Content-Type": "application/json" } };
      if (body) opts.body = JSON.stringify(body);
      const res = await authFetch(`${API_BASE}${url}`, opts);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showAlert(successMsg || data.message || "Action completed.", "success");
        loadAdminData(true);
      } else {
        showAlert(data.error || "Action failed.", "error");
        if (data.statusSaved) loadAdminData(true);
      }
    } catch {
      showAlert("Network error.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    setTestStatus(null);
    try {
      const r = await authFetch(`${API_BASE}/admin/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: testEmail.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      setTestStatus(r.ok ? data.message || "Test email sent." : data.error || "Email test failed.");
    } catch {
      setTestStatus("Network error while sending test email.");
    } finally {
      setSendingTest(false);
    }
  };

  if (!user || user.role !== "Admin") {
    return null;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
        <AppHeader title="Admin Console" />
        <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <LoadingState title="Loading admin console" description="Reading users, logs, feedback, and system signals." rows={5} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <AppHeader title="Admin Console" />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-lg border border-[#8b5cf6]/25 bg-[#8b5cf6]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#c4b5fd]">
              Admin Role Active
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Operations Console</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#8b91b3]">
              Monitor users, product activity, feedback, billing state, and email delivery without leaving the dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[#8b91b3]">
              Updated {latestGeneratedAt}
            </span>
            <button onClick={() => loadAdminData(true)} disabled={refreshing} className="btn-secondary px-4 py-2 text-xs disabled:opacity-50">
              {refreshing ? <InlineSpinner label="Refreshing" /> : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        )}

        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black transition ${
                tab === item.id ? "bg-white/[0.08] text-white" : "text-[#8b91b3] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span className="text-[10px] text-[#7ba3ff]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* ===== OVERVIEW ===== */}
        {tab === "overview" && (
          <div className="space-y-6">
            {overview ? (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <MetricCard label="Users" value={number(overview.totals.users)} hint={`${number(overview.totals.newUsersThisMonth)} new this month`} />
                  <MetricCard label="Projects" value={number(overview.totals.projects)} hint={`${number(overview.totals.projectScans)} scans stored`} color="#10b981" />
                  <MetricCard label="Contexts" value={number(overview.totals.optimizedContexts)} hint={`${number(overview.totals.contextsThisMonth)} generated this month`} color="#06b6d4" />
                  <MetricCard label="Feedback" value={number(overview.totals.feedback)} hint={`${number(overview.totals.activityLogs)} activity log rows`} color="#8b5cf6" />
                </div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <MetricCard label="Banned" value={number(overview.totals.bannedUsers)} color="#ef4444" />
                  <MetricCard label="Temp Emails" value={number(overview.totals.tempEmailUsers)} color="#f59e0b" />
                  <MetricCard label="Audit Logs" value={number(overview.totals.auditLogs)} color="#06b6d4" />
                  <MetricCard label="Email Logs" value={number(overview.totals.emailLogs)} color="#10b981" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="card lg:col-span-1" style={{ background: "rgba(13,15,26,0.62)" }}>
                    <h2 className="text-sm font-black text-white">Plan Mix</h2>
                    <div className="mt-4 space-y-3">
                      {overview.usersByPlan.map((p) => (
                        <div key={p.plan}>
                          <div className="mb-1.5 flex justify-between text-xs font-bold">
                            <span style={{ color: planColor[p.plan] ?? "#8b91b3" }}>{p.plan}</span>
                            <span className="text-[#8b91b3]">{p.count}</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${usagePct(p.count, overview.totals.users)}%`, background: planColor[p.plan] ?? "#4f7cff" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card lg:col-span-2" style={{ background: "rgba(13,15,26,0.62)" }}>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-black text-white">Recent Activity</h2>
                      <button onClick={() => setTab("activity")} className="text-xs font-bold text-[#7ba3ff]">Open logs</button>
                    </div>
                    <ActivityList activity={overview.recentActivity} />
                  </div>
                </div>
              </>
            ) : (
              <LoadingState compact title="Loading overview" description="Waiting for backend response." />
            )}
          </div>
        )}

        {/* ===== USERS ===== */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between" style={{ background: "rgba(13,15,26,0.62)" }}>
              <input className="input md:max-w-sm" placeholder="Search email, username, or user id" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex gap-2">
                <select className="input w-36" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                  <option value="all">All plans</option>
                  <option value="Free">Free</option>
                  <option value="Pro">Pro</option>
                  <option value="Team">Team</option>
                </select>
                <button onClick={() => loadAdminData(true)} className="btn-primary px-4 py-2 text-xs">Apply</button>
              </div>
            </div>

            {/* User Detail Panel */}
            {selectedUser && (
              <UserDetailPanel
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onAction={adminAction}
                actionLoading={actionLoading}
                authFetch={authFetch}
              />
            )}

            {users.length ? (
              <UserTable 
                users={users} 
                onSelect={setSelectedUser} 
                onAction={adminAction} 
                actionLoading={actionLoading} 
                selectedEmails={selectedEmails}
                onToggleSelection={toggleEmailSelection}
              />
            ) : (
              <EmptyState title="No users found" body="Try clearing filters or refreshing the admin console." />
            )}
          </div>
        )}

        {/* ===== BETA APPS ===== */}
        {tab === "beta" && (
          <div className="space-y-4">
            <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between" style={{ background: "rgba(13,15,26,0.62)" }}>
              <input className="input md:max-w-sm" placeholder="Search email or name" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex gap-2">
                <select className="input w-36" value={betaStatusFilter} onChange={(e) => setBetaStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Waitlisted">Waitlisted</option>
                </select>
                <button onClick={() => loadAdminData(true)} className="btn-primary px-4 py-2 text-xs">Apply</button>
              </div>
            </div>

            {/* Beta App Detail Panel */}
            {selectedBetaAppId && selectedBetaAppDetail && (
              <BetaAppDetailPanel
                detail={selectedBetaAppDetail}
                onClose={() => {
                  setSelectedBetaAppId(null);
                  setSelectedBetaAppDetail(null);
                }}
                onAction={adminAction}
                actionLoading={actionLoading}
              />
            )}

            {betaApps.length ? (
              <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left">
                    <thead className="bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-[#606783]">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <input 
                            type="checkbox" 
                            className="cursor-pointer"
                            checked={betaApps.length > 0 && betaApps.every(a => selectedEmails.includes(a.email))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newEmails = [...selectedEmails];
                                betaApps.forEach(a => { if (!newEmails.includes(a.email)) newEmails.push(a.email); });
                                setSelectedEmails(newEmails);
                              } else {
                                setSelectedEmails(selectedEmails.filter(email => !betaApps.find(a => a.email === email)));
                              }
                            }}
                          />
                        </th>
                        <th className="px-4 py-3">Applicant</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">IDE / Stack</th>
                        <th className="px-4 py-3">Progress</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05] bg-[#0d0f1a]/70">
                      {betaApps.map((app) => {
                        const isSelected = selectedEmails.includes(app.email);
                        return (
                        <tr 
                          key={app.id} 
                          className={`align-top hover:bg-white/[0.02] cursor-pointer ${isSelected ? 'bg-[#4f7cff]/10' : ''}`}
                          onClick={async () => {
                            setSelectedBetaAppId(app.id);
                            // Fetch details
                            const res = await authFetch(`${API_BASE}/admin/beta-applications/${app.id}`);
                            if (res.ok) {
                              setSelectedBetaAppDetail(await res.json());
                            }
                          }}
                        >
                          <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); toggleEmailSelection(app.email); }}>
                            <input type="checkbox" checked={isSelected} onChange={() => {}} className="cursor-pointer" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-bold text-white">{app.fullName}</div>
                            <div className="text-[10px] text-[#8b91b3]">{app.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge text-[10px] ${
                              app.status === 'Approved' ? 'badge-green' :
                              app.status === 'Rejected' ? 'badge-red' :
                              app.status === 'Waitlisted' ? 'badge-blue' :
                              'bg-white/10 text-white/70'
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-[#c3cadb]">{app.primaryIde || '-'}</div>
                            <div className="text-[10px] text-[#606783]">{app.primaryStack || '-'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <div className={`w-2 h-2 rounded-full ${app.hasActivationToken ? 'bg-emerald-500' : 'bg-white/10'}`} title="Secure activation link issued" />
                              <div className={`w-2 h-2 rounded-full ${app.onboarded ? 'bg-emerald-500' : 'bg-white/10'}`} title="Onboarded" />
                              <div className={`w-2 h-2 rounded-full ${app.feedbackReceived ? 'bg-emerald-500' : 'bg-white/10'}`} title="Feedback Received" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#8b91b3]">{formatDate(app.createdAt)}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState title="No beta applications found" body="Try clearing filters or refreshing." />
            )}
          </div>
        )}

        {/* ===== ACTIVITY LOGS ===== */}
        {tab === "activity" && (
          <div className="space-y-4">
            <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between" style={{ background: "rgba(13,15,26,0.62)" }}>
              <input className="input md:max-w-sm" placeholder="Search email, project, details" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex gap-2">
                <select className="input w-48" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                  <option value="all">All actions</option>
                  <option value="scan">Scan</option>
                  <option value="generate_context">Generate context</option>
                  <option value="export_ide">Export IDE</option>
                  <option value="update_memory">Update memory</option>
                </select>
                <button onClick={() => loadAdminData(true)} className="btn-primary px-4 py-2 text-xs">Apply</button>
              </div>
            </div>
            <ActivityList activity={activity} full />
          </div>
        )}

        {/* ===== FEEDBACK ===== */}
        {tab === "feedback" && (
          <div className="space-y-4">
            <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between" style={{ background: "rgba(13,15,26,0.62)" }}>
              <div>
                <p className="text-sm font-black text-white">User Feedback</p>
                <p className="mt-1 text-xs text-[#8b91b3]">Bug reports, launch comments, and product suggestions from users.</p>
              </div>
              <div className="flex gap-2">
                <select className="input w-36" value={feedbackFilter} onChange={(e) => setFeedbackFilter(e.target.value)}>
                  <option value="all">All categories</option>
                  <option value="general">General</option>
                  <option value="bug">Bug</option>
                  <option value="feature">Feature</option>
                  <option value="usability">Usability</option>
                  <option value="speed">Speed</option>
                </select>
                <select className="input w-36" value={feedbackStatusFilter} onChange={(e) => setFeedbackStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                  <option value="wontfix">Won't Fix</option>
                </select>
                <button onClick={() => loadAdminData(true)} className="btn-primary px-4 py-2 text-xs">Apply</button>
              </div>
            </div>
            {feedback.length ? (
              <FeedbackList feedback={feedback} onAction={adminAction} actionLoading={actionLoading} />
            ) : (
              <EmptyState title="No feedback yet" body="Feedback submissions will appear here immediately after users send them." />
            )}
          </div>
        )}

        {/* ===== AUDIT LOGS ===== */}
        {tab === "audit" && (
          <div className="space-y-4">
            <div className="card p-4" style={{ background: "rgba(13,15,26,0.62)" }}>
              <p className="text-sm font-black text-white">Admin Audit Trail</p>
              <p className="mt-1 text-xs text-[#8b91b3]">Every admin action is logged here for security and accountability.</p>
            </div>
            {auditLogs.length ? (
              <div className="space-y-2">
                {auditLogs.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg border border-[#f59e0b]/25 bg-[#f59e0b]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#fbbf24]">
                            {item.action}
                          </span>
                          <span className="text-xs font-bold text-white">{item.adminEmail}</span>
                          <span className="text-xs text-[#606783]">→</span>
                          <span className="text-xs text-[#8b91b3]">{item.targetEmail}</span>
                        </div>
                        {item.details && <p className="mt-2 text-xs leading-5 text-[#8b91b3]">{item.details}</p>}
                      </div>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#606783]">{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No audit logs" body="Admin actions will be logged here automatically." />
            )}
          </div>
        )}

        {/* ===== EMAIL LOGS ===== */}
        {tab === "emails" && (
          <div className="space-y-4">
            <div className="card p-4" style={{ background: "rgba(13,15,26,0.62)" }}>
              <p className="text-sm font-black text-white">Email Delivery Logs</p>
              <p className="mt-1 text-xs text-[#8b91b3]">Track all transactional emails: verifications, resets, billing, security alerts.</p>
            </div>
            {emailLogs.length ? (
              <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left">
                    <thead className="bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-[#606783]">
                      <tr>
                        <th className="px-4 py-3">Recipient</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05] bg-[#0d0f1a]/70">
                      {emailLogs.map((item) => (
                        <tr key={item.id} className="align-top">
                          <td className="px-4 py-3 text-xs font-bold text-white">{item.recipientEmail}</td>
                          <td className="px-4 py-3">
                            <span className="badge-blue text-[10px]">{item.emailType}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#c3cadb] max-w-[240px] truncate">{item.subject}</td>
                          <td className="px-4 py-3">
                            <span className={item.status === "sent" ? "badge-green text-[10px]" : "badge-red text-[10px]"}>
                              {item.status}
                            </span>
                            {item.errorMessage && <p className="mt-1 text-[10px] text-red-400">{item.errorMessage}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#8b91b3]">{formatDate(item.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState title="No email logs" body="Email delivery logs will appear here after emails are sent." />
            )}
          </div>
        )}

        {/* ===== SYSTEM ===== */}
        {tab === "system" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card" style={{ background: "rgba(13,15,26,0.62)" }}>
              <h2 className="text-sm font-black text-white">Email Diagnostics</h2>
              <p className="mt-1 text-xs text-[#8b91b3]">Send a Resend-backed delivery test to confirm transactional email is live.</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input className="input" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="admin@example.com" />
                <button onClick={sendTestEmail} disabled={sendingTest} className="btn-primary shrink-0 px-4 py-2 text-xs disabled:opacity-50">
                  {sendingTest ? <InlineSpinner label="Sending" /> : "Send Test"}
                </button>
              </div>
              {testStatus && <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-xs font-semibold text-[#c3cadb]">{testStatus}</p>}
            </div>

            <div className="card" style={{ background: "rgba(13,15,26,0.62)" }}>
              <h2 className="text-sm font-black text-white">System Signals</h2>
              {overview ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Signal label="Verified users" value={`${overview.totals.verifiedUsers}/${overview.totals.users}`} />
                  <Signal label="Active IDE links" value={number(overview.totals.activeIdeConnections)} />
                  <Signal label="Scans this month" value={number(overview.totals.scansThisMonth)} />
                  <Signal label="Activity rows" value={number(overview.totals.activityLogs)} />
                  <Signal label="Banned users" value={number(overview.totals.bannedUsers)} />
                  <Signal label="Temp email users" value={number(overview.totals.tempEmailUsers)} />
                </div>
              ) : (
                <SkeletonBlock rows={4} />
              )}
            </div>
          </div>
        )}

        {/* ===== ANALYTICS ===== */}
        {tab === "analytics" && (
          <div className="card max-w-2xl" style={{ background: "rgba(13,15,26,0.62)" }}>
            <h2 className="text-sm font-black text-white">Analytics Settings</h2>
            <p className="mt-1 text-xs text-[#8b91b3]">
              Configure Google Analytics 4 and Microsoft Clarity for all visitors. Tracking starts only after visitor consent.
            </p>
            
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-white">Google Analytics Measurement ID</label>
                <input 
                  className="input font-mono text-sm w-full" 
                  value={analyticsConfig.gaId || ""} 
                  onChange={e => setAnalyticsConfig(prev => ({ ...prev, gaId: e.target.value }))} 
                  placeholder="e.g. G-XXXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-white">Microsoft Clarity Project ID</label>
                <input 
                  className="input font-mono text-sm w-full" 
                  value={analyticsConfig.clarityId || ""} 
                  onChange={e => setAnalyticsConfig(prev => ({ ...prev, clarityId: e.target.value }))} 
                  placeholder="e.g. XXXXXXXXXX"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-t border-b border-white/[0.06]">
                <div>
                  <p className="font-semibold text-sm text-white">Enable Tracking</p>
                  <p className="text-xs mt-0.5 text-[#8b91b3]">Enable or disable site-wide GA4 & Clarity scripts</p>
                </div>
                <button 
                  onClick={() => setAnalyticsConfig(prev => ({ ...prev, enabled: !prev.enabled }))} 
                  className="relative w-11 h-6 rounded-full transition-all duration-200"
                  style={{ 
                    background: analyticsConfig.enabled ? "linear-gradient(135deg,#4f7cff,#6366f1)" : "rgba(255,255,255,0.06)", 
                    borderColor: "rgba(255,255,255,0.12)",
                    borderWidth: "1px"
                  }}
                >
                  <span 
                    className="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full bg-white shadow"
                    style={{ left: analyticsConfig.enabled ? "calc(100% - 22px)" : "2px" }}
                  />
                </button>
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleSaveAnalytics} 
                  className="btn-primary px-4 py-2 text-xs font-bold"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FLOATING ACTION BAR FOR BULK EMAILS */}
      {selectedEmails.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0d0f1a] border border-[#4f7cff50] shadow-2xl shadow-[#4f7cff20] px-6 py-4 rounded-full flex items-center gap-6 z-40">
          <span className="text-sm font-bold text-white">{selectedEmails.length} recipient(s) selected</span>
          <div className="flex gap-3">
            <button onClick={() => setSelectedEmails([])} className="text-xs font-bold text-[#8b91b3] hover:text-white">Clear</button>
            <button onClick={() => setIsBulkModalOpen(true)} className="btn-primary px-4 py-2 text-xs">Send Bulk Email</button>
          </div>
        </div>
      )}

      <BulkEmailModal 
        isOpen={isBulkModalOpen} 
        onClose={() => {
          setIsBulkModalOpen(false);
          setSelectedEmails([]);
          loadAdminData(true);
        }} 
        selectedEmails={selectedEmails} 
        authFetch={authFetch} 
      />
    </div>
  );
}

// ===== SUB-COMPONENTS =====

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#606783]">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function ActivityList({ activity, full = false }: { activity: AdminActivity[]; full?: boolean }) {
  if (!activity.length) {
    return <EmptyState title="No logs found" body="User and admin activity will appear here after logins, scans, exports, context builds, and account actions." />;
  }

  return (
    <div className="space-y-2">
      {activity.slice(0, full ? 100 : 8).map((item) => (
        <div key={item.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-[#4f7cff]/25 bg-[#4f7cff]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#7ba3ff]">
                  {item.action}
                </span>
                <span className="text-xs font-bold text-white">{item.userEmail}</span>
                {item.source === "audit" && <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">admin</span>}
                <span className="text-xs text-[#606783]">{item.projectName || "No project"}</span>
              </div>
              {item.source === "audit" && item.actorEmail && <p className="mt-1 text-[10px] text-[#606783]">Performed by {item.actorEmail}</p>}
              {item.details && <p className="mt-2 text-xs leading-5 text-[#8b91b3]">{item.details}</p>}
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#606783]">{formatDate(item.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function UserDetailPanel({ user: u, onClose, onAction, actionLoading, authFetch }: { user: AdminUser; onClose: () => void; onAction: Function; actionLoading: string | null; authFetch: (url: string, options?: RequestInit) => Promise<Response> }) {
  const [banReason, setBanReason] = useState("");
  const [newRole, setNewRole] = useState(u.role);
  const [newPlan, setNewPlan] = useState(u.plan);
  const [notes, setNotes] = useState(u.adminNotes || "");
  const [trustScore, setTrustScore] = useState(u.trustScore);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    let active = true;
    authFetch(`${API_BASE}/admin/users/${u.id}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (active) setDetail(data); })
      .catch(() => { if (active) setDetail(null); });
    return () => { active = false; };
  }, [u.id, authFetch]);

  return (
    <div className="card p-6" style={{ background: "rgba(13,15,26,0.85)", borderColor: "#4f7cff30" }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-white">{u.email}</h3>
            {u.isBetaTester && <span className="badge-blue ml-2">Beta Tester</span>}
          </div>
          <p className="text-xs text-[#606783] mt-1">ID: {u.id} · Username: {u.username}</p>
        </div>
        <button onClick={onClose} className="text-[#8b91b3] hover:text-white text-lg font-bold px-2">✕</button>
      </div>

      {detail && (
        <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex flex-wrap gap-4 text-xs text-[#8b91b3]">
            <span>Projects: <b className="text-white">{detail.counts?.projects ?? 0}</b></span>
            <span>Activity logs: <b className="text-white">{detail.counts?.activityLogs ?? 0}</b></span>
            <span>Admin actions: <b className="text-white">{detail.counts?.auditLogs ?? 0}</b></span>
            <span>Feedback: <b className="text-white">{detail.counts?.feedback ?? 0}</b></span>
          </div>
          <div className="mt-3 space-y-1.5">
            {[...(detail.recentActivity ?? []).map((x: any) => ({ ...x, source: "activity" })), ...(detail.auditHistory ?? []).map((x: any) => ({ ...x, source: "audit", action: x.action, createdAt: x.createdAt }))]
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 20)
              .map((x: any) => <div key={`${x.source}-${x.id}`} className="flex justify-between gap-3 text-[11px] text-[#8b91b3]"><span><b className="text-[#cbd5e1]">{x.action}</b>{x.details ? ` - ${x.details}` : ""}</span><span className="shrink-0">{formatDate(x.createdAt)}</span></div>)}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div><p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#606783]">Projects</p>{(detail.projects ?? []).map((x: any) => <p key={x.id} className="text-[11px] text-[#cbd5e1]">{x.name} <span className="text-[#606783]">({x.scans} scans, {x.contexts} contexts)</span></p>)}</div>
            <div><p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#606783]">Teams</p>{(detail.teams ?? []).map((x: any) => <p key={x.id} className="text-[11px] text-[#cbd5e1]">{x.name} <span className="text-[#606783]">({x.role})</span></p>)}</div>
            <div><p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#606783]">Feedback</p>{(detail.feedback ?? []).slice(0, 5).map((x: any) => <p key={x.id} className="truncate text-[11px] text-[#cbd5e1]">{x.category}: {x.content}</p>)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
        <MiniInfo label="Role" value={u.role} />
        <MiniInfo label="Plan" value={u.plan} />
        <MiniInfo label="Verified" value={u.isEmailVerified ? "Yes" : "No"} />
        <MiniInfo label="Banned" value={u.isBanned ? "Yes" : "No"} />
        <MiniInfo label="Trust" value={String(u.trustScore)} />
        <MiniInfo label="Temp Email" value={u.isTempEmail ? "Yes" : "No"} />
        <MiniInfo label="Created" value={formatDate(u.createdAt)} />
        <MiniInfo label="Last Login" value={formatDate(u.lastLoginAt)} />
        <MiniInfo label="Last Activity" value={formatDate(u.lastActivityAt)} />
        <MiniInfo label="Billing" value={u.subscriptionStatus || "none"} />
        <MiniInfo label="Projects" value={String(u.counts.projects)} />
        <MiniInfo label="IDE Links" value={String(u.counts.ideConnections)} />
        {u.isBetaTester && <MiniInfo label="Beta Expires" value={formatDate(u.betaExpiresAt)} />}
      </div>

      {/* Usage */}
      <div className="mb-4">
        <p className="text-xs font-black text-white mb-2">Usage</p>
        <div className="grid grid-cols-3 gap-3">
          <UsageLine label="Scans" used={u.usage.scans} max={u.usage.scanLimit} />
          <UsageLine label="Contexts" used={u.usage.contexts} max={u.usage.contextLimit} />
          <UsageLine label="AI" used={u.usage.aiRequests} max={u.usage.aiRequestLimit} />
        </div>
      </div>

      {/* Admin Actions */}
      <div className="border-t border-white/[0.06] pt-4 space-y-4">
        <p className="text-xs font-black text-white">Admin Actions</p>

        {/* Role */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#606783] block mb-1">Role</label>
            <select className="input w-32 text-xs" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <button onClick={() => onAction(`/admin/users/${u.id}/role`, "POST", { role: newRole })} disabled={!!actionLoading} className="btn-primary px-3 py-2 text-[10px]">
            Update Role
          </button>
        </div>

        {/* Plan */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#606783] block mb-1">Plan</label>
            <select className="input w-32 text-xs" value={newPlan} onChange={(e) => setNewPlan(e.target.value)}>
              <option value="Free">Free</option>
              <option value="Pro">Pro</option>
              <option value="Team">Team</option>
            </select>
          </div>
          <button onClick={() => onAction(`/admin/users/${u.id}/plan`, "POST", { plan: newPlan })} disabled={!!actionLoading} className="btn-primary px-3 py-2 text-[10px]">
            Update Plan
          </button>
        </div>

        {/* Ban / Unban */}
        {u.isBanned ? (
          <button onClick={() => onAction(`/admin/users/${u.id}/unban`, "POST")} disabled={!!actionLoading} className="btn-secondary px-3 py-2 text-[10px] border-green-500/30 text-green-400">
            Unban User
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-[#606783] block mb-1">Ban Reason</label>
              <input className="input w-full text-xs" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason for ban" />
            </div>
            <button onClick={() => onAction(`/admin/users/${u.id}/ban`, "POST", { reason: banReason })} disabled={!!actionLoading} className="btn-primary px-3 py-2 text-[10px]" style={{ background: "#ef4444" }}>
              Ban User
            </button>
          </div>
        )}

        {/* Trust Score */}
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#606783] block mb-1">Trust Score (0-100)</label>
            <input className="input w-24 text-xs" type="number" min={0} max={100} value={trustScore} onChange={(e) => setTrustScore(Number(e.target.value))} />
          </div>
          <button onClick={() => onAction(`/admin/users/${u.id}/trust-score`, "POST", { score: trustScore })} disabled={!!actionLoading} className="btn-primary px-3 py-2 text-[10px]">
            Update Trust
          </button>
        </div>

        {/* Admin Notes */}
        <div>
          <label className="text-[10px] uppercase tracking-wider font-bold text-[#606783] block mb-1">Admin Notes</label>
          <textarea className="input w-full text-xs min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this user" />
          <button onClick={() => onAction(`/admin/users/${u.id}/notes`, "POST", { notes })} disabled={!!actionLoading} className="btn-primary px-3 py-2 text-[10px] mt-2">
            Save Notes
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
          <button onClick={() => onAction(`/admin/users/${u.id}/reset-usage`, "POST")} disabled={!!actionLoading} className="btn-secondary px-3 py-2 text-[10px]">
            Reset Usage
          </button>
          <button onClick={() => onAction(`/admin/users/${u.id}/force-logout`, "POST")} disabled={!!actionLoading} className="btn-secondary px-3 py-2 text-[10px]">
            Force Logout
          </button>
          <button onClick={() => onAction(`/admin/users/${u.id}/revoke-api-key`, "POST")} disabled={!!actionLoading} className="btn-secondary px-3 py-2 text-[10px]">
            Revoke API Key
          </button>
          {!u.isEmailVerified && (
            <>
              <button onClick={() => onAction(`/admin/users/${u.id}/verify-email`, "POST")} disabled={!!actionLoading} className="btn-secondary px-3 py-2 text-[10px]">
                Verify Email
              </button>
              <button onClick={() => onAction(`/admin/users/${u.id}/resend-verification`, "POST")} disabled={!!actionLoading} className="btn-secondary px-3 py-2 text-[10px]">
                Resend Verification
              </button>
            </>
          )}
          <button onClick={() => { if (confirm(`Soft-delete user ${u.email}?`)) onAction(`/admin/users/${u.id}`, "DELETE"); }} disabled={!!actionLoading} className="btn-secondary px-3 py-2 text-[10px] border-red-500/30 text-red-400">
            Delete User
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-wider text-[#606783]">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-[#c3cadb] truncate">{value}</p>
    </div>
  );
}

function UserTable({ 
  users, 
  onSelect, 
  onAction, 
  actionLoading,
  selectedEmails,
  onToggleSelection
}: { 
  users: AdminUser[]; 
  onSelect: (u: AdminUser) => void; 
  onAction: Function; 
  actionLoading: string | null;
  selectedEmails?: string[];
  onToggleSelection?: (email: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left">
          <thead className="bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-[#606783]">
            <tr>
              {onToggleSelection && <th className="px-4 py-3 w-10"></th>}
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Counts</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] bg-[#0d0f1a]/70">
            {users.map((item) => {
              const isSelected = selectedEmails?.includes(item.email);
              return (
              <tr key={item.id} className={`align-top hover:bg-white/[0.02] cursor-pointer ${isSelected ? 'bg-[#4f7cff]/10' : ''}`} onClick={() => onSelect(item)}>
                {onToggleSelection && (
                  <td className="px-4 py-4" onClick={(e) => { e.stopPropagation(); onToggleSelection(item.email); }}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}} className="cursor-pointer" />
                  </td>
                )}
                <td className="px-4 py-4">
                  <p className="text-xs font-black text-white">{item.email}</p>
                  <p className="mt-0.5 text-[10px] text-[#606783]">{item.username}</p>
                  <p className="mt-0.5 text-[10px] text-[#606783]">{item.id.slice(0, 12)}...</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="badge-blue text-[10px]">{item.role}</span>
                    <span className={item.isEmailVerified ? "badge-green text-[10px]" : "badge-yellow text-[10px]"}>
                      {item.isEmailVerified ? "Verified" : "Unverified"}
                    </span>
                    {item.isBanned && <span className="badge-red text-[10px]">Banned</span>}
                    {item.isTempEmail && <span className="badge-yellow text-[10px]">TempEmail</span>}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-lg border px-2.5 py-1 text-xs font-black" style={{ borderColor: `${planColor[item.plan] ?? "#8b91b3"}40`, color: planColor[item.plan] ?? "#8b91b3", background: `${planColor[item.plan] ?? "#8b91b3"}14` }}>
                    {item.plan}
                  </span>
                  <p className="mt-1 text-[10px] text-[#606783]">Trust: {item.trustScore}</p>
                </td>
                <td className="px-4 py-4 text-xs text-[#c3cadb]">
                  <p className="font-bold">{item.subscriptionStatus || "none"}</p>
                  <p className="text-[10px] text-[#606783]">{item.currentPeriodEnd ? `until ${new Date(item.currentPeriodEnd).toLocaleDateString()}` : "no period"}</p>
                </td>
                <td className="px-4 py-4">
                  <UsageLine label="Scans" used={item.usage.scans} max={item.usage.scanLimit} />
                  <UsageLine label="Contexts" used={item.usage.contexts} max={item.usage.contextLimit} />
                  <UsageLine label="AI" used={item.usage.aiRequests} max={item.usage.aiRequestLimit} />
                </td>
                <td className="px-4 py-4 text-xs text-[#c3cadb]">
                  <p>{item.counts.projects} projects</p>
                  <p>{item.counts.ideConnections} IDE links</p>
                  <p>{item.counts.feedback} feedback</p>
                  <p>{item.counts.teamMemberships} teams</p>
                </td>
                <td className="px-4 py-4 text-xs text-[#8b91b3]">
                  <p className="font-bold text-[#c3cadb]">{item.subscriptionStatus || "none"}</p>
                  <p>{item.currentPeriodEnd ? `until ${new Date(item.currentPeriodEnd).toLocaleDateString()}` : "no period"}</p>
                </td>
                <td className="px-4 py-4 text-xs text-[#8b91b3]">
                  <p>{formatDate(item.createdAt)}</p>
                  <p className="mt-1">Login: {formatDate(item.lastLoginAt)}</p>
                  <p>Active: {formatDate(item.lastActivityAt)}</p>
                </td>
                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => onSelect(item)} className="text-[10px] font-bold text-[#7ba3ff] hover:underline text-left">
                      Details
                    </button>
                    {!item.isBanned ? (
                      <button onClick={() => onAction(`/admin/users/${item.id}/ban`, "POST", { reason: "Admin action" })} disabled={!!actionLoading} className="text-[10px] font-bold text-red-400 hover:underline text-left">
                        Ban
                      </button>
                    ) : (
                      <button onClick={() => onAction(`/admin/users/${item.id}/unban`, "POST")} disabled={!!actionLoading} className="text-[10px] font-bold text-green-400 hover:underline text-left">
                        Unban
                      </button>
                    )}
                    <button onClick={() => onAction(`/admin/users/${item.id}/force-logout`, "POST")} disabled={!!actionLoading} className="text-[10px] font-bold text-[#f59e0b] hover:underline text-left">
                      Logout
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsageLine({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = usagePct(used, max);
  return (
    <div className="mb-2 min-w-40">
      <div className="mb-1 flex justify-between text-[10px] font-bold text-[#8b91b3]">
        <span>{label}</span>
        <span>{used}/{max}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: pct > 85 ? "#ef4444" : undefined }} />
      </div>
    </div>
  );
}

function FeedbackList({ feedback, onAction, actionLoading }: { feedback: AdminFeedback[]; onAction: Function; actionLoading: string | null }) {
  return (
    <div className="space-y-3">
      {feedback.map((item) => (
        <FeedbackCard key={item.id} item={item} onAction={onAction} actionLoading={actionLoading} />
      ))}
    </div>
  );
}

function FeedbackCard({ item, onAction, actionLoading }: { item: AdminFeedback; onAction: Function; actionLoading: string | null }) {
  const [status, setStatus] = useState(item.status);
  const [priority, setPriority] = useState(item.priority);
  const [note, setNote] = useState(item.adminNote || "");
  const [showActions, setShowActions] = useState(false);

  const statusColors: Record<string, string> = {
    new: "#4f7cff",
    reviewed: "#f59e0b",
    resolved: "#10b981",
    wontfix: "#8b91b3",
  };

  const priorityColors: Record<string, string> = {
    low: "#8b91b3",
    normal: "#4f7cff",
    high: "#f59e0b",
    critical: "#ef4444",
  };

  return (
    <div className="card p-5" style={{ background: "rgba(13,15,26,0.62)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="badge-purple text-[10px]">{item.category}</span>
            <span className="rounded-lg border px-2 py-0.5 text-[10px] font-black" style={{ borderColor: `${statusColors[item.status]}40`, color: statusColors[item.status], background: `${statusColors[item.status]}14` }}>
              {item.status}
            </span>
            <span className="rounded-lg border px-2 py-0.5 text-[10px] font-black" style={{ borderColor: `${priorityColors[item.priority]}40`, color: priorityColors[item.priority], background: `${priorityColors[item.priority]}14` }}>
              {item.priority}
            </span>
            <span className="text-xs font-bold text-white">{item.rating}/5</span>
            <span className="text-xs text-[#8b91b3]">{item.userEmail}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#d7dbef]">{item.content}</p>
          {item.adminNote && <p className="mt-2 text-xs text-[#f59e0b] italic">Admin: {item.adminNote}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#606783]">{formatDate(item.createdAt)}</span>
          <button onClick={() => setShowActions(!showActions)} className="text-[10px] font-bold text-[#7ba3ff]">
            {showActions ? "Hide" : "Manage"}
          </button>
        </div>
      </div>
      {showActions && (
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[9px] uppercase tracking-wider font-bold text-[#606783] block mb-1">Status</label>
            <select className="input w-28 text-[10px]" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
              <option value="wontfix">Won't Fix</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider font-bold text-[#606783] block mb-1">Priority</label>
            <select className="input w-28 text-[10px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-[9px] uppercase tracking-wider font-bold text-[#606783] block mb-1">Admin Note</label>
            <input className="input w-full text-[10px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add internal note" />
          </div>
          <button
            onClick={() => onAction(`/admin/feedback/${item.id}/status`, "POST", { status, priority, adminNote: note })}
            disabled={!!actionLoading}
            className="btn-primary px-3 py-2 text-[10px]"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
function BetaAppDetailPanel({ detail, onClose, onAction, actionLoading }: { 
  detail: {application: AdminBetaApplication, linkedAccount: AdminBetaLinkedAccount | null}; 
  onClose: () => void; 
  onAction: Function; 
  actionLoading: string | null 
}) {
  const { application: app, linkedAccount } = detail;
  const [status, setStatus] = useState(app.status);
  const [note, setNote] = useState(app.adminNote || "");
  const [sendEmail, setSendEmail] = useState(false);
  const [onboarded, setOnboarded] = useState(app.onboarded);
  const [feedbackReceived, setFeedbackReceived] = useState(app.feedbackReceived);

  return (
    <div className="card p-6 border-[#4f7cff30] mb-4" style={{ background: "rgba(13,15,26,0.85)" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-white">{app.fullName}</h3>
            <span className={`badge ${
              app.status === 'Approved' ? 'badge-green' :
              app.status === 'Rejected' ? 'badge-red' :
              app.status === 'Waitlisted' ? 'badge-blue' :
              'bg-white/10 text-white/70'
            }`}>{app.status}</span>
          </div>
          <p className="text-sm text-[#8b91b3] mt-1">{app.email} · {app.country || "Unknown Location"} · Applied: {formatDate(app.createdAt)}</p>
        </div>
        <button onClick={onClose} className="text-[#8b91b3] hover:text-white text-lg font-bold px-2">✕</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#606783] mb-3">Technical Profile</h4>
          <div className="space-y-2">
            <p className="text-sm"><span className="text-[#8b91b3]">IDE:</span> <span className="text-white font-bold">{app.primaryIde || '-'}</span></p>
            <p className="text-sm"><span className="text-[#8b91b3]">Stack:</span> <span className="text-white font-bold">{app.primaryStack || '-'}</span></p>
            <p className="text-sm"><span className="text-[#8b91b3]">Project Type:</span> <span className="text-white font-bold">{app.projectType || '-'}</span></p>
            {app.linkedInOrGithubUrl && (
              <p className="text-sm">
                <span className="text-[#8b91b3]">Link:</span> <a href={app.linkedInOrGithubUrl} target="_blank" rel="noreferrer" className="text-[#4f7cff] hover:underline font-bold">{app.linkedInOrGithubUrl}</a>
              </p>
            )}
          </div>

          <h4 className="text-xs font-bold uppercase tracking-wider text-[#606783] mt-6 mb-3">Commitments</h4>
          <div className="space-y-2">
            <p className="text-sm"><span className="text-[#8b91b3]">Will test real project:</span> <span className="text-white font-bold">{app.willTestRealProject ? "Yes" : "No"}</span></p>
            <p className="text-sm"><span className="text-[#8b91b3]">Will provide feedback:</span> <span className="text-white font-bold">{app.willProvideFeedback ? "Yes" : "No"}</span></p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#606783] mb-3">Responses</h4>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-[#8b91b3] mb-1">Motivation:</p>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-sm text-[#cbd5e1] whitespace-pre-wrap">
                {app.motivation || '-'}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#8b91b3] mb-1">Current Problem:</p>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-sm text-[#cbd5e1] whitespace-pre-wrap">
                {app.currentProblem || '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 border-t border-white/[0.06]">
        {/* Linked Account info */}
        <div className="lg:col-span-1 border-r border-white/[0.06] pr-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#606783] mb-3">Linked Account</h4>
          {linkedAccount ? (
            <div className="space-y-2">
              <p className="text-sm flex items-center justify-between">
                <span className="text-[#8b91b3]">Registered:</span> 
                {linkedAccount.emailVerified ? <span className="badge-green text-[10px]">Verified</span> : <span className="badge-red text-[10px]">Unverified</span>}
              </p>
              <p className="text-sm flex items-center justify-between">
                <span className="text-[#8b91b3]">IDE Connected:</span> 
                <span className="text-white font-bold">{linkedAccount.ideConnected ? "Yes" : "No"}</span>
              </p>
              <p className="text-sm flex items-center justify-between">
                <span className="text-[#8b91b3]">Projects:</span> 
                <span className="text-white font-bold">{linkedAccount.projectsCreated}</span>
              </p>
              <p className="text-sm flex items-center justify-between">
                <span className="text-[#8b91b3]">First Scan:</span> 
                <span className="text-white font-bold">{linkedAccount.firstScanCompleted ? "Yes" : "No"}</span>
              </p>
              <p className="text-sm flex items-center justify-between">
                <span className="text-[#8b91b3]">Context Gen:</span> 
                <span className="text-white font-bold">{linkedAccount.contextGenerated ? "Yes" : "No"}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#8b91b3] italic">No user account found with this email.</p>
          )}

          <div className="mt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#606783] mb-3">Manual Flags</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={onboarded} onChange={e => setOnboarded(e.target.checked)} />
                <span className="text-sm text-white">Onboarded</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={feedbackReceived} onChange={e => setFeedbackReceived(e.target.checked)} />
                <span className="text-sm text-white">Feedback Received</span>
              </label>
              <button 
                className="mt-2 btn-secondary px-3 py-1.5 text-[10px]"
                onClick={() => onAction(`/admin/beta-applications/${app.id}/flags`, "PUT", { onboarded, feedbackReceived })}
              >
                Save Flags
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8b91b3] mb-1">Change Status</label>
              <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Waitlisted">Waitlisted</option>
              </select>
            </div>
            {status === "Approved" && app.hasActivationToken && (
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8b91b3] mb-1">Activation Status</label>
                <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-xs text-[#cbd5e1]">
                  Secure claim link active until {formatDate(app.tokenExpiresAt)}. The raw token is available only in the recipient's email.
                </div>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8b91b3] mb-1">Admin Note (Internal)</label>
            <input className="input w-full" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..." />
          </div>

          <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between mt-4">
            <div>
              <p className="text-sm font-bold text-white">
                {status === "Approved" ? "Activation Email Required" : "Send Notification Email?"}
              </p>
              <p className="text-xs text-[#8b91b3]">
                {status === "Approved"
                  ? "Approval always rotates the secure one-time link and sends it automatically."
                  : "Enable this to notify the applicant of the status change."}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={status === "Approved" || sendEmail}
                disabled={status === "Approved"}
                onChange={e => setSendEmail(e.target.checked)}
                className="w-5 h-5"
              />
            </label>
          </div>

          <div className="pt-2 flex justify-between items-center">
            <button 
              className="text-[10px] uppercase font-bold tracking-wider text-red-500/70 hover:text-red-400 transition-colors"
              disabled={!!actionLoading}
              onClick={() => {
                if (confirm(`Are you sure you want to completely delete the application for ${app.email}? This cannot be undone.`)) {
                  onAction(`/admin/beta-applications/${app.id}`, "DELETE");
                }
              }}
            >
              Delete Application
            </button>
            <button 
              className="btn-primary px-6 py-2"
              disabled={!!actionLoading}
              onClick={() => onAction(`/admin/beta-applications/${app.id}/status`, "PUT", { status, adminNote: note, sendEmail: status === "Approved" || sendEmail })}
            >
              {actionLoading ? "Saving..." : "Update Status"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
