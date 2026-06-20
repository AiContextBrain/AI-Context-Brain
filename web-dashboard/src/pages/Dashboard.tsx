import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import AppHeader from "./AppHeader";
import LoadingState from "../components/LoadingState";
import ProjectSetupWizard from "../components/ProjectSetupWizard";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";

interface Project {
  id: string;
  name: string;
  path: string;
  framework: string;
  architectureType: string;
  databaseType?: string;
  authSystem?: string;
  lastScanned: string;
  createdAt?: string;
  isShared?: boolean;
  teamId?: string;
  teamName?: string;
  role?: string;
}

interface PlanInfo {
  name: string;
  projectsUsed: number;
  projectsLimit: number;
  scansUsed: number;
  scansLimit: number;
  scansResetDate?: string;
  aiRequestsUsed?: number;
  aiRequestsLimit?: number;
  maxContextSizeTokens?: number;
  contextGenerationsUsed?: number;
  contextGenerationsLimit?: number;
  lastGeneratedContextSize?: number;
  contextCapacityPercent?: number;
}

interface Activity {
  id: string;
  action: string;
  projectName: string;
  details?: string;
  createdAt: string;
}

interface ConnectedIde {
  id: string;
  editor: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

interface ScanRecord {
  id: string;
  projectName: string;
  scanDate: string;
  framework: string;
  architectureType: string;
  filesCount: number;
  linesOfCode: number;
}

interface FileMetric {
  path: string;
  sizeBytes: number;
  lines: number;
  lastModified?: string;
}

interface DetectedTech {
  name: string;
  confidence: number;
}

interface TechStackDetails {
  frontend?: DetectedTech;
  backend?: DetectedTech;
  database?: DetectedTech;
  auth?: DetectedTech;
  orm?: DetectedTech;
  packageManager?: DetectedTech;
  deployment?: DetectedTech;
  monorepo?: DetectedTech;
  aiProviders?: DetectedTech[];
}

interface ImportantFileDetails {
  path: string;
  category: string;
  importance: string;
  aiBehavior: string;
}

interface ModuleDetails {
  name: string;
  purpose: string;
  keyFiles: string[];
  dependencies: string[];
  status: string;
}

interface ArchitectureSummaryDetails {
  style: string;
  dataFlowDescription: string;
  businessLogicLocation: string;
  uiLogicLocation: string;
  apiLogicLocation: string;
  configLocation: string;
}

interface ProjectMetrics {
  filesCount?: number;
  linesOfCode?: number;
  foldersCount?: number;
  fileExtensions?: Record<string, number>;
  totalSizeBytes?: number;
  dependencies?: string[];
  largestFiles?: FileMetric[];
  recentlyModifiedFiles?: FileMetric[];
  ignoredPaths?: string[];
  techStack?: TechStackDetails;
  importantFiles?: ImportantFileDetails[];
  moduleMap?: ModuleDetails[];
  architectureSummary?: ArchitectureSummaryDetails;
}

interface ProjectMemory {
  name?: string;
  framework?: string;
  architectureType?: string;
  databaseType?: string;
  authSystem?: string;
  metrics?: ProjectMetrics;
  folderStructure?: string[];
  architectureRules?: {
    id?: string;
    name: string;
    pattern: string;
    description?: string;
    folderPath?: string;
    isActive?: boolean;
    ruleType?: string;
    severity?: string;
    language?: string;
    autoFixSuggestion?: string;
  }[];
  codingConventions?: {
    id?: string;
    name: string;
    pattern?: string;
    rule: string;
    example?: string;
    language?: string;
    isActive?: boolean;
  }[];
  systemDecisions?: {
    id?: string;
    name?: string;
    title: string;
    decision: string;
    reasoning?: string;
    category?: string;
  }[];
}

interface ContextHistoryItem {
  id: string;
  createdAt: string;
  characterCount: number;
  estimatedTokens: number;
  preview: string;
}

interface TeamSummary {
  id: string;
  name: string;
  role: string;
  joinedAt: string;
}

interface TeamDetails {
  id: string;
  name: string;
  role: string;
  permissions?: TeamPermissions;
  members: { id: string; userId: string; email?: string; role: string; joinedAt: string; permissions?: TeamPermissions }[];
  invitations?: { id: string; email: string; role: string; createdAt: string; invitedBy?: string }[];
  projects: { id: string; name: string; framework: string; architectureType: string; updatedAt: string }[];
}

interface TeamInvitationItem {
  id: string;
  teamId: string;
  teamName: string;
  role: string;
  invitedBy: string;
  createdAt: string;
}

interface TeamPermissions {
  canManageWorkspace: boolean;
  canTransferOwnership: boolean;
  canManageMembers: boolean;
  canInviteMembers: boolean;
  canCancelInvitations: boolean;
  canShareProjects: boolean;
  canEditSharedMemory: boolean;
  canRestoreContext: boolean;
  canViewSharedProjects: boolean;
  canUseSharedContext: boolean;
}

interface TeamAnalytics {
  members: number;
  pendingInvitations: number;
  sharedProjects: number;
  contextHistoryItems: number;
  recentActivity: number;
  memberLimit: number;
  memberUtilizationPercent: number;
  lastSharedProjectUpdate?: string | null;
  roleBreakdown: { role: string; count: number }[];
}

interface TeamAuditItem {
  id: string;
  action: string;
  details?: string;
  actorEmail?: string;
  createdAt: string;
}

type Tab = "overview" | "projects" | "team" | "connected-ides" | "scans" | "activity" | "feedback";

const PLAN_COLORS: Record<string, string> = { Free: "#8b91b3", Pro: "#4f7cff", Team: "#8b5cf6" };

function formatPlanLimit(limit: number): string {
  return Number.isFinite(limit) ? limit.toLocaleString() : "-";
}

function contextUsagePct(estimatedSize?: number, capacity?: number): number {
  if (!estimatedSize || !capacity) return 0;
  return Math.min(100, Math.round((estimatedSize / capacity) * 100));
}

const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  scan:             { icon: "01", label: "Context Signals Collected", color: "#4f7cff" },
  generate_context: { icon: "02", label: "Optimized Context Created", color: "#8b5cf6" },
  export_ide:       { icon: "03", label: "AI Export Synced",          color: "#10b981" },
  update_memory:    { icon: "04", label: "Project Memory Refined",    color: "#f59e0b" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function teamRoleSummary(role: string): string {
  switch (role) {
    case "Owner": return "Full control, billing ownership and access transfer.";
    case "Admin": return "Can invite people, share memories and manage day-to-day access.";
    case "Member": return "Can use shared project memory with connected AI tools.";
    case "Viewer": return "Can read shared context without changing team setup.";
    default: return "Team access";
  }
}

function teamActionLabel(action: string): string {
  switch (action) {
    case "team_created": return "Workspace created";
    case "team_invitation_created": return "Invitation sent";
    case "team_invitation_cancelled": return "Invitation cancelled";
    case "team_invitation_accepted": return "Invitation accepted";
    case "team_member_role_updated": return "Member access changed";
    case "team_member_removed": return "Member removed";
    case "team_project_shared": return "Project memory shared";
    case "team_ownership_transferred": return "Ownership transferred";
    default: return action.replace(/_/g, " ");
  }
}

function teamDetailSummary(details?: string): string {
  if (!details) return "";
  return details
    .split(";")
    .map(part => part.trim())
    .filter(part => part && !part.startsWith("teamId=") && !part.startsWith("memberId="))
    .join(" · ");
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, authFetch, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [showWizard, setShowWizard] = useState(false);

  // Feedback System States
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState("general");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [adminFeedbacks, setAdminFeedbacks] = useState<any[]>([]);
  const [loadingAdminFeedbacks, setLoadingAdminFeedbacks] = useState(false);
  const [feedbackCatFilter, setFeedbackCatFilter] = useState("all");

  // Admin email diagnostics states
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean; provider: string; endpoint: string; fromEmail: string } | null>(null);
  const [loadingEmailStatus, setLoadingEmailStatus] = useState(false);
  const loadingSmtpStatus = loadingEmailStatus;
  const [testRecipient, setTestRecipient] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);

  const fetchAdminFeedbacks = useCallback(async () => {
    setLoadingAdminFeedbacks(true);
    try {
      const r = await authFetch(`${API_BASE}/feedback/admin`);
      if (r.ok) {
        const d = await r.json();
        setAdminFeedbacks(d.feedbacks || []);
      }
    } catch {}
    finally { setLoadingAdminFeedbacks(false); }
  }, [authFetch]);

  const fetchEmailStatus = useCallback(async () => {
    setLoadingEmailStatus(true);
    try {
      const r = await authFetch(`${API_BASE}/audit/self-check`);
      if (r.ok) {
        const d = await r.json();
        setEmailStatus({
          configured: Boolean(d.emailConfigured ?? d.resendConfigured),
          provider: d.emailProvider || "resend",
          endpoint: d.resendEndpoint || "https://api.resend.com/emails",
          fromEmail: d.fromEmail
        });
      }
    } catch {}
    finally { setLoadingEmailStatus(false); }
  }, [authFetch]);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim()) return;
    setSendingTestEmail(true);
    setTestEmailResult(null);
    setTestEmailError(null);
    try {
      const r = await authFetch(`${API_BASE}/admin/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: testRecipient.trim() }),
      });
      if (r.ok) {
        const d = await r.json();
        setTestEmailResult(d.message || "Test email sent successfully.");
        setTestRecipient("");
      } else {
        const d = await r.json();
        setTestEmailError(d.error || "Failed to send test email.");
      }
    } catch {
      setTestEmailError("Network error occurred.");
    } finally {
      setSendingTestEmail(false);
    }
  };

  useEffect(() => {
    if (tab === "feedback" && user?.role === "Admin") {
      fetchAdminFeedbacks();
      fetchEmailStatus();
    }
  }, [tab, user, fetchAdminFeedbacks, fetchEmailStatus]);

  useEffect(() => {
    if (refreshUser) {
      refreshUser();
    }
  }, [refreshUser]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackContent.trim()) return;
    setSubmittingFeedback(true);
    try {
      const r = await authFetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: feedbackContent,
          rating: feedbackRating,
          category: feedbackCategory
        })
      });
      if (r.ok) {
        setToast({ type: "success", msg: "🎉 Thank you for your feedback!" });
        setFeedbackContent("");
        setFeedbackRating(5);
        setFeedbackCategory("general");
        setShowFeedbackModal(false);
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast({ type: "error", msg: "Failed to submit feedback. Please try again." });
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast({ type: "error", msg: "A network error occurred." });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmittingFeedback(false);
    }
  };
  const [projects, setProjects] = useState<Project[]>([]);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [ides, setIdes] = useState<ConnectedIde[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetails | null>(null);
  const [teamAnalytics, setTeamAnalytics] = useState<TeamAnalytics | null>(null);
  const [teamAudit, setTeamAudit] = useState<TeamAuditItem[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Member" | "Viewer">("Member");
  const [shareProjectId, setShareProjectId] = useState("");
  const [myInvitations, setMyInvitations] = useState<TeamInvitationItem[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);
  const [memory, setMemory] = useState<ProjectMemory | null>(null);
  const [memLoading, setMemLoading] = useState(false);
  const { showAlert, showConfirm } = useAlert();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [wasProGenerated, setWasProGenerated] = useState(false);
  const [memTab, setMemTab] = useState<"overview" | "context" | "rules" | "conventions" | "decisions" | "history">("overview");
  const [contextHistory, setContextHistory] = useState<ContextHistoryItem[]>([]);
  const [contextText, setContextText] = useState<string | null>(null);
  const [instructionsText, setInstructionsText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [revokeLoading, setRevokeLoading] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);

  // Toast for payment redirect
  useEffect(() => {
    const p = searchParams.get("payment");
    if (p === "success") {
      showAlert("Payment completed. Confirming your subscription status...", "success");
      
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("payment");
      navigate({ search: newParams.toString() }, { replace: true });

      if (refreshUser) {
        refreshUser();
        let count = 0;
        const interval = setInterval(async () => {
          count++;
          if (count > 5) {
            clearInterval(interval);
            return;
          }
          await refreshUser();
        }, 2000);
        return () => clearInterval(interval);
      }
    } else if (p === "cancelled") {
      showAlert("Payment cancelled. No charges made.", "warning");
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("payment");
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, showAlert, refreshUser, navigate]);

  // Open setup wizard automatically if ?wizard=true
  useEffect(() => {
    if (searchParams.get("wizard") === "true") {
      setShowWizard(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("wizard");
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);

  // Bridge local toast state to global showAlert
  useEffect(() => {
    if (toast) {
      showAlert(toast.msg, toast.type);
      setToast(null);
    }
  }, [toast, showAlert]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [projRes, actRes, idesRes, scansRes, teamsRes] = await Promise.all([
        authFetch(`${API_BASE}/user/projects`),
        authFetch(`${API_BASE}/user/activity?limit=30`).catch(() => null),
        authFetch(`${API_BASE}/user/connected-ides`).catch(() => null),
        authFetch(`${API_BASE}/user/scans`).catch(() => null),
        authFetch(`${API_BASE}/team`).catch(() => null),
      ]);

      if (projRes.ok) {
        const d = await projRes.json();
        setProjects(d.projects || []);
        if (d.plan) setPlan(d.plan);
      }
      if (actRes?.ok) {
        const d = await actRes.json();
        setActivities(d.activities || []);
      }
      if (idesRes?.ok) {
        const d = await idesRes.json();
        setIdes(d.connections || []);
      }
      if (scansRes?.ok) {
        const d = await scansRes.json();
        setScans(d.scans || []);
      }
      if (teamsRes?.ok) {
        const d = await teamsRes.json();
        setTeams(d.teams || []);
      }
      // Fetch pending invitations for current user
      try {
        const invRes = await authFetch(`${API_BASE}/team/invitations`);
        if (invRes.ok) {
          const invData = await invRes.json();
          setMyInvitations(invData.invitations || []);
        }
      } catch {}
    } catch {}
    finally { setLoading(false); }
  }, [user, authFetch]);

  const handleDeleteProject = async (project: Project) => {
    if (project.isShared) return;
    const confirmed = await showConfirm({
      title: "Delete project connection?",
      message: `"${project.name}" cloud memory, history, rules, and team shares will be removed. Local files will stay untouched.`,
      confirmLabel: "Delete connection",
      cancelLabel: "Keep project",
      danger: true,
    });
    if (!confirmed) return;

    setDeletingProjectId(project.id);
    try {
      const response = await authFetch(`${API_BASE}/project/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Project connection could not be deleted.");
      }

      setProjects(current => current.filter(item => item.id !== project.id));
      if (selected?.id === project.id) {
        setSelected(null);
        setMemory(null);
        setContextHistory([]);
        setContextText(null);
        setInstructionsText(null);
      }
      showAlert(data.message || "Project connection deleted. Local files were not changed.", "success");
      await fetchAll();
    } catch (error: any) {
      showAlert(error?.message || "Project connection could not be deleted.", "error");
    } finally {
      setDeletingProjectId(null);
    }
  };

  // Initial fetch + polling every 20s + refetch on focus
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const interval = setInterval(fetchAll, 20000);
    const onFocus = () => fetchAll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAll]);

  const fetchProjectMemory = async (p: Project) => {
    setSelected(p);
    setMemLoading(true);
    setMemory(null);
    setContextHistory([]);
    setContextText(null);
    setInstructionsText(null);
    setMemTab("overview");
    setIsReadOnly(false);
    setWasProGenerated(false);
    try {
      const r = await authFetch(`${API_BASE}/project/project-memory?projectPath=${encodeURIComponent(p.path)}`);
      if (r.ok) {
        const d = await r.json();
        setMemory(d);
        
        // Fetch context and instructions from the backend preview endpoint
        const ctxRes = await authFetch(`${API_BASE}/project/preview-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath: p.path, maxTokens: 8000 })
        });
        if (ctxRes.ok) {
          const ctxData = await ctxRes.json();
          setContextText(ctxData.context || "");
          setInstructionsText(ctxData.instructions || "");
          setIsReadOnly(Boolean(ctxData.isReadOnly));
          setWasProGenerated(Boolean(ctxData.wasProGenerated));
        } else {
          setContextText("Failed to generate context preview from server.");
          setIsReadOnly(false);
          setWasProGenerated(false);
        }
      } else {
        setContextText('No project memory found. Scan from your IDE first.');
      }

      const historyRes = await authFetch(`${API_BASE}/project/context-history?projectPath=${encodeURIComponent(p.path)}&limit=8`).catch(() => null);
      if (historyRes?.ok) {
        const h = await historyRes.json();
        setContextHistory(h.contexts || []);
      }
    } catch {
      setContextText('Failed to load project memory.');
    } finally {
      setMemLoading(false);
    }
  };

  const handleRevokeIde = async (id: string) => {
    if (!user) return;
    setRevokeLoading(id);
    try {
      const response = await authFetch(`${API_BASE}/user/connected-ides/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setToast({ type: "success", msg: "✓ IDE connection revoked successfully!" });
        setTimeout(() => setToast(null), 3000);
        // Refresh list
        fetchAll();
      } else {
        setToast({ type: "error", msg: "Failed to revoke IDE session." });
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast({ type: "error", msg: "Network error occurred." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setRevokeLoading(null);
    }
  };

  const loadTeam = async (teamId: string) => {
    setTeamLoading(true);
    try {
      const [response, analyticsResponse, auditResponse] = await Promise.all([
        authFetch(`${API_BASE}/team/${teamId}`),
        authFetch(`${API_BASE}/team/${teamId}/analytics`).catch(() => null),
        authFetch(`${API_BASE}/team/${teamId}/audit?limit=25`).catch(() => null),
      ]);
      if (response.ok) {
        setSelectedTeam(await response.json());
        if (analyticsResponse?.ok) {
          setTeamAnalytics(await analyticsResponse.json());
        } else {
          setTeamAnalytics(null);
        }
        if (auditResponse?.ok) {
          const data = await auditResponse.json();
          setTeamAudit(data.audit || []);
        } else {
          setTeamAudit([]);
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setToast({ type: "error", msg: data.error || "Could not load team workspace." });
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast({ type: "error", msg: "Network error while loading team workspace." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName || "Team Workspace" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ type: "error", msg: data.error === "team_plan_required" ? "Team plan required to create a workspace." : data.error || "Could not create team." });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setTeamName("");
      await fetchAll();
      await loadTeam(data.id);
      setToast({ type: "success", msg: "Team workspace created." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team/${selectedTeam.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMsg = data.error === "already_member" ? "This user is already a team member."
          : data.error === "already_invited" ? "An invitation has already been sent to this email."
          : data.message || data.error || "Could not send invitation.";
        setToast({ type: "error", msg: errorMsg });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setInviteEmail("");
      await loadTeam(selectedTeam.id);
      setToast({ type: "success", msg: "Invitation sent successfully." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleShareProject = async () => {
    if (!selectedTeam || !shareProjectId) return;
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team/${selectedTeam.id}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: shareProjectId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ type: "error", msg: data.error || "Could not share project memory." });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setShareProjectId("");
      await loadTeam(selectedTeam.id);
      await fetchAll();
      setToast({ type: "success", msg: "Project memory shared with team." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, role: "Admin" | "Member" | "Viewer") => {
    if (!selectedTeam) return;
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team/${selectedTeam.id}/members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ type: "error", msg: data.message || data.error || "Could not update member access." });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      await loadTeam(selectedTeam.id);
      setToast({ type: "success", msg: "Member access updated." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    if (!window.confirm("Remove this member from the team workspace?")) return;
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team/${selectedTeam.id}/members/${memberId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ type: "error", msg: data.error || "Could not remove member." });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      await loadTeam(selectedTeam.id);
      setToast({ type: "success", msg: "Member removed." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!selectedTeam) return;
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team/${selectedTeam.id}/invitations/${invitationId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ type: "error", msg: data.error || "Could not cancel invitation." });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      await loadTeam(selectedTeam.id);
      setToast({ type: "success", msg: "Invitation cancelled." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleTransferOwnership = async (newOwnerUserId: string) => {
    if (!selectedTeam) return;
    if (!window.confirm("Transfer workspace ownership? The new owner needs an active Team plan because their subscription will control shared access.")) return;
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team/${selectedTeam.id}/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({ type: "error", msg: data.message || data.error || "Could not transfer ownership." });
        setTimeout(() => setToast(null), 4000);
        return;
      }
      await loadTeam(selectedTeam.id);
      await fetchAll();
      setToast({ type: "success", msg: "Workspace ownership transferred." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team/invitations/${invitationId}/accept`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setToast({ type: "success", msg: data.message || "Invitation accepted!" });
        await fetchAll();
      } else {
        setToast({ type: "error", msg: data.error || "Could not accept invitation." });
      }
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    setTeamLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/team/invitations/${invitationId}/decline`, { method: "POST" });
      if (response.ok) {
        setToast({ type: "success", msg: "Invitation declined." });
        await fetchAll();
      } else {
        setToast({ type: "error", msg: "Could not decline invitation." });
      }
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!contextText) return;
    await navigator.clipboard.writeText(contextText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateEditorContext = (editor: string) => {
    if (!memory) return "";
    const name = memory.name || selected?.name || "Project";
    const framework = memory.framework || selected?.framework || 'Unknown';
    const arch = memory.architectureType || selected?.architectureType || 'Unknown';
    const db = memory.databaseType || selected?.databaseType || 'Unknown';
    const auth = memory.authSystem || selected?.authSystem || 'Unknown';
    const rules = memory.architectureRules ?? [];
    const conventions = memory.codingConventions ?? [];
    const decisions = memory.systemDecisions ?? [];
    const folders = memory.folderStructure ?? [];
    const deps = memory.metrics?.dependencies ?? [];
    const filesCount = memory.metrics?.filesCount ?? 0;
    const linesOfCode = memory.metrics?.linesOfCode ?? 0;

    const overview = [
      `## Project Overview`,
      `- **Project:** ${name}`,
      `- **Framework:** ${framework}`,
      `- **Architecture:** ${arch}`,
      `- **Database:** ${db}`,
      `- **Authentication:** ${auth}`,
      `- **Files:** ${filesCount} | **Lines of Code:** ${linesOfCode.toLocaleString()}`,
    ].join('\n');

    const techStack = memory.metrics?.techStack;
    let techStackSection = '';
    if (techStack) {
      techStackSection = '\n## Tech Stack Detection\n' +
        `- **Frontend:** ${techStack.frontend?.name ?? 'Unknown'}\n` +
        `- **Backend:** ${techStack.backend?.name ?? 'Unknown'}\n` +
        `- **Database:** ${techStack.database?.name ?? 'Unknown'}\n` +
        `- **Authentication:** ${techStack.auth?.name ?? 'Unknown'}\n` +
        `- **ORM:** ${techStack.orm?.name ?? 'Not detected'}\n` +
        `- **Package Manager:** ${techStack.packageManager?.name ?? 'Unknown'}\n` +
        `- **Deployment:** ${techStack.deployment?.name ?? 'Unknown'}\n` +
        `- **Monorepo:** ${techStack.monorepo?.name ?? 'None'}\n`;
    }

    const importantFilesList = memory.metrics?.importantFiles;
    let impFilesSection = '';
    if (importantFilesList && importantFilesList.length > 0) {
      impFilesSection = '\n## Important Files\n' +
        importantFilesList.slice(0, 5).map((f: any) => `- \`${f.path}\` (${f.category}): ${f.importance} -> *AI Behavior: ${f.aiBehavior}*`).join('\n');
    }

    const moduleMapList = memory.metrics?.moduleMap;
    let modulesSection = '';
    if (moduleMapList && moduleMapList.length > 0) {
      modulesSection = '\n## Module Map\n' +
        moduleMapList.map((m: any) => `- **${m.name}:** ${m.purpose}`).join('\n');
    }

    const archSummary = memory.metrics?.architectureSummary;
    let archSummarySection = '';
    if (archSummary) {
      archSummarySection = '\n## Architecture Summary\n' +
        `- **Style:** ${archSummary.style}\n` +
        `- **Data Flow:** ${archSummary.dataFlowDescription}\n` +
        `- **Business Logic:** ${archSummary.businessLogicLocation}\n` +
        `- **UI Location:** ${archSummary.uiLogicLocation}\n` +
        `- **API Location:** ${archSummary.apiLogicLocation}\n`;
    }

    const rulesSection = rules.length > 0
      ? `\n## Architecture Rules\n${rules.map((r: any) => `- **${r.name}**: ${r.pattern || r.description || ''}`).join('\n')}`
      : '';

    const convSection = conventions.length > 0
      ? `\n## Coding Conventions\n${conventions.map((c: any) => `- **${c.name}**: ${c.rule || ''}`).join('\n')}`
      : '';

    const decSection = decisions.length > 0
      ? `\n## System Decisions\n${decisions.map((d: any) => `- **${d.title}**: ${d.decision || ''}`).join('\n')}`
      : '';

    const folderSection = folders.length > 0
      ? `\n## Folder Structure\n${folders.slice(0, 20).map((f: any) => `- ${f}`).join('\n')}`
      : '';

    const depSection = deps.length > 0
      ? `\n## Key Dependencies\n${deps.slice(0, 15).map((d: any) => `- ${d}`).join('\n')}`
      : '';

    const body = [overview, techStackSection, archSummarySection, rulesSection, convSection, decSection, folderSection, modulesSection, impFilesSection, depSection]
      .filter(Boolean).join('\n');

    switch (editor) {
      case 'cursor':
        return `---\ndescription: AI Context Brain context for ${name}\nglobs: **/*\n---\n\n# ${name} — Project Rules\n\n${body}\n\n## Instructions\n- Follow the architecture rules above when writing code\n- Respect coding conventions for consistency\n- Check system decisions before proposing changes\n- Maintain the established folder structure\n`;
      case 'windsurf':
        return `# ${name} — Windsurf Instructions\n\n${body}\n\n## How to Use This Context\n- Reference these rules when working with this codebase\n- Follow established patterns and conventions\n- Check Project Memory before new implementations\n`;
      case 'copilot':
        return `# GitHub Copilot Instructions — ${name}\n\n${body}\n\n## Guidelines for Copilot\n- Generate code following the conventions above\n- Respect architecture boundaries\n- Include proper error handling and types\n- Follow the project's established patterns\n`;
      case 'claude':
        return `# CLAUDE.md — ${name}\n\n${body}\n\n## Your Role\nYou are an expert developer working within the constraints defined above.\n- Follow architecture rules strictly\n- Apply coding conventions consistently\n- Reference system decisions for context\n- Ask clarifying questions when uncertain\n`;
      case 'aider':
        return `# Project Conventions — ${name}\n\n${body}\n\n## When Writing Code\n1. Follow existing patterns in the codebase\n2. Use the established folder structure\n3. Add proper types and error handling\n4. Write tests for new features\n`;
      default:
        return `# AI Instructions — ${name}\n\nGenerated by AI Context Brain\n\n${body}\n`;
    }
  };

  const handleCopyRules = async (type: string) => {
    let text = "";
    if (type === "context") {
      text = contextText || "";
    } else if (type === "instructions") {
      text = instructionsText || "";
    } else {
      text = generateEditorContext(type);
    }
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleRegenerateContext = async (forceDeterministic: boolean = true) => {
    if (!selected) return;
    if (isReadOnly) {
      showAlert("Regeneration is disabled in read-only mode.", "error");
      return;
    }
    setRegenLoading(true);
    try {
      const r = await authFetch(`${API_BASE}/project/generate-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: selected.path, maxTokens: 8000, forceDeterministic })
      });
      if (r.ok) {
        showAlert(forceDeterministic ? "✓ Context regenerated (Local)!" : "✨ Context enhanced with AI!", "success");
        await fetchProjectMemory(selected);
      } else {
        const errorData = await r.json().catch(() => null);
        showAlert(errorData?.error || "Failed to regenerate context.", "error");
      }
    } catch {
      showAlert("Network error occurred.", "error");
    } finally {
      setRegenLoading(false);
    }
  };

  const lastGeneratedContextSize = plan?.lastGeneratedContextSize ?? 0;
  const maxContextSizeTokens = plan?.maxContextSizeTokens ?? 2000;
  const usagePercent = maxContextSizeTokens > 0
    ? (lastGeneratedContextSize / maxContextSizeTokens) * 100
    : 0;

  const isFreePlan = plan?.name === "Free";
  const isNearLimit = isFreePlan && usagePercent >= 80 && usagePercent <= 100;
  const isOverLimit = isFreePlan && usagePercent > 100;

  const planColor = PLAN_COLORS[plan?.name ?? "Free"] ?? "#4f7cff";
  const scanPct = plan ? Math.min(100, (plan.scansUsed / plan.scansLimit) * 100) : 0;
  const projPct = plan ? (plan.projectsLimit >= 999 ? 0 : Math.min(100, (plan.projectsUsed / plan.projectsLimit) * 100)) : 0;

  // Stats calculate
  const totalScans = scans.length;
  const totalIdes = ides.filter(i => i.isActive).length;
  const totalContextGenerations = activities.filter(a => a.action === "generate_context").length;

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: "overview", icon: "AI", label: "AI Readiness" },
    { id: "projects", icon: "PM", label: "Project Memory" },
    { id: "team", icon: "TW", label: "Team Workspace" },
    { id: "connected-ides", icon: "EX", label: "AI Integrations" },
    { id: "scans", icon: "CS", label: "Context Sources" },
    { id: "activity", icon: "OP", label: "Optimization Log" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Global alerts handled via AlertProvider */}

      <AppHeader title="Context Ops" planName={plan?.name} />

      {user && !user.isEmailVerified && (
        <div style={{
          background: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.08) 100%)",
          borderBottom: "1px solid rgba(239, 68, 68, 0.35)",
          color: "#fca5a5",
        }}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <div>
                <div>
                  <strong>Your email is unverified.</strong> To secure your account and prevent loss of context data, please verify your email.
                </div>
              </div>
            </div>
            <button
              disabled={sendingVerification}
              onClick={async () => {
                setSendingVerification(true);
                try {
                  const r = await authFetch(`${API_BASE}/auth/resend-verification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: user.email }),
                  });
                  const data = await r.json();
                  if (r.ok) {
                    setToast({ type: "success", msg: "✓ Verification email resent!" });
                  } else {
                    setToast({ type: "error", msg: data.message || data.error || "Failed to resend verification." });
                  }
                } catch {
                  setToast({ type: "error", msg: "Network error. Please try again." });
                } finally {
                  setSendingVerification(false);
                }
                setTimeout(() => setToast(null), 4000);
              }}
              className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg bg-[#ef4444]/20 hover:bg-[#ef4444]/30 disabled:opacity-50 text-white text-[11px] font-bold transition-all border border-[#ef4444]/30 shrink-0 cursor-pointer"
            >
              {sendingVerification ? "Sending..." : "Resend Verification Email"}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">

          {/* ── Sidebar Navigation ────────────────────── */}
          <aside className="w-60 shrink-0 hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="card p-2 space-y-0.5" style={{ background: "rgba(13,15,26,0.6)", borderColor: "rgba(255,255,255,0.04)" }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => { setTab(t.id); setSelected(null); }}
                    className={`sidebar-item w-full ${tab === t.id ? "active" : ""}`}>
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Plan limits card */}
              {plan && (
                <div className="card space-y-4" style={{ background: "rgba(13,15,26,0.6)", borderColor: "rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: planColor }}>Current Plan: {plan.name}</span>
                    {plan.name === "Free" && (
                      <button onClick={() => navigate("/plans")} className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ background: `${planColor}15`, color: planColor }}>Upgrade</button>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                      <span>Projects</span>
                      <span style={{ color: "var(--text-secondary)" }}>{plan.projectsUsed} / {formatPlanLimit(plan.projectsLimit)}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${projPct}%`, background: planColor }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                      <span>Context Refreshes</span>
                      <span style={{ color: scanPct > 80 ? "#ef4444" : "var(--text-secondary)" }}>{plan.scansUsed} / {plan.scansLimit}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${scanPct}%`, background: scanPct > 80 ? "#ef4444" : planColor }} /></div>
                  </div>
                  {plan.aiRequestsLimit !== undefined && (
                    <div>
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                        <span>AI Requests</span>
                        <span style={{ color: "var(--text-secondary)" }}>{plan.aiRequestsUsed} / {plan.aiRequestsLimit}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(100, ((plan.aiRequestsUsed ?? 0) / (plan.aiRequestsLimit ?? 1)) * 100)}%`, background: planColor }} />
                      </div>
                    </div>
                  )}
                  {!isFreePlan ? (
                    <div>
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                        <span>Context Capacity</span>
                        <span style={{ color: "var(--text-secondary)" }}>{Math.min(100, Math.round(usagePercent))}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(100, usagePercent)}%`, background: planColor }} />
                      </div>
                      <p className="mt-1 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                        Last context size: {lastGeneratedContextSize.toLocaleString()} / {maxContextSizeTokens.toLocaleString()} tokens
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                      {/* OVER LIMIT STATE */}
                      {isOverLimit && (
                        <div className="space-y-3 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-red-400">
                            <span>⚠️</span>
                            <span>Over Free Plan Capacity</span>
                          </div>
                          
                          <div className="flex justify-between font-bold text-[11px] text-[#f87171]">
                            <span>{lastGeneratedContextSize.toLocaleString()} / {maxContextSizeTokens.toLocaleString()} tokens</span>
                            <span>{Math.round(usagePercent)}%</span>
                          </div>
                          
                          <div className="progress-bar" style={{ height: "6px" }}>
                            <div className="progress-fill" style={{ width: "100%", background: "#ef4444" }} />
                          </div>
                          
                          <p className="text-[11px] leading-relaxed text-[#8b91b3]">
                            Your latest project exceeds the Free plan capacity.
                          </p>

                          <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-3 space-y-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">Recommended Actions</p>
                            
                            <div className="space-y-2 text-[11px] text-[#8b91b3]">
                              <div className="flex items-start gap-2">
                                <span className="text-red-400 font-bold">1.</span>
                                <div>
                                  Exclude build/dist folders using <code>.brainignore</code>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`# AI Context Brain — Ignore File\n# Patterns in this file are excluded from AI scanning\n\n# Build outputs\ndist/\nbuild/\nout/\nbin/\nobj/\n\n# Dependencies\nnode_modules/\nvendor/\n__pycache__/\n*.pyc\n\n# Temp and Logs\n*.log\n*.tmp\ncoverage/\n.nyc_output/\n\n# IDE settings\n.vs/\n.idea/\n`);
                                      showAlert("Template copied to clipboard!", "success");
                                    }}
                                    className="block mt-1 text-[10px] font-bold text-blue-400 hover:underline text-left"
                                  >
                                    📋 Copy Ignore Template
                                  </button>
                                </div>
                              </div>
                              
                              <div className="flex items-start gap-2">
                                <span className="text-red-400 font-bold">2.</span>
                                <div>
                                  Upgrade to Pro for 32k tokens capacity
                                  <button
                                    onClick={() => navigate("/plans")}
                                    className="block mt-1 text-[10px] font-bold text-indigo-400 hover:underline text-left"
                                  >
                                    ⭐ Upgrade to Pro
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            <div className="pt-1.5 border-t border-red-500/10 text-[10px] leading-relaxed text-[#4a5070]">
                              💡 <strong>Estimated optimization:</strong> Excluding node_modules, build/dist can save ~85% of token space.
                            </div>
                          </div>

                          <button
                            onClick={() => navigate("/settings?section=extension")}
                            className="btn-secondary w-full py-2 text-[11px] font-bold text-center"
                          >
                            Open Scan Settings
                          </button>
                        </div>
                      )}

                      {/* NEAR LIMIT STATE (80% - 100%) */}
                      {isNearLimit && (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-amber-400">
                            <span>⚠️</span>
                            <span>Approaching Free capacity</span>
                          </div>
                          
                          <div className="flex justify-between font-bold text-[11px] text-[#fbbf24]">
                            <span>{lastGeneratedContextSize.toLocaleString()} / {maxContextSizeTokens.toLocaleString()} tokens</span>
                            <span>{Math.round(usagePercent)}%</span>
                          </div>
                          
                          <div className="progress-bar" style={{ height: "6px" }}>
                            <div className="progress-fill" style={{ width: `${usagePercent}%`, background: "#f59e0b" }} />
                          </div>
                          
                          <p className="text-[10px] leading-relaxed text-[#8b91b3]">
                            Consider excluding unnecessary folders to keep your project optimized.
                          </p>

                          <button
                            onClick={() => navigate("/settings?section=extension")}
                            className="btn-secondary w-full py-2 text-[11px] font-bold text-center mt-1.5"
                          >
                            Open Scan Settings
                          </button>
                        </div>
                      )}

                      {/* NORMAL USAGE STATE (<80%) */}
                      {!isOverLimit && !isNearLimit && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                            <span>Context Capacity</span>
                            <span style={{ color: "var(--text-secondary)" }}>{Math.round(usagePercent)}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${usagePercent}%`, background: "#10b981" }} />
                          </div>
                          <p className="mt-1 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                            {lastGeneratedContextSize.toLocaleString()} / {maxContextSizeTokens.toLocaleString()} tokens
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {plan.scansResetDate && (
                    <p className="text-[10px] font-bold text-[#4a5070]" style={{ color: "var(--text-muted)" }}>
                      Reset date: {new Date(plan.scansResetDate).toISOString().split('T')[0]}
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* ── Main Panel ────────────────────────────── */}
          <main className="flex-1 min-w-0">

            {/* Mobile navigation tab buttons */}
            <div className="flex gap-1.5 mb-6 lg:hidden overflow-x-auto pb-2">
              {TABS.map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setSelected(null); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border"
                  style={tab === t.id
                    ? { background: "rgba(79,124,255,0.1)", color: "#7ba3ff", borderColor: "rgba(79,124,255,0.2)" }
                    : { color: "var(--text-muted)", borderColor: "var(--border)", background: "rgba(13,15,26,0.3)" }}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {/* ═══════════ 1. OVERVIEW PANEL ═══════════ */}
            {tab === "overview" && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: "PM", label: "Project Memories", value: projects.length, sub: plan ? `of ${formatPlanLimit(plan.projectsLimit)}` : "", color: "#4f7cff" },
                    { icon: "EX", label: "AI Exports", value: totalIdes, sub: "connected tools", color: "#10b981" },
                    { icon: "CS", label: "Context Refreshes", value: totalScans, sub: "source updates", color: "#8b5cf6" },
                    { icon: "AI", label: "Optimized Contexts", value: totalContextGenerations, sub: "ready outputs", color: "#06b6d4" },
                  ].map(s => (
                    <div key={s.label} className="card group hover:border-opacity-50 transition-all duration-300"
                      style={{ borderColor: `${s.color}20`, background: "rgba(13,15,26,0.7)" }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-transform group-hover:scale-110"
                          style={{ background: `${s.color}12`, border: `1px solid ${s.color}20` }}>{s.icon}</div>
                        <span className="text-[10px] font-bold text-[#4a5070] uppercase">{s.sub}</span>
                      </div>
                      <div className="text-3xl font-black" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[10px] uppercase font-bold tracking-wider mt-1 text-[#8b91b3]">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Projects Card */}
                  <div className="card" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-extrabold text-sm text-white">Recent Project Memories</h3>
                      <button onClick={() => setTab("projects")} className="text-xs font-semibold text-[#4f7cff] hover:underline">View all</button>
                    </div>
                    {loading ? (
                      <LoadingState compact title="Loading project memory" description="Reading recent context sources." rows={3} />
                    ) : projects.length === 0 ? (
                      <div className="text-left py-4">
                        <p className="text-sm font-extrabold text-white mb-2">Build your first optimized context</p>
                        <p className="text-xs text-[#8b91b3] leading-6 mb-5">
                          Connect an AI coding tool, collect repository signals, review the detected project memory, then export instructions your assistant can use immediately.
                        </p>
                        <div className="grid gap-2 mb-5">
                          {["Choose Cursor, Claude Code, Copilot, or Windsurf", "Run the first context build", "Export the optimized context pack"].map((step, index) => (
                            <div key={step} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                              <span className="w-5 h-5 rounded bg-white text-[#06070d] flex items-center justify-center text-[10px] font-black">{index + 1}</span>
                              <span className="text-xs text-[#c3cadb]">{step}</span>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => navigate("/authorize")} className="btn-primary text-xs py-2 px-4">Connect AI Tool</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {projects.slice(0, 5).map(p => (
                          <button key={p.id} onClick={() => { setTab("projects"); setTimeout(() => fetchProjectMemory(p), 100); }}
                            className="w-full flex items-center gap-3.5 p-3 rounded-xl transition-all hover:bg-white/[0.02] text-left border border-white/[0.02]">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0"
                              style={{ background: "rgba(79,124,255,0.1)", border: "1px solid rgba(79,124,255,0.15)" }}>📁</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-white truncate">{p.name || p.path.split(/[\\/]/).pop()}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {p.framework && <span className="badge-blue text-[9px] py-0 font-bold">{p.framework}</span>}
                                <span className="text-[10px] text-[#4a5070] font-semibold">{timeAgo(p.lastScanned)}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Connected IDEs Brief Panel */}
                  <div className="card" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-extrabold text-sm text-white">AI Tool Integrations</h3>
                    </div>
                    {ides.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="text-3xl mb-3">🔌</div>
                        <p className="text-xs text-gray-500 font-semibold">No AI coding tools connected</p>
                        <button onClick={() => navigate("/authorize")} className="btn-secondary text-xs py-1.5 px-3 mt-3">Link AI Tool</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ides.map(i => (
                          <div key={i.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                            <div className="flex items-center gap-3">
                              <span className="text-base">{i.editor === "Cursor" ? "🚀" : i.editor === "Windsurf" ? "🏄" : "💻"}</span>
                              <div>
                                <p className="text-xs font-bold text-white">{i.editor} Connection</p>
                                <p className="text-[10px] text-[#4a5070] font-semibold">Linked {timeAgo(i.createdAt)}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${i.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                              {i.isActive ? "Active" : "Expired"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════ 2. PROJECTS PANEL & MEMORY WORKSPACE ═══════════ */}
            {tab === "projects" && (
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Projects Selector Column */}
                <div className="xl:col-span-2 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="font-extrabold text-sm text-white">
                      Project Memories <span className="text-xs text-gray-500 font-normal ml-1">({projects.length})</span>
                    </h2>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => setShowWizard(true)} className="btn-primary text-[10px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg shrink-0">
                        ⚡ Wizard Setup
                      </button>
                      <button onClick={fetchAll} className="btn-ghost text-xs py-1 px-3">↻ Refresh</button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="card flex justify-center py-16"><div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent"/></div>
                  ) : projects.length === 0 ? (
                    <div className="card text-center py-16" style={{ background: "rgba(13,15,26,0.6)" }}>
                      <div className="text-5xl mb-4">📭</div>
                      <p className="text-sm font-extrabold text-white mb-1">No project memory yet</p>
                      <p className="text-xs text-[#8b91b3] mb-5">Connect your preferred AI tool, or start instantly by generating a configured project structure & rules.</p>
                      <div className="flex justify-center gap-3">
                        <button onClick={() => navigate("/authorize")} className="btn-primary text-xs py-2.5 px-5">Connect AI Tool</button>
                        <button onClick={() => setShowWizard(true)} className="btn-secondary text-xs py-2.5 px-5">⚡ Launch Wizard</button>
                      </div>
                    </div>
                  ) : (
                    projects.map(p => (
                      <div
                        key={p.id}
                        onClick={() => fetchProjectMemory(p)}
                        className="card-hover p-4"
                        style={selected?.id === p.id 
                          ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } 
                          : { background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
                            style={{ background: "rgba(79,124,255,0.1)", border: "1px solid rgba(79,124,255,0.15)" }}>📁</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs text-white truncate flex-1">{p.name || p.path.split(/[\\/]/).pop()}</p>
                              {!p.isShared && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteProject(p);
                                  }}
                                  disabled={deletingProjectId === p.id}
                                  title="Delete cloud project connection"
                                  className="text-[10px] font-bold text-red-400 hover:text-red-300 disabled:opacity-40"
                                >
                                  {deletingProjectId === p.id ? "Deleting..." : "Delete"}
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-[#4a5070] font-mono mt-0.5 truncate">{p.path}</p>
                            <div className="flex gap-1.5 mt-2.5 flex-wrap">
                              {p.framework && <span className="badge-blue text-[9px] font-bold py-0">{p.framework}</span>}
                              {p.architectureType && <span className="badge-purple text-[9px] font-bold py-0">{p.architectureType}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Living Project Details Workspace Column */}
                <div className="xl:col-span-3">
                  {selected ? (
                    <div className="card flex flex-col h-full sticky top-24" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                        <div>
                          <h3 className="font-extrabold text-base text-white">{selected.name || "Workspace"}</h3>
                          <p className="text-[10px] font-semibold text-[#4a5070] mt-0.5">Last context refresh: {selected.lastScanned ? timeAgo(selected.lastScanned) : "—"}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleRegenerateContext(true)} disabled={regenLoading || memLoading || isReadOnly}
                            title={isReadOnly ? "Regeneration is disabled because this project is over plan capacity." : ""}
                            className="btn-secondary text-xs py-2 px-3.5 disabled:opacity-40 font-bold shrink-0">
                            {regenLoading ? "Regenerating..." : "Regenerate (Local)"}
                          </button>
                          <button onClick={() => handleRegenerateContext(false)} disabled={regenLoading || memLoading || isReadOnly}
                            title={isReadOnly ? "Regeneration is disabled because this project is over plan capacity." : "Enhance rules and analysis using AI priority models."}
                            className="btn-primary text-xs py-2 px-3.5 disabled:opacity-40 font-bold shrink-0"
                            style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)", boxShadow: "0 4px 15px rgba(139,92,246,0.25)" }}>
                            ✨ AI Enhance
                          </button>
                          <button onClick={handleCopy} disabled={!contextText || memLoading}
                            className={`${copied ? "btn-success" : "btn-primary"} text-xs py-2 px-3.5 disabled:opacity-40 font-bold shrink-0`}>
                            {copied ? "Copied" : "Copy Optimized Context"}
                          </button>
                        </div>
                      </div>

                      {isReadOnly && (
                        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 text-xs font-semibold text-amber-200">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">⚠️</span>
                            <span className="font-bold">Read-Only Mode</span>
                          </div>
                          <p className="text-[#8b91b3] font-normal leading-relaxed text-[11px]">
                            {wasProGenerated 
                              ? "This project context was generated on a Pro plan but is now over the Free capacity. It is kept readable, but regeneration is disabled until you exclude files or upgrade."
                              : "This project context size exceeds the Free plan token capacity. It is now read-only. Optimize your settings or upgrade to refresh."}
                          </p>
                        </div>
                      )}

                      {/* Folder metrics */}
                      {memory?.metrics && (
                        <div className="grid grid-cols-3 gap-3 mb-5">
                          {[
                            { label: "Code Files", value: memory.metrics.filesCount ?? 0, color: "#4f7cff" },
                            { label: "Lines of Code", value: (memory.metrics.linesOfCode ?? 0).toLocaleString(), color: "#8b5cf6" },
                            { label: "Folder Layers", value: memory.metrics.foldersCount ?? 0, color: "#06b6d4" },
                          ].map(s => (
                            <div key={s.label} className="p-3 rounded-xl text-center bg-[#06070d] border border-white/[0.03]">
                              <div className="text-base font-black" style={{ color: s.color }}>{s.value}</div>
                              <div className="text-[9px] uppercase font-bold text-gray-500 mt-0.5">{s.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Memory Workspace Sub-Tabs */}
                      <div className="flex p-1 rounded-xl mb-4 bg-[#06070d] border border-white/[0.03] overflow-x-auto">
                        {[
                          { id: "overview", label: "Overview" },
                          { id: "context", label: "Optimized Context" },
                          { id: "rules", label: "Guardrails" },
                          { id: "conventions", label: "Conventions" },
                          { id: "decisions", label: "Decisions" },
                          { id: "history", label: "History" },
                        ].map(mt => (
                          <button key={mt.id} onClick={() => setMemTab(mt.id as any)}
                                  className="flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap px-2"
                                  style={memTab === mt.id
                                    ? { background: "linear-gradient(135deg,#4f7cff,#6366f1)", color: "#fff" }
                                    : { color: "#4a5070" }}>
                            {mt.label}
                          </button>
                        ))}
                      </div>

                      {/* Living Context Preview Panel */}
                      <div className="flex-1 rounded-xl p-4 font-mono text-xs leading-relaxed overflow-auto bg-[#06070d] border border-white/[0.03]"
                           style={{ minHeight: 300, maxHeight: 450 }}>
                        {memLoading ? (
                          <div className="flex items-center justify-center h-40 gap-2 text-xs font-semibold text-gray-500 font-sans">
                            <div className="w-4 h-4 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent"/>
                            Loading optimized project memory...
                          </div>
                        ) : memTab === "overview" ? (
                          <div className="space-y-5 font-sans">
                            {/* Identity / Overview Section */}
                            <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Project Identity & Architecture</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                                <div>
                                  <span className="text-[#8b91b3] block">Framework</span>
                                  <span className="text-white font-bold">{memory?.framework || selected.framework || "Not detected"}</span>
                                </div>
                                <div>
                                  <span className="text-[#8b91b3] block">Architecture</span>
                                  <span className="text-white font-bold">{memory?.architectureType || selected.architectureType || "Not detected"}</span>
                                </div>
                                <div>
                                  <span className="text-[#8b91b3] block">Database</span>
                                  <span className="text-white font-bold">{memory?.databaseType || selected.databaseType || "None"}</span>
                                </div>
                                <div>
                                  <span className="text-[#8b91b3] block">Auth System</span>
                                  <span className="text-white font-bold">{memory?.authSystem || selected.authSystem || "None"}</span>
                                </div>
                                {memory?.metrics?.architectureSummary?.style && (
                                  <div className="col-span-2">
                                    <span className="text-[#8b91b3] block">Architecture Style</span>
                                    <span className="text-white font-bold">{memory.metrics.architectureSummary.style}</span>
                                  </div>
                                )}
                              </div>
                              {memory?.metrics?.architectureSummary?.dataFlowDescription && (
                                <div className="mt-2 text-xs border-t border-white/[0.02] pt-2">
                                  <span className="text-[#8b91b3] block mb-1">Data Flow Description</span>
                                  <p className="text-gray-300 leading-relaxed">{memory.metrics.architectureSummary.dataFlowDescription}</p>
                                </div>
                              )}
                            </div>

                            {/* Tech Stack gauges */}
                            {memory?.metrics?.techStack && (
                              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Tech Stack Detection</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {Object.entries(memory.metrics.techStack).map(([key, val]) => {
                                    if (!val || typeof val !== "object" || Array.isArray(val)) return null;
                                    const item = val as { name: string; confidence: number };
                                    if (!item.name) return null;
                                    return (
                                      <div key={key} className="p-2.5 rounded-lg bg-black/40 border border-white/[0.02]">
                                        <span className="text-[10px] text-gray-400 capitalize block">{key}</span>
                                        <span className="text-xs font-bold text-white block truncate">{item.name}</span>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                          <div className="flex-1 bg-white/5 h-1 rounded overflow-hidden">
                                            <div className="bg-[#4f7cff] h-full" style={{ width: `${item.confidence * 100}%` }} />
                                          </div>
                                          <span className="text-[9px] font-bold text-[#8b91b3]">{Math.round(item.confidence * 100)}%</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Module Map */}
                            {memory?.metrics?.moduleMap && memory.metrics.moduleMap.length > 0 && (
                              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Codebase Module Map</h4>
                                <div className="space-y-2">
                                  {memory.metrics.moduleMap.map((mod, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-black/40 border border-white/[0.02] flex justify-between items-start gap-4">
                                      <div>
                                        <span className="text-xs font-bold text-white">{mod.name}</span>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{mod.purpose}</p>
                                        {mod.keyFiles && mod.keyFiles.length > 0 && (
                                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                            {mod.keyFiles.map((kf, ki) => (
                                              <span key={ki} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-indigo-300 truncate max-w-[200px]" title={kf}>
                                                {kf.split('/').pop()}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                        mod.status === "stable" ? "bg-emerald-500/10 text-emerald-400" :
                                        mod.status === "refactoring" ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400"
                                      }`}>{mod.status || "active"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Important Files */}
                            {memory?.metrics?.importantFiles && memory.metrics.importantFiles.length > 0 && (
                              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Important Files & AI Behaviors</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b border-white/[0.04]">
                                        <th className="text-[10px] font-bold uppercase text-[#4a5070] pb-2">Path</th>
                                        <th className="text-[10px] font-bold uppercase text-[#4a5070] pb-2">Category</th>
                                        <th className="text-[10px] font-bold uppercase text-[#4a5070] pb-2">AI Behavior Suggestion</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {memory.metrics.importantFiles.map((file, i) => (
                                        <tr key={i} className="border-b border-white/[0.02] last:border-0">
                                          <td className="py-2 pr-2 font-mono text-[11px] text-indigo-300 truncate max-w-[200px]" title={file.path}>{file.path}</td>
                                          <td className="py-2 pr-2"><span className="badge-blue text-[9px] py-0">{file.category}</span></td>
                                          <td className="py-2 text-gray-300">{file.aiBehavior}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* File Metrics: Largest & Recently Modified */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Largest Files */}
                              {memory?.metrics?.largestFiles && memory.metrics.largestFiles.length > 0 && (
                                <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-3">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Largest Files</h4>
                                  <div className="space-y-1.5">
                                    {memory.metrics.largestFiles.slice(0, 5).map((f, i) => (
                                      <div key={i} className="flex justify-between items-center gap-2 text-xs">
                                        <span className="font-mono text-gray-300 truncate max-w-[180px]" title={f.path}>{f.path.split('/').pop()}</span>
                                        <span className="text-[#8b91b3] font-semibold shrink-0">{(f.sizeBytes / 1024).toFixed(1)} KB · {f.lines} lines</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Recently Modified Files */}
                              {memory?.metrics?.recentlyModifiedFiles && memory.metrics.recentlyModifiedFiles.length > 0 && (
                                <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-3">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Recently Modified</h4>
                                  <div className="space-y-1.5">
                                    {memory.metrics.recentlyModifiedFiles.slice(0, 5).map((f, i) => (
                                      <div key={i} className="flex justify-between items-center gap-2 text-xs">
                                        <span className="font-mono text-gray-300 truncate max-w-[180px]" title={f.path}>{f.path.split('/').pop()}</span>
                                        <span className="text-[#8b91b3] font-semibold shrink-0">
                                          {f.lastModified ? timeAgo(new Date(f.lastModified).toISOString()) : "just now"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : memTab === "context" ? (
                          <div className="space-y-4 font-sans">
                            <div className="flex flex-wrap gap-2 pb-3 border-b border-white/[0.04]">
                              <button
                                onClick={() => handleCopyRules("context")}
                                className={`px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold transition-all hover:bg-white/10 ${copiedType === "context" ? "text-emerald-400 border-emerald-500/30" : "text-white"}`}
                              >
                                {copiedType === "context" ? "Copied .ai-context.md" : "Copy .ai-context.md"}
                              </button>
                              <button
                                onClick={() => handleCopyRules("instructions")}
                                className={`px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold transition-all hover:bg-white/10 ${copiedType === "instructions" ? "text-emerald-400 border-emerald-500/30" : "text-white"}`}
                              >
                                {copiedType === "instructions" ? "Copied AI_INSTRUCTIONS.md" : "Copy AI_INSTRUCTIONS.md"}
                              </button>
                              <button
                                onClick={() => handleCopyRules("cursor")}
                                className={`px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold transition-all hover:bg-white/10 ${copiedType === "cursor" ? "text-emerald-400 border-emerald-500/30" : "text-white"}`}
                              >
                                {copiedType === "cursor" ? "Copied Cursor rules" : "Copy Cursor rules"}
                              </button>
                              <button
                                onClick={() => handleCopyRules("windsurf")}
                                className={`px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold transition-all hover:bg-white/10 ${copiedType === "windsurf" ? "text-emerald-400 border-emerald-500/30" : "text-white"}`}
                              >
                                {copiedType === "windsurf" ? "Copied Windsurf rules" : "Copy Windsurf rules"}
                              </button>
                              <button
                                onClick={() => handleCopyRules("copilot")}
                                className={`px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold transition-all hover:bg-white/10 ${copiedType === "copilot" ? "text-emerald-400 border-emerald-500/30" : "text-white"}`}
                              >
                                {copiedType === "copilot" ? "Copied Copilot rules" : "Copy Copilot rules"}
                              </button>
                              <button
                                onClick={() => handleCopyRules("claude")}
                                className={`px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold transition-all hover:bg-white/10 ${copiedType === "claude" ? "text-emerald-400 border-emerald-500/30" : "text-white"}`}
                              >
                                {copiedType === "claude" ? "Copied Claude rules" : "Copy Claude rules"}
                              </button>
                              <button
                                onClick={() => handleCopyRules("aider")}
                                className={`px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold transition-all hover:bg-white/10 ${copiedType === "aider" ? "text-emerald-400 border-emerald-500/30" : "text-white"}`}
                              >
                                {copiedType === "aider" ? "Copied Aider conventions" : "Copy Aider conventions"}
                              </button>
                            </div>
                            <pre className="whitespace-pre-wrap text-indigo-200 font-mono text-xs">{contextText || "No optimized context yet. Build your first context pack from your editor."}</pre>
                          </div>
                        ) : memTab === "rules" ? (
                          <div className="space-y-3 font-sans">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a5070]">Active Architectural Rules</p>
                            {memory?.architectureRules && memory.architectureRules.length > 0 ? (
                              memory.architectureRules.map((r, index) => (
                                <div key={index} className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-1">
                                  <span className="badge-blue text-[9px] py-0 font-bold">{r.name}</span>
                                  <p className="text-xs font-bold text-white mt-1">{r.pattern}</p>
                                </div>
                              ))
                            ) : <p className="text-xs text-gray-500 italic">No custom rules configured yet.</p>}
                          </div>
                        ) : memTab === "conventions" ? (
                          <div className="space-y-3 font-sans">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a5070]">Coding Styles & Conventions</p>
                            {memory?.codingConventions && memory.codingConventions.length > 0 ? (
                              memory.codingConventions.map((c, index) => (
                                <div key={index} className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-1">
                                  <span className="badge-purple text-[9px] py-0 font-bold">{c.name}</span>
                                  <p className="text-xs font-bold text-white mt-1">{c.rule}</p>
                                </div>
                              ))
                            ) : <p className="text-xs text-gray-500 italic">No conventions configured yet.</p>}
                          </div>
                        ) : memTab === "decisions" ? (
                          <div className="space-y-3 font-sans">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a5070]">System Design Decisions</p>
                            {memory?.systemDecisions && memory.systemDecisions.length > 0 ? (
                              memory.systemDecisions.map((d, index) => (
                                <div key={index} className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-1">
                                  <span className="badge-cyan text-[9px] py-0 font-bold">{d.title}</span>
                                  <p className="text-xs font-bold text-white mt-1">{d.decision}</p>
                                </div>
                              ))
                            ) : <p className="text-xs text-gray-500 italic">No system decisions registered yet.</p>}
                          </div>
                        ) : (
                          <div className="space-y-3 font-sans">
                            <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a5070]">Optimized Context History</p>
                              <span className="text-[10px] font-bold text-[#4a5070]">{contextHistory.length} records</span>
                            </div>
                            {contextHistory.length > 0 ? (
                              contextHistory.map(item => (
                                <div key={item.id} className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] space-y-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="badge-cyan text-[9px] py-0 font-bold">{new Date(item.createdAt).toLocaleString()}</span>
                                    <span className="text-[10px] font-mono text-indigo-300">
                                      {contextUsagePct(item.estimatedTokens, plan?.maxContextSizeTokens ?? 2000)}% usage
                                    </span>
                                  </div>
                                  <p className="text-xs text-indigo-100 font-mono whitespace-pre-wrap">{item.preview}</p>
                                  <p className="text-[10px] text-[#4a5070] font-bold">{item.characterCount.toLocaleString()} characters</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-gray-500 italic">
                                No saved context history yet. Generate optimized context from your AI tool on a Pro or Team plan.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="card flex flex-col items-center justify-center py-24 text-center" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4"
                        style={{ background: "rgba(79,124,255,0.08)", border: "1px solid rgba(79,124,255,0.15)" }}>📁</div>
                      <p className="text-sm font-extrabold text-white mb-1">Select a project memory</p>
                      <p className="text-xs text-gray-500">Inspect optimized AI context, decisions, conventions and guardrails before exporting.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════ 3. TEAM WORKSPACE PANEL ═══════════ */}
            {tab === "team" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-extrabold text-lg text-white">Team Workspace</h2>
                    <p className="text-xs text-[#8b91b3] mt-0.5">Give your team one shared memory for AI-assisted development.</p>
                  </div>
                  <button onClick={fetchAll} className="btn-ghost text-xs py-1.5 px-3">Refresh</button>
                </div>

                {selectedTeam && teamAnalytics && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "People", value: `${teamAnalytics.members}/${teamAnalytics.memberLimit}`, note: `${teamAnalytics.pendingInvitations} pending`, color: "#8b5cf6" },
                      { label: "Shared memories", value: teamAnalytics.sharedProjects, note: "available to this team", color: "#4f7cff" },
                      { label: "Context versions", value: teamAnalytics.contextHistoryItems, note: "saved for shared projects", color: "#10b981" },
                      { label: "Recent changes", value: teamAnalytics.recentActivity, note: "last 30 days", color: "#f59e0b" },
                    ].map(item => (
                      <div key={item.label} className="card p-4" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a5070]">{item.label}</p>
                        <p className="text-2xl font-black mt-2" style={{ color: item.color }}>{item.value}</p>
                        <p className="text-[10px] text-[#8b91b3] mt-1">{item.note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Incoming team invitations */}
                {myInvitations.length > 0 && (
                  <div className="card space-y-3" style={{ background: "rgba(139,92,246,0.06)", borderColor: "rgba(139,92,246,0.25)" }}>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#c4b5fd" }}>Incoming Team Invitations</p>
                    <div className="space-y-2">
                      {myInvitations.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                          <div>
                            <p className="text-xs font-bold text-white">{inv.teamName}</p>
                            <p className="text-[10px] text-[#8b91b3]">Invited by {inv.invitedBy} · Role: {inv.role} · {timeAgo(inv.createdAt)}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleAcceptInvitation(inv.id)} disabled={teamLoading}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50 transition-all">Accept</button>
                            <button onClick={() => handleDeclineInvitation(inv.id)} disabled={teamLoading}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 disabled:opacity-50 transition-all">Decline</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {plan?.name !== "Team" && teams.length === 0 ? (
                  <div className="card text-center py-16" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-black mx-auto mb-4"
                      style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.25)", color: "#c4b5fd" }}>
                      TW
                    </div>
                    <p className="text-sm font-extrabold text-white mb-1">Team workspaces are a Team plan feature</p>
                    <p className="text-xs text-[#8b91b3] mb-6 max-w-lg mx-auto">
                      Upgrade to create shared project memory, invite members and keep every assistant aligned with the same rules.
                    </p>
                    <button onClick={() => navigate("/plans")} className="btn-primary text-xs py-2.5 px-6">Upgrade to Team</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    <div className="xl:col-span-2 space-y-4">
                      {plan?.name === "Team" && (
                        <div className="card space-y-3" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Create Workspace</p>
                          <input
                            className="input text-sm"
                            value={teamName}
                            onChange={e => setTeamName(e.target.value)}
                            placeholder="Engineering Team"
                          />
                          <button onClick={handleCreateTeam} disabled={teamLoading} className="btn-primary text-xs py-2 px-4 w-full disabled:opacity-50">
                            {teamLoading ? "Working..." : "Create Team Workspace"}
                          </button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Your Workspaces</p>
                        {teams.length === 0 ? (
                          <div className="card text-center py-10" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                            <p className="text-xs text-[#8b91b3]">No team workspace yet.</p>
                          </div>
                        ) : teams.map(team => (
                          <button
                            key={team.id}
                            onClick={() => loadTeam(team.id)}
                            className="card-hover p-4 w-full text-left"
                            style={selectedTeam?.id === team.id
                              ? { borderColor: "rgba(139,92,246,0.45)", background: "rgba(139,92,246,0.05)" }
                              : { background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-extrabold text-white">{team.name}</p>
                                <p className="text-[10px] text-[#4a5070] font-semibold mt-1">Joined {timeAgo(team.joinedAt)}</p>
                              </div>
                              <span className="badge-purple text-[9px] py-0 font-bold">{team.role}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="xl:col-span-3">
                      {!selectedTeam ? (
                        <div className="card flex flex-col items-center justify-center py-24 text-center" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-black mb-4"
                            style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.25)", color: "#c4b5fd" }}>
                            TW
                          </div>
                          <p className="text-sm font-extrabold text-white mb-1">Select a team workspace</p>
                          <p className="text-xs text-gray-500">Manage members and shared project memory from one place.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="card" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                            <div className="flex items-start justify-between gap-4 mb-5">
                              <div>
                                <h3 className="text-base font-extrabold text-white">{selectedTeam.name}</h3>
                                <p className="text-xs text-[#8b91b3] mt-1">{teamRoleSummary(selectedTeam.role)}</p>
                              </div>
                              <span className="badge-purple text-[9px] py-0 font-bold">{selectedTeam.members.length}/10 people</span>
                            </div>

                            <div className="grid md:grid-cols-4 gap-2 mb-6">
                              {["Owner", "Admin", "Member", "Viewer"].map(role => {
                                const count = teamAnalytics?.roleBreakdown?.find(r => r.role === role)?.count ?? selectedTeam.members.filter(m => m.role === role).length;
                                return (
                                  <div key={role} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-extrabold text-white">{role}</p>
                                      <span className="text-[10px] font-bold text-[#8b91b3]">{count}</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-[#8b91b3] mt-2">{teamRoleSummary(role)}</p>
                                  </div>
                                );
                              })}
                            </div>

                            {(selectedTeam.permissions?.canInviteMembers || selectedTeam.permissions?.canShareProjects) && (
                              <div className="grid md:grid-cols-2 gap-4 mb-6">
                                {selectedTeam.permissions?.canInviteMembers && (
                                  <div className="rounded-xl border border-white/[0.04] bg-[#06070d] p-4 space-y-3">
                                    <p className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Invite Teammate</p>
                                    <input className="input text-sm" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@example.com" />
                                    <select className="input text-sm" value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                                      <option value="Admin">Admin - manage sharing and invites</option>
                                      <option value="Member">Member - use shared memory</option>
                                      <option value="Viewer">Viewer - read shared context</option>
                                    </select>
                                    <button onClick={handleInviteMember} disabled={teamLoading || !inviteEmail.trim()} className="btn-primary text-xs py-2 px-4 w-full disabled:opacity-50">
                                      Send Invitation
                                    </button>
                                  </div>
                                )}

                                {selectedTeam.permissions?.canShareProjects && (
                                  <div className="rounded-xl border border-white/[0.04] bg-[#06070d] p-4 space-y-3">
                                    <p className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Share Project Memory</p>
                                    <select className="input text-sm" value={shareProjectId} onChange={e => setShareProjectId(e.target.value)}>
                                      <option value="">Select owned project</option>
                                      {projects.filter(p => !p.isShared).map(project => (
                                        <option key={project.id} value={project.id}>{project.name}</option>
                                      ))}
                                    </select>
                                    <button onClick={handleShareProject} disabled={teamLoading || !shareProjectId} className="btn-primary text-xs py-2 px-4 w-full disabled:opacity-50">
                                      Share with Team
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-bold uppercase tracking-wider text-[#4a5070]">Members</p>
                                </div>
                                <input
                                  className="input text-xs mb-3"
                                  value={memberSearch}
                                  onChange={e => setMemberSearch(e.target.value)}
                                  placeholder="Search by email..."
                                />
                                <div className="space-y-2">
                                  {selectedTeam.members
                                    .filter(m => !memberSearch.trim() || (m.email || "").toLowerCase().includes(memberSearch.trim().toLowerCase()))
                                    .map(member => (
                                    <div key={member.id} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-white truncate">{member.email || member.userId}</p>
                                          <p className="text-[10px] text-[#4a5070]">Joined {timeAgo(member.joinedAt)}</p>
                                          <p className="text-[10px] text-[#8b91b3] mt-1">{teamRoleSummary(member.role)}</p>
                                        </div>
                                        <span className="badge-blue text-[9px] py-0 font-bold shrink-0">{member.role}</span>
                                      </div>
                                      {(selectedTeam.permissions?.canManageMembers || selectedTeam.permissions?.canTransferOwnership) && member.role !== "Owner" && member.userId !== user?.id && (
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                          {selectedTeam.permissions?.canTransferOwnership && (
                                            <select
                                              className="input text-[11px] py-1.5 px-2 w-auto"
                                              value={member.role}
                                              disabled={teamLoading}
                                              onChange={e => handleUpdateMemberRole(member.id, e.target.value as "Admin" | "Member" | "Viewer")}
                                            >
                                              <option value="Admin">Admin</option>
                                              <option value="Member">Member</option>
                                              <option value="Viewer">Viewer</option>
                                            </select>
                                          )}
                                          {selectedTeam.permissions?.canTransferOwnership && (
                                            <button
                                              onClick={() => handleTransferOwnership(member.userId)}
                                              disabled={teamLoading}
                                              className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 disabled:opacity-50 transition-all"
                                            >
                                              Make Owner
                                            </button>
                                          )}
                                          {selectedTeam.permissions?.canManageMembers && !(selectedTeam.role === "Admin" && member.role === "Admin") && (
                                            <button
                                              onClick={() => handleRemoveMember(member.id)}
                                              disabled={teamLoading}
                                              className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                                            >
                                              Remove
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {/* Pending Invitations */}
                                {(selectedTeam.invitations?.filter(i => !memberSearch.trim() || i.email.toLowerCase().includes(memberSearch.trim().toLowerCase())).length ?? 0) > 0 && (
                                  <div className="mt-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-[#4a5070] mb-2">Pending Invitations</p>
                                    <div className="space-y-2">
                                      {selectedTeam.invitations
                                        ?.filter(i => !memberSearch.trim() || i.email.toLowerCase().includes(memberSearch.trim().toLowerCase()))
                                        .map(inv => (
                                        <div key={inv.id} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3">
                                          <div>
                                            <p className="text-xs font-bold text-white">{inv.email}</p>
                                            <p className="text-[10px] text-amber-400/70">Pending · {inv.role} · {timeAgo(inv.createdAt)}</p>
                                          </div>
                                          {selectedTeam.permissions?.canCancelInvitations ? (
                                            <button
                                              onClick={() => handleCancelInvitation(inv.id)}
                                              disabled={teamLoading}
                                              className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50 transition-all"
                                            >
                                              Cancel
                                            </button>
                                          ) : (
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">Pending</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[#4a5070] mb-3">Shared Memories</p>
                                <div className="space-y-2">
                                  {selectedTeam.projects.length === 0 ? (
                                    <p className="text-xs text-[#8b91b3] rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">No project memory shared yet.</p>
                                  ) : selectedTeam.projects.map(project => (
                                    <div key={project.id} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                                      <p className="text-xs font-bold text-white">{project.name}</p>
                                      <div className="flex gap-2 mt-2 flex-wrap">
                                        <span className="badge-blue text-[9px] py-0 font-bold">{project.framework}</span>
                                        <span className="badge-purple text-[9px] py-0 font-bold">{project.architectureType}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-4">
                                  <p className="text-xs font-bold uppercase tracking-wider text-[#4a5070] mb-3">Recent Team Activity</p>
                                  <div className="space-y-2">
                                    {teamAudit.length === 0 ? (
                                      <p className="text-xs text-[#8b91b3] rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">No team activity recorded yet.</p>
                                    ) : teamAudit.slice(0, 6).map(item => (
                                      <div key={item.id} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs font-bold text-white">{teamActionLabel(item.action)}</p>
                                          <span className="text-[10px] text-[#4a5070]">{timeAgo(item.createdAt)}</span>
                                        </div>
                                        <p className="text-[10px] text-[#8b91b3] mt-1">
                                          {item.actorEmail || "Team member"}{teamDetailSummary(item.details) ? ` · ${teamDetailSummary(item.details)}` : ""}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ 3. CONNECTED IDES PANEL ═══════════ */}
            {tab === "connected-ides" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-extrabold text-lg text-white">Authorized AI Tool Integrations</h2>
                    <p className="text-xs text-[#8b91b3] mt-0.5">Manage which assistants can read optimized context and update project memory.</p>
                  </div>
                  <button onClick={fetchAll} className="btn-ghost text-xs py-1.5 px-3">↻ Refresh</button>
                </div>

                {ides.length === 0 ? (
                  <div className="card text-center py-16" style={{ background: "rgba(13,15,26,0.7)" }}>
                    <div className="text-5xl mb-4">🔌</div>
                    <p className="text-sm font-extrabold text-white mb-1">No AI tools connected</p>
                    <p className="text-xs text-[#8b91b3] mb-6">Connect Cursor, Claude Code, Copilot, or Windsurf to use optimized project memory.</p>
                    <button onClick={() => navigate("/authorize")} className="btn-primary text-xs py-2.5 px-6">Authorize AI Tool</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ides.map(i => (
                      <div key={i.id} className="card p-5 flex items-start justify-between gap-4" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-xl shadow-inner">
                            {i.editor === "Cursor" ? "🚀" : i.editor === "Windsurf" ? "🏄" : "💻"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-sm text-white">{i.editor} Connection</h4>
                              <span className={`w-2 h-2 rounded-full ${i.isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                            </div>
                            <p className="text-[10px] text-[#4a5070] font-semibold mt-1">AUTHORIZED: {new Date(i.createdAt).toLocaleString()}</p>
                            <p className="text-[10px] text-[#4a5070] font-semibold">EXPIRES: {new Date(i.expiresAt).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRevokeIde(i.id)}
                          disabled={revokeLoading === i.id}
                          className="btn-danger text-[10px] font-extrabold uppercase tracking-wide py-1.5 px-3 disabled:opacity-40 shrink-0"
                        >
                          {revokeLoading === i.id ? "Revoking..." : "Revoke"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ 4. SCANS HISTORY PANEL ═══════════ */}
            {tab === "scans" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-extrabold text-lg text-white">Context Source History</h2>
                    <p className="text-xs text-[#8b91b3] mt-0.5">Chronological summary of repository signals used to keep AI context fresh.</p>
                  </div>
                  <button onClick={fetchAll} className="btn-ghost text-xs py-1.5 px-3">↻ Refresh</button>
                </div>

                {scans.length === 0 ? (
                  <div className="card text-center py-16" style={{ background: "rgba(13,15,26,0.7)" }}>
                    <div className="text-5xl mb-4">🔍</div>
                    <p className="text-sm font-extrabold text-white mb-1">No context sources yet</p>
                    <p className="text-xs text-[#8b91b3]">Repository signal history will appear after your first context refresh.</p>
                  </div>
                ) : (
                  <div className="card overflow-x-auto p-0" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.04] bg-[#06070d]">
                          <th className="text-[10px] font-extrabold uppercase tracking-wider text-[#4a5070] px-5 py-3">Project</th>
                          <th className="text-[10px] font-extrabold uppercase tracking-wider text-[#4a5070] px-5 py-3">Scan Date</th>
                          <th className="text-[10px] font-extrabold uppercase tracking-wider text-[#4a5070] px-5 py-3">Framework</th>
                          <th className="text-[10px] font-extrabold uppercase tracking-wider text-[#4a5070] px-5 py-3">Structure</th>
                          <th className="text-[10px] font-extrabold uppercase tracking-wider text-[#4a5070] px-5 py-3">Code Metrics</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scans.map(s => (
                          <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="text-xs font-bold text-white">{s.projectName}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-xs text-gray-300 font-semibold">{new Date(s.scanDate).toLocaleString()}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="badge-blue text-[9px] py-0 font-bold">{s.framework}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="badge-purple text-[9px] py-0 font-bold">{s.architectureType}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-[11px] font-mono text-indigo-300 font-semibold">
                                {s.filesCount} files · {s.linesOfCode.toLocaleString()} LoC
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}



            {/* ═══════════ 5. SYSTEM ACTIVITY PANEL ═══════════ */}
            {tab === "activity" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="font-extrabold text-lg text-white">Optimization Log</h2>
                    <p className="text-xs text-[#8b91b3] mt-0.5">Audit log of context refreshes, optimized outputs and AI tool connections.</p>
                  </div>
                  <button onClick={fetchAll} className="btn-ghost text-xs py-1.5 px-3">↻ Refresh</button>
                </div>

                {activities.length === 0 ? (
                  <div className="card text-center py-16" style={{ background: "rgba(13,15,26,0.7)" }}>
                    <div className="text-5xl mb-4">📋</div>
                    <p className="text-sm font-extrabold text-white mb-1">No optimization activity yet</p>
                    <p className="text-xs text-[#8b91b3]">Activity appears as you build project memory, optimize context and export to AI tools.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activities.map((a, i) => {
                      const meta = ACTION_META[a.action] || { icon: "📌", label: a.action, color: "#8b91b3" };
                      const showDate = i === 0 || new Date(a.createdAt).toDateString() !== new Date(activities[i - 1].createdAt).toDateString();
                      return (
                        <div key={a.id}>
                          {showDate && (
                            <div className="flex items-center gap-3 py-2.5 mt-3">
                              <div className="h-px flex-1 bg-white/[0.04]" />
                              <span className="text-[10px] font-bold text-[#4a5070] px-2 uppercase tracking-widest">
                                {new Date(a.createdAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                              <div className="h-px flex-1 bg-white/[0.04]" />
                            </div>
                          )}
                          <div className="card flex items-start gap-4 py-4" style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0"
                              style={{ background: `${meta.color}10`, border: `1px solid ${meta.color}15` }}>{meta.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#06070d] border border-white/[0.03] text-gray-400">{a.projectName}</span>
                              </div>
                              {a.details && <p className="text-xs mt-1 text-[#8b91b3]">{a.details}</p>}
                              <p className="text-[10px] font-semibold text-[#4a5070] mt-1.5">
                                {new Date(a.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                {" · "}{timeAgo(a.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ 6. ADMIN FEEDBACK PANEL ═══════════ */}
            {tab === "feedback" && user?.role === "Admin" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="font-extrabold text-lg text-white">User Feedback</h2>
                    <p className="text-xs text-[#8b91b3] mt-0.5">Reviews and suggestions submitted by platform users.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate("/admin/feedback")} className="btn-secondary text-xs py-1.5 px-3">
                      🔲 Full Page View
                    </button>
                    <button onClick={fetchAdminFeedbacks} className="btn-ghost text-xs py-1.5 px-3">
                      ↻ Refresh
                    </button>
                  </div>
                </div>

                <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                  {["all", "general", "bug", "feature", "usability"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFeedbackCatFilter(cat)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${
                        feedbackCatFilter === cat
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : "text-slate-400 border-transparent hover:border-slate-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {loadingAdminFeedbacks ? (
                  <div className="flex justify-center py-12">
                    <div className="w-6 h-6 border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                  </div>
                ) : adminFeedbacks.length === 0 ? (
                  <div className="card text-center py-16" style={{ background: "rgba(13,15,26,0.7)" }}>
                    <div className="text-5xl mb-4">💬</div>
                    <p className="text-sm font-extrabold text-white mb-1">No feedback logs found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {adminFeedbacks
                      .filter((f) => feedbackCatFilter === "all" || f.category.toLowerCase() === feedbackCatFilter.toLowerCase())
                      .map((f) => (
                        <div
                          key={f.id}
                          className="card p-4 space-y-2"
                          style={{ background: "rgba(13,15,26,0.7)", borderColor: "rgba(255,255,255,0.04)" }}
                        >
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                {f.category}
                              </span>
                              <span className="text-[11px] font-bold text-yellow-400">
                                {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}
                              </span>
                              <span className="text-[10px] text-[#8b91b3]">
                                by <span className="text-slate-300 font-bold">{f.userEmail}</span>
                              </span>
                            </div>
                            <span className="text-[10px] text-[#4a5070]">
                              {new Date(f.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200" style={{ whiteSpace: "pre-wrap" }}>
                            {f.content}
                          </p>
                        </div>
                      ))}
                  </div>
                )}

                {/* SMTP Diagnostics Panel */}
                <div className="card p-6 mt-8 space-y-4" style={{ background: "rgba(13,15,26,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                    <div>
                      <h3 className="font-extrabold text-sm text-white">Resend Email Diagnostics</h3>
                      <p className="text-[11px] text-[#8b91b3] mt-0.5">Diagnostic status check for transactional email delivery.</p>
                    </div>
                    <button onClick={fetchEmailStatus} disabled={loadingEmailStatus} className="btn-ghost text-xs py-1 px-3">
                      {loadingSmtpStatus ? "Refreshing..." : "↻ Verify Connection"}
                    </button>
                  </div>

                  {emailStatus ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                      <div className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Status</span>
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          {emailStatus.configured ? (
                            <>
                              <span className="text-emerald-400">✓ Connected</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            </>
                          ) : (
                            <span className="text-red-400">✗ Missing Config</span>
                          )}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] min-w-0">
                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Provider Endpoint</span>
                        <span className="text-xs font-mono text-white truncate block">{emailStatus.endpoint || "api.resend.com"}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] min-w-0">
                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Sender Email (From)</span>
                        <span className="text-xs font-mono text-white truncate block">{emailStatus.fromEmail || "-"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-[#8b91b3]">
                      Click "Verify Connection" to query Resend email status.
                    </div>
                  )}

                  <div className="border-t border-white/[0.04] pt-4">
                    <h4 className="font-extrabold text-xs text-white mb-2">Send System Diagnostics Email</h4>
                    <form onSubmit={handleSendTestEmail} className="flex gap-2 max-w-md">
                      <input
                        type="email"
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        placeholder="recipient@example.com"
                        className="input text-xs flex-1"
                        required
                        disabled={sendingTestEmail}
                      />
                      <button
                        type="submit"
                        disabled={sendingTestEmail || !testRecipient}
                        className="btn-primary text-xs font-bold py-2.5 px-4 shrink-0 disabled:opacity-40"
                      >
                        {sendingTestEmail ? "Sending..." : "Send Test Email"}
                      </button>
                    </form>
                    {testEmailResult && (
                      <p className="text-xs font-bold text-emerald-400 mt-2">✓ {testEmailResult}</p>
                    )}
                    {testEmailError && (
                      <p className="text-xs font-bold text-red-400 mt-2">⚠️ {testEmailError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* Floating Feedback Button */}
      <button
        onClick={() => setShowFeedbackModal(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105"
        style={{
          background: "linear-gradient(135deg, #8b5cf6, #4f7cff)",
          boxShadow: "0 6px 20px rgba(139, 92, 246, 0.4)"
        }}
      >
        <span>💬</span>
        <span className="text-xs">Feedback</span>
      </button>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md card p-6 animate-fade-in"
            style={{
              background: "rgba(13,15,26,0.92)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white">Share Your Feedback</h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-[#8b91b3] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-[#8b91b3]">Category</label>
                <select
                  value={feedbackCategory}
                  onChange={(e) => setFeedbackCategory(e.target.value)}
                  className="input w-full"
                  style={{ background: "#06070d" }}
                >
                  <option value="general">General Feedback</option>
                  <option value="bug">Report a Bug</option>
                  <option value="feature">Feature Request</option>
                  <option value="usability">Usability / Design</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-[#8b91b3]">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className="text-2xl transition-all"
                      style={{ color: star <= feedbackRating ? "#fbbf24" : "#1d2238" }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-[#8b91b3]">Message</label>
                <textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="Tell us what you think..."
                  className="input w-full h-32 py-2.5"
                  style={{ background: "#06070d", resize: "none" }}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="btn-secondary flex-1 text-xs py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="btn-primary flex-1 text-xs py-2.5"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #4f7cff)" }}
                >
                  {submittingFeedback ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProjectSetupWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={async (projectPath) => {
          await fetchAll();
          try {
            const r = await authFetch(`${API_BASE}/user/projects`);
            if (r.ok) {
              const d = await r.json();
              const projList = d.projects || [];
              const newProj = projList.find((p: any) => p.path === projectPath);
              if (newProj) {
                await fetchProjectMemory(newProj);
                setTab("projects");
              }
            }
          } catch {}
        }}
      />
    </div>
  );
}
