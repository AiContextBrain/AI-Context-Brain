import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";

interface ProjectSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (projectPath: string) => void;
}

const PLATFORMS = [
  { id: "web", label: "Web Application", icon: "🌐" },
  { id: "mobile", label: "Mobile App", icon: "📱" },
  { id: "desktop", label: "Desktop App", icon: "💻" }
];

const PRODUCT_TYPES = [
  { id: "saas", label: "SaaS Platform", desc: "Multi-tenant, billing, subscriptions, dashboard.", icon: "🚀" },
  { id: "restaurant", label: "Restaurant Automation", desc: "POS, orders, tables, kitchen display.", icon: "🍔" },
  { id: "stock", label: "Stock Tracking / Inventory", desc: "Warehouse, stock levels, suppliers, barcode support.", icon: "📦" },
  { id: "custom", label: "Custom App / Boilerplate", desc: "Start with a clean framework template.", icon: "🔧" }
];

const LANGUAGES = [
  { id: "typescript", label: "TypeScript / Next.js", icon: "🦕" },
  { id: "csharp", label: "C# / ASP.NET Core", icon: "🛡️" },
  { id: "python", label: "Python / FastAPI", icon: "🐍" },
  { id: "go", label: "Go / Gin", icon: "🐹" },
  { id: "rust", label: "Rust / Actix-Web", icon: "🦀" },
  { id: "swift", label: "Swift / iOS", icon: "🍎" },
  { id: "kotlin", label: "Kotlin / Android", icon: "🤖" },
  { id: "java", label: "Java / Spring Boot", icon: "☕" },
  { id: "cpp", label: "C++ / Native", icon: "⚙️" }
];

const DATABASES = [
  { id: "postgresql", label: "PostgreSQL", icon: "🐘" },
  { id: "mysql", label: "MySQL", icon: "🐬" },
  { id: "sqlite", label: "SQLite", icon: "🗃️" },
  { id: "sql server", label: "SQL Server", icon: "💾" },
  { id: "mongodb", label: "MongoDB", icon: "🍃" },
  { id: "none", label: "No Database", icon: "❌" }
];

const AUTHS = [
  { id: "jwt", label: "JWT Token Auth", icon: "🔑" },
  { id: "nextauth", label: "NextAuth / Auth.js", icon: "🛡️" },
  { id: "oauth", label: "Social OAuth (Google/GitHub)", icon: "🌐" },
  { id: "email verification", label: "Email Verification Flow", icon: "✉️" },
  { id: "password reset", label: "Password Reset Flow", icon: "🔄" },
  { id: "none", label: "No Auth System", icon: "❌" }
];

const DEPLOYMENTS = [
  { id: "docker", label: "Docker Containerization", icon: "🐳" },
  { id: "vercel", label: "Vercel Serverless Hosting", icon: "▲" },
  { id: "railway", label: "Railway", icon: "🚂" },
  { id: "render", label: "Render", icon: "☁️" },
  { id: "azure", label: "Microsoft Azure", icon: "🔷" },
  { id: "github actions", label: "GitHub Actions CI/CD", icon: "⚙️" },
  { id: "none", label: "No Pipeline", icon: "❌" }
];

const BILLINGS = [
  { id: "stripe", label: "Stripe", icon: "💳" },
  { id: "paddle", label: "Paddle", icon: "🏓" },
  { id: "lemonsqueezy", label: "Lemon Squeezy", icon: "🍋" },
  { id: "none", label: "No Payments Needed", icon: "❌" }
];

const AUTOMATIONS = [
  { id: "none", label: "None / No Automation", icon: "❌" },
  { id: "n8n", label: "n8n Workflow Automation", icon: "🤖" },
  { id: "zapier", label: "Zapier Integrations", icon: "⚡" },
  { id: "make", label: "Make / Integromat", icon: "🎨" },
  { id: "custom webhook system", label: "Custom Webhook Publisher", icon: "🔗" },
  { id: "background jobs / workers", label: "Background Jobs / Workers", icon: "⚙️" },
  { id: "i18n", label: "i18n / Localization Support", icon: "🌐" },
  { id: "yaml", label: "YAML Workflows / Config", icon: "📄" }
];

const LOCALES = [
  { id: "en", label: "English", icon: "🇬🇧" },
  { id: "tr", label: "Turkish", icon: "🇹🇷" },
  { id: "de", label: "German", icon: "🇩🇪" },
  { id: "fr", label: "French", icon: "🇫🇷" },
  { id: "es", label: "Spanish", icon: "🇪🇸" },
  { id: "it", label: "Italian", icon: "🇮🇹" },
  { id: "zh", label: "Chinese", icon: "🇨🇳" },
  { id: "ja", label: "Japanese", icon: "🇯🇵" },
  { id: "ru", label: "Russian", icon: "🇷🇺" },
  { id: "pt", label: "Portuguese", icon: "🇵🇹" }
];

const EDITORS = [
  { id: "cursor", label: "Cursor Rules", file: ".cursorrules" },
  { id: "claude", label: "Claude Code Rules", file: "CLAUDE.md" },
  { id: "copilot", label: "Copilot Rules", file: ".github/copilot-instructions.md" },
  { id: "windsurf", label: "Windsurf Rules", file: ".windsurf" }
];

const STRICTNESS_LEVELS = [
  { id: "basic", label: "Basic Guardrails", desc: "Essential security guidelines and folder structures." },
  { id: "strict", label: "Strict Compliance", desc: "Restricted file sizes, import rules, and naming casing conventions." },
  { id: "enterprise", label: "Enterprise Standard", desc: "Clean boundaries, architectural rules, test requirements, and full service separation." }
];

export default function ProjectSetupWizard({ isOpen, onClose, onSuccess }: ProjectSetupWizardProps) {
  const { authFetch } = useAuth();
  const { showAlert } = useAlert();

  const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";

  // Step state: 1 to 5, and 6 (Success Output Screen)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["web"]);
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>(["saas"]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["typescript"]);
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>(["postgresql"]);
  const [selectedAuths, setSelectedAuths] = useState<string[]>(["nextauth"]);
  const [selectedDeployments, setSelectedDeployments] = useState<string[]>(["vercel"]);
  const [selectedBillings, setSelectedBillings] = useState<string[]>(["stripe"]);
  const [selectedAutomations, setSelectedAutomations] = useState<string[]>(["none"]);
  const [selectedStrictnessLevels, setSelectedStrictnessLevels] = useState<string[]>(["strict"]);
  const [selectedLocales, setSelectedLocales] = useState<string[]>(["en"]);

  // Output previews
  const [previewFiles, setPreviewFiles] = useState<Record<string, string>>({});
  const [activePreviewTab, setActivePreviewTab] = useState("cursor");
  const [copied, setCopied] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState("");
  const [projectIdCopied, setProjectIdCopied] = useState(false);

  // Auto-generate project path based on name (used for final mapping reference)
  useEffect(() => {
    if (name && !projectPath) {
      const cleanName = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setProjectPath(`wizard-temp-fallback-${cleanName}`);
    }
  }, [name]);

  if (!isOpen) return null;

  const togglePlatform = (id: string) => {
    if (selectedPlatforms.includes(id)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(p => p !== id));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, id]);
    }
  };

  const toggleProductType = (id: string) => {
    if (selectedProductTypes.includes(id)) {
      if (selectedProductTypes.length > 1) {
        setSelectedProductTypes(selectedProductTypes.filter(p => p !== id));
      }
    } else {
      setSelectedProductTypes([...selectedProductTypes, id]);
    }
  };

  const toggleLanguage = (id: string) => {
    if (selectedLanguages.includes(id)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter(l => l !== id));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, id]);
    }
  };

  const toggleDatabase = (id: string) => {
    if (id === "none") {
      setSelectedDatabases(["none"]);
    } else {
      const filtered = selectedDatabases.filter(d => d !== "none");
      if (filtered.includes(id)) {
        if (filtered.length > 1) {
          setSelectedDatabases(filtered.filter(d => d !== id));
        } else {
          setSelectedDatabases(["none"]);
        }
      } else {
        setSelectedDatabases([...filtered, id]);
      }
    }
  };

  const toggleAuth = (id: string) => {
    if (id === "none") {
      setSelectedAuths(["none"]);
    } else {
      const filtered = selectedAuths.filter(a => a !== "none");
      if (filtered.includes(id)) {
        if (filtered.length > 1) {
          setSelectedAuths(filtered.filter(a => a !== id));
        } else {
          setSelectedAuths(["none"]);
        }
      } else {
        setSelectedAuths([...filtered, id]);
      }
    }
  };

  const toggleDeployment = (id: string) => {
    if (id === "none") {
      setSelectedDeployments(["none"]);
    } else {
      const filtered = selectedDeployments.filter(d => d !== "none");
      if (filtered.includes(id)) {
        if (filtered.length > 1) {
          setSelectedDeployments(filtered.filter(d => d !== id));
        } else {
          setSelectedDeployments(["none"]);
        }
      } else {
        setSelectedDeployments([...filtered, id]);
      }
    }
  };

  const toggleBilling = (id: string) => {
    if (id === "none") {
      setSelectedBillings(["none"]);
    } else {
      const filtered = selectedBillings.filter(b => b !== "none");
      if (filtered.includes(id)) {
        if (filtered.length > 1) {
          setSelectedBillings(filtered.filter(b => b !== id));
        } else {
          setSelectedBillings(["none"]);
        }
      } else {
        setSelectedBillings([...filtered, id]);
      }
    }
  };

  const toggleAutomation = (id: string) => {
    if (id === "none") {
      setSelectedAutomations(["none"]);
    } else {
      const filtered = selectedAutomations.filter(a => a !== "none");
      if (filtered.includes(id)) {
        if (filtered.length > 1) {
          setSelectedAutomations(filtered.filter(a => a !== id));
        } else {
          setSelectedAutomations(["none"]);
        }
      } else {
        setSelectedAutomations([...filtered, id]);
      }
    }
  };

  const toggleStrictness = (id: string) => {
    if (selectedStrictnessLevels.includes(id)) {
      if (selectedStrictnessLevels.length > 1) {
        setSelectedStrictnessLevels(selectedStrictnessLevels.filter(s => s !== id));
      }
    } else {
      setSelectedStrictnessLevels([...selectedStrictnessLevels, id]);
    }
  };

  const toggleLocale = (id: string) => {
    if (selectedLocales.includes(id)) {
      if (selectedLocales.length > 1) {
        setSelectedLocales(selectedLocales.filter(l => l !== id));
      }
    } else {
      setSelectedLocales([...selectedLocales, id]);
    }
  };

  // ── CLIENT-SIDE DETERMINISTIC BLUEPRINT GENERATOR (For instant interactive previews)
  const getDeterministicBlueprint = () => {
    const folders = ["src/app", "src/components", "src/lib", "src/services", "tests"];
    const packages = ["dotenv"];
    const setupCmds: string[] = [];

    const isTsOrJs = selectedLanguages.some(l => l.includes("typescript") || l.includes("javascript"));
    const isCSharp = selectedLanguages.some(l => l.includes("csharp") || l.includes("c#") || l.includes("dotnet"));
    const isPython = selectedLanguages.some(l => l.includes("python"));
    const isGo = selectedLanguages.some(l => l.includes("go"));
    const isRust = selectedLanguages.some(l => l.includes("rust"));
    const isJava = selectedLanguages.some(l => l.includes("java") || l.includes("kotlin"));
    const isSwift = selectedLanguages.some(l => l.includes("swift"));
    const isCpp = selectedLanguages.some(l => l.includes("cpp"));

    if (isTsOrJs) {
      packages.push("next", "react", "zod", "tailwind-merge");
      setupCmds.push("npm install", "npm run dev");
    }
    if (isCSharp) {
      folders.push("src/Domain", "src/Application", "src/Infrastructure", "src/WebApi");
      packages.push("Microsoft.EntityFrameworkCore", "MediatR", "AutoMapper");
      setupCmds.push("dotnet restore", "dotnet run --project src/WebApi");
    }
    if (isPython) {
      folders.push("src/routers", "src/models", "src/schemas");
      packages.push("fastapi", "uvicorn", "pydantic");
      setupCmds.push("pip install -r requirements.txt", "uvicorn src.main:app --reload");
    }
    if (isGo) {
      folders.push("src/handler", "src/repository", "src/domain");
      packages.push("github.com/gin-gonic/gin");
      setupCmds.push("go mod download", "go run src/main.go");
    }
    if (isRust) {
      folders.push("src/actors", "src/handlers", "src/models");
      packages.push("actix-web");
      setupCmds.push("cargo build", "cargo run");
    }
    if (isJava) {
      folders.push("src/main/java", "src/main/resources", "src/test/java");
      packages.push("spring-boot-starter-web");
    }
    if (isSwift) {
      folders.push("Sources", "Tests");
    }
    if (isCpp) {
      folders.push("src", "include");
    }

    if (selectedAuths.includes("nextauth")) {
      folders.push("src/app/api/auth/[...nextauth]");
      packages.push("next-auth");
    }
    if (selectedAuths.includes("jwt")) {
      folders.push("src/services/auth");
      if (isTsOrJs) packages.push("jsonwebtoken");
    }

    const hasDb = selectedDatabases.some(db => db !== "none" && db !== "");
    if (hasDb && isTsOrJs) {
      folders.push("src/lib/db");
      packages.push("@prisma/client", "prisma");
    }

    if (selectedBillings.includes("stripe")) {
      folders.push("src/services/billing", "src/app/api/webhooks/stripe");
      packages.push("stripe");
    }

    if (selectedAutomations.includes("n8n")) {
      folders.push("src/services/automation", "src/app/api/webhooks/n8n");
    }
    if (selectedAutomations.includes("custom webhook system")) {
      folders.push("src/services/webhooks", "src/app/api/webhooks/incoming");
    }
    if (selectedAutomations.some(a => a.includes("job") || a.includes("worker"))) {
      folders.push("src/workers", "src/services/jobs");
    }
    if (selectedAutomations.includes("i18n")) {
      folders.push("src/locales");
      const selectedL = selectedLocales.length > 0 ? selectedLocales : ["en"];
      selectedL.forEach(loc => {
        folders.push(`src/locales/${loc}`);
      });
      if (isTsOrJs) {
        packages.push("react-i18next", "i18next");
      }
    }
    if (selectedAutomations.includes("yaml") || selectedDeployments.includes("github actions")) {
      folders.push(".github/workflows");
    }

    const rules = [
      "- **Secrets Rule:** Never write passwords or hardcoded keys in code. Use .env files.",
      `- **Naming Standard:** Use standard Casing rules for ${selectedLanguages.join(", ")} files.`
    ];

    const hasStrict = selectedStrictnessLevels.includes("strict");
    const hasEnterprise = selectedStrictnessLevels.includes("enterprise");

    if (hasStrict || hasEnterprise) {
      rules.push("- **Size restriction:** Restrict files to 350 lines maximum.");
      rules.push("- **Type Safety:** Define exact typescript interfaces, do not use loose variables.");
    }
    if (hasEnterprise) {
      rules.push("- **Service Isolation:** Controllers must delegate business logic to decoupled services.");
      rules.push("- **Testing Constraint:** Every application service must have a corresponding Unit Test.");
    }
    if (selectedAutomations.some(a => a !== "none")) {
      rules.push("- **Webhook Idempotency:** Webhook handlers must perform retry safety and validation checks.");
    }
    if (selectedAutomations.includes("i18n")) {
      rules.push("- **No Hardcoded UI Text:** Avoid hardcoding strings directly in UI layouts. Always route through translation hooks (e.g., t('key')).");
      rules.push("- **Locales Structure:** Translation keys must be nested in JSON structures under src/locales/{locale}/.");
      rules.push("- **Locale Formatting:** Format date, currency and numbers using standard locale-aware utilities (e.g., Intl formatting).");
    }

    return {
      folders: [...new Set(folders)],
      packages: [...new Set(packages)],
      setupCmds,
      rules
    };
  };

  const blueprint = getDeterministicBlueprint();

  // ── GENERATE EDITOR CONFIGURATION FILE CONTENT DYNAMICALLY IN CLIENT
  const getRuleFileContents = (currentPath?: string) => {
    const bp = getDeterministicBlueprint();
    const projName = name || "Boilerplate Project";
    const pathVal = currentPath || projectPath || "virtual://projects/my-app";
    const overview = `## Project Info\n- **Project:** ${projName}\n- **Path:** ${pathVal}\n- **Platforms:** ${selectedPlatforms.join(", ")}\n- **Languages:** ${selectedLanguages.join(", ")}\n- **Databases:** ${selectedDatabases.join(", ")}\n- **Auths:** ${selectedAuths.join(", ")}\n- **Billings:** ${selectedBillings.join(", ")}\n- **Automations:** ${selectedAutomations.join(", ")}\n- **Strictness:** ${selectedStrictnessLevels.join(", ")}\n\n`;

    const folderMap = `## Generated Folder Structure\n${bp.folders.map(f => `- \`${f}/\``).join("\n")}\n\n`;
    const packageMap = `## Recommended Packages\n${bp.packages.map(p => `- \`${p}\``).join("\n")}\n\n`;
    const commandMap = `## Getting Started / Commands\n${bp.setupCmds.map(c => `- \`${c}\``).join("\n")}\n\n`;

    const rulesSection = `## Architecture Rules & Guardrails\n${bp.rules.join("\n")}\n\n`;

    const envSample = `## Recommended Environment Variables (.env)\n\`\`\`env\nDATABASE_URL="postgresql://user:pass@localhost:5432/db"\nNEXTAUTH_SECRET="your-jwt-auth-secret-here"\n` +
      (selectedBillings.includes("stripe") ? `STRIPE_API_KEY="sk_test_..."\nSTRIPE_WEBHOOK_SECRET="whsec_..."\n` : "") +
      (selectedAutomations.includes("n8n") ? `N8N_WEBHOOK_URL="https://n8n.yourdomain.com/..."\n` : "") +
      `\`\`\`\n`;

    const cursorContent = `---\ndescription: Cursor rules for ${projName}\nglobs: **/*\n---\n# ${projName} — Architecture Rules\n\n${overview}${rulesSection}${folderMap}${envSample}`;
    const claudeContent = `# CLAUDE.md — ${projName}\n\n${overview}${rulesSection}${folderMap}${commandMap}`;
    const copilotContent = `# Copilot Instructions — ${projName}\n\n${overview}${rulesSection}${packageMap}${commandMap}`;
    const windsurfContent = `# Windsurf Rules — ${projName}\n\n${overview}${rulesSection}${folderMap}${envSample}`;

    return {
      cursor: cursorContent,
      claude: claudeContent,
      copilot: copilotContent,
      windsurf: windsurfContent
    };
  };

  const handleCreateProject = async () => {
    if (!name.trim()) {
      showAlert("Name is required.", "error");
      return;
    }
    setLoading(true);

    try {
      // Step 1: Create project memory in backend using the new server-side wizard create
      const wizardRes = await authFetch(`${API_BASE}/project/wizard-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          projectPath: "", // Empty so server creates wizard-temp-
          platforms: selectedPlatforms,
          productTypes: selectedProductTypes,
          languages: selectedLanguages,
          databases: selectedDatabases,
          auths: selectedAuths,
          deployments: selectedDeployments,
          billings: selectedBillings,
          automations: selectedAutomations,
          strictnessLevels: selectedStrictnessLevels,
          locales: selectedLocales
        })
      });

      if (!wizardRes.ok) {
        const errorData = await wizardRes.json().catch(() => ({}));
        showAlert(errorData.message || "Failed to create wizard project.", "error");
        setLoading(false);
        return;
      }

      const wizardData = await wizardRes.json();
      const finalPath = wizardData.projectPath || `wizard-temp-${wizardData.projectId}`;
      setCreatedProjectId(wizardData.projectId || "");
      setProjectPath(finalPath);

      // Real context generation is deferred until the extension links and scans
      // the repository. Creating a blueprint must not consume AI usage.

      showAlert("Project blueprint created. Link your workspace to scan and generate real context.", "success");

      // Set file previews
      setPreviewFiles(getRuleFileContents(finalPath));
      setStep(6); // Go to outputs screen
    } catch (err) {
      showAlert("Network error during project setup.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRules = async () => {
    const text = previewFiles[activePreviewTab];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyProjectId = async () => {
    if (!createdProjectId) return;
    await navigator.clipboard.writeText(createdProjectId);
    setProjectIdCopied(true);
    setTimeout(() => setProjectIdCopied(false), 2000);
  };

  const handleFinish = () => {
    onSuccess(projectPath);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0d0f1a] border border-[#1d2035] rounded-3xl overflow-hidden shadow-2xl flex flex-col my-8" style={{ maxHeight: "85vh" }}>
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1d2035] flex items-center justify-between bg-slate-900/35">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="font-extrabold text-base text-white">Project Setup Wizard</h3>
              <p className="text-[10px] text-[#8b91b3] font-semibold">Start every project with architecture, rules and AI memory already prepared.</p>
            </div>
          </div>
          {step <= 5 && (
            <button onClick={onClose} className="text-[#8b91b3] hover:text-white font-bold text-sm bg-[#161929] px-3 py-1.5 rounded-lg border border-[#1d2035]">
              ✕ Cancel
            </button>
          )}
        </div>

        {/* Steps Progress (steps 1 to 5) */}
        {step <= 5 && (
          <div className="flex border-b border-[#1d2035] bg-slate-950/30 p-2 overflow-x-auto gap-2">
            {[
              { id: 1, label: "Basics" },
              { id: 2, label: "Tech Stack" },
              { id: 3, label: "Workflow" },
              { id: 4, label: "Guardrails" },
              { id: 5, label: "Preview" }
            ].map(s => (
              <div key={s.id} className="flex-1 min-w-[90px] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                   style={step === s.id
                     ? { background: "rgba(79,124,255,0.1)", color: "#7ba3ff", border: "1px solid rgba(79,124,255,0.2)" }
                     : step > s.id 
                     ? { color: "#10b981", border: "1px solid rgba(16,185,129,0.1)" }
                     : { color: "#4a5070", border: "1px solid transparent" }}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step > s.id ? "bg-emerald-500/20" : "bg-[#161929]"}`}>
                  {step > s.id ? "✓" : s.id}
                </span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 p-6 overflow-y-auto" style={{ minHeight: "350px" }}>
          
          {/* STEP 1: BASICS */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Awesome SaaS App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#111422] border border-[#1d2035] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#4f7cff] font-bold"
                />
              </div>

              {/* Target Platforms */}
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Target Platforms (Multi-select)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLATFORMS.map(p => {
                    const active = selectedPlatforms.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => togglePlatform(p.id)}
                              className="card-hover p-4 text-left flex items-center gap-3.5 transition-all"
                              style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                        <span className="text-xl">{p.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-white">{p.label}</p>
                          <p className="text-[9px] text-[#8b91b3] font-semibold">{active ? "Selected" : "Click to select"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product Types */}
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Product Domain & Template (Multi-select)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRODUCT_TYPES.map(p => {
                    const active = selectedProductTypes.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => toggleProductType(p.id)}
                              className="card-hover p-4 text-left flex gap-3 transition-all"
                              style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                        <span className="text-2xl mt-0.5">{p.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-white">{p.label}</p>
                          <p className="text-[10px] text-[#8b91b3] font-medium leading-relaxed mt-1">{p.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TECH STACK */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Languages */}
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Programming Languages & Frameworks (Multi-select)</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {LANGUAGES.map(l => {
                    const active = selectedLanguages.includes(l.id);
                    return (
                      <button key={l.id} onClick={() => toggleLanguage(l.id)}
                              className="card-hover p-3.5 text-center flex flex-col items-center gap-2 transition-all justify-center"
                              style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                        <span className="text-2xl">{l.icon}</span>
                        <span className="text-[10px] font-bold text-white">{l.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Database */}
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Database Engines (Multi-select)</label>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  {DATABASES.map(d => {
                    const active = selectedDatabases.includes(d.id);
                    return (
                      <button key={d.id} onClick={() => toggleDatabase(d.id)}
                              className="card-hover p-3.5 text-center flex flex-col items-center gap-2 transition-all justify-center"
                              style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                        <span className="text-2xl">{d.icon}</span>
                        <span className="text-[10px] font-bold text-white">{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Authentication */}
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Authentication Systems (Multi-select)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AUTHS.map(a => {
                    const active = selectedAuths.includes(a.id);
                    return (
                      <button key={a.id} onClick={() => toggleAuth(a.id)}
                              className="card-hover p-4 text-left flex items-center gap-3.5 transition-all"
                              style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                        <span className="text-xl">{a.icon}</span>
                        <span className="text-xs font-bold text-white">{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: WORKFLOWS & DEPLOY */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Billing */}
                <div className="space-y-2.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Payment Providers (Billing - Multi-select)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {BILLINGS.map(b => {
                      const active = selectedBillings.includes(b.id);
                      return (
                        <button key={b.id} onClick={() => toggleBilling(b.id)}
                                className="card-hover p-3.5 text-left flex items-center gap-3 transition-all"
                                style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                          <span className="text-xl">{b.icon}</span>
                          <span className="text-[10px] font-bold text-white">{b.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Deployment */}
                <div className="space-y-2.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Deployment Targets (Multi-select)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {DEPLOYMENTS.slice(0, 6).map(d => {
                      const active = selectedDeployments.includes(d.id);
                      return (
                        <button key={d.id} onClick={() => toggleDeployment(d.id)}
                                className="card-hover p-3.5 text-left flex items-center gap-3 transition-all"
                                style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                          <span className="text-xl">{d.icon}</span>
                          <span className="text-[10px] font-bold text-white">{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Automation */}
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Automation & Workflows (Optional - Multi-select)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AUTOMATIONS.map(a => {
                    const active = selectedAutomations.includes(a.id);
                    return (
                      <button key={a.id} onClick={() => toggleAutomation(a.id)}
                              className="card-hover p-4 text-left flex items-center gap-3 transition-all"
                              style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                        <span className="text-xl">{a.icon}</span>
                        <span className="text-xs font-bold text-white">{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* i18n Locales Selector */}
              {selectedAutomations.includes("i18n") && (
                <div className="space-y-2.5 p-4 rounded-2xl border border-dashed border-[#1d2035] bg-[#090b14] mt-4">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-400">Target Locales / Translation Directories (Select at least one)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-2">
                    {LOCALES.map(loc => {
                      const active = selectedLocales.includes(loc.id);
                      return (
                        <button key={loc.id} onClick={() => toggleLocale(loc.id)}
                                className="card-hover p-2.5 text-center flex flex-col items-center gap-1.5 transition-all justify-center"
                                style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                          <span className="text-xl">{loc.icon}</span>
                          <span className="text-[10px] font-bold text-white">{loc.label} ({loc.id})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: GUARDRAILS */}
          {step === 4 && (
            <div className="space-y-6">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3]">Strictness Levels & Architecture Rules (Multi-select)</label>
              
              <div className="space-y-4">
                {STRICTNESS_LEVELS.map(s => {
                  const active = selectedStrictnessLevels.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleStrictness(s.id)}
                            className="w-full card-hover p-5 text-left flex gap-4 transition-all"
                            style={active ? { borderColor: "rgba(79,124,255,0.45)", background: "rgba(79,124,255,0.03)" } : {}}>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${active ? "border-[#4f7cff] bg-[#4f7cff]/10" : "border-gray-700"}`}>
                        {active && <div className="w-2.5 h-2.5 rounded-full bg-[#4f7cff]" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{s.label}</p>
                        <p className="text-xs text-[#8b91b3] leading-relaxed mt-1">{s.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/[0.03] bg-[#06070d]/50 p-5 space-y-3.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Preview of Applied Strict Rules</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#8b91b3]">
                  {blueprint.rules.map(r => (
                    <div key={r} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.01] border border-white/[0.02]">
                      <span className="text-[#10b981]">✔</span>
                      <span className="leading-relaxed">{r.replace("- **", "").replace(":**", ":")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PREVIEW */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-dashed border-[#1d2035] bg-[#0d0f1a]/20 p-5 text-center">
                <span className="text-4xl">🔮</span>
                <h4 className="font-extrabold text-sm text-white mt-3.5">Deterministic Project Blueprint Verified</h4>
                <p className="text-xs text-[#8b91b3] mt-1.5 leading-relaxed">
                  The folder scaffold and project rules have been built server-side. Review them before creating the workspace in VS Code.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Folder tree */}
                <div className="card p-4 space-y-3 bg-[#06070d]/50 border-white/[0.03]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#8b91b3]">Folder Structure Blueprint</p>
                  <div className="font-mono text-[11px] leading-6 max-h-48 overflow-y-auto p-3 bg-black/40 rounded-xl text-indigo-200">
                    {blueprint.folders.map(f => (
                      <div key={f} className="truncate">
                        📁 {f}/
                      </div>
                    ))}
                  </div>
                </div>

                {/* Packages & commands */}
                <div className="card p-4 space-y-3 bg-[#06070d]/50 border-white/[0.03] flex flex-col">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#8b91b3]">Recommended Packages</p>
                  <div className="flex-1 max-h-48 overflow-y-auto p-3 bg-black/40 rounded-xl">
                    <div className="flex flex-wrap gap-2">
                      {blueprint.packages.map(p => (
                        <span key={p} className="badge-blue text-[9px] font-bold py-0.5">{p}</span>
                      ))}
                    </div>
                    
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#8b91b3] mt-4 mb-2">Startup Commands</p>
                    <div className="font-mono text-[11px] text-gray-400">
                      {blueprint.setupCmds.map(c => <div key={c}>$ {c}</div>)}
                    </div>
                  </div>
                </div>

              </div>

              {/* No AI notice */}
              <div className="rounded-xl border border-[#4f7cff]/20 bg-[#4f7cff]/[0.02] p-4 flex gap-3 text-xs leading-relaxed">
                <span className="text-lg">💡</span>
                <div>
                  <strong className="text-white">Purely Deterministic Flow:</strong> The folder scaffold and rule files are generated without consuming AI request limits.
                  You can opt-in to polish it with AI using the "AI Enhance / Polish" button later.
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: OUTPUT FILE VIEW (SUCCESS VIEW) */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
                <p className="text-sm font-black text-white">Connect this blueprint to VS Code</p>
                <p className="mt-1 text-xs leading-5 text-[#8b91b3]">
                  Open the folder you want to use, then connect it in one click. The extension will create the folder scaffold, scan it, generate context, and export the IDE files automatically.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={`vscode://ai-project-brain.ai-project-brain/initialize?projectId=${encodeURIComponent(createdProjectId)}`}
                    className="btn-primary px-4 py-2 text-center text-xs font-bold"
                  >
                    Open in VS Code
                  </a>
                  <button onClick={handleCopyProjectId} className="btn-secondary px-4 py-2 text-xs font-bold">
                    {projectIdCopied ? "Copied" : "Copy Project ID"}
                  </button>
                </div>
                <p className="mt-3 text-[10px] text-[#606783]">Project ID: <code className="select-all">{createdProjectId}</code></p>
              </div>
              <div className="text-center py-4">
                <span className="text-5xl">🎉</span>
                <h4 className="font-black text-lg text-white mt-4">Folder Scaffold & AI Memory Prepared!</h4>
                <p className="text-xs text-[#8b91b3] leading-relaxed mt-1">
                  Your project blueprint is registered. The extension creates the folders and writes the context files after connecting the workspace.
                </p>
              </div>

              {/* Config Files Copy Panel */}
              <div className="card border-[#1d2035] bg-[#0d0f1a] flex flex-col h-96">
                
                {/* File tab selector */}
                <div className="flex border-b border-[#1d2035] bg-slate-950/45 p-1">
                  {EDITORS.map(e => (
                    <button key={e.id} onClick={() => { setActivePreviewTab(e.id); setCopied(false); }}
                            className="flex-1 py-2 text-[10px] font-black rounded-lg transition-all text-center px-1.5"
                            style={activePreviewTab === e.id
                              ? { background: "linear-gradient(135deg,#4f7cff,#6366f1)", color: "#fff" }
                              : { color: "#4a5070" }}>
                      {e.label} ({e.file})
                    </button>
                  ))}
                </div>

                {/* Editor Rules Preview Area */}
                <div className="flex-1 font-mono text-[11px] p-4 bg-black/45 overflow-y-auto leading-relaxed text-indigo-100">
                  <pre className="whitespace-pre-wrap">{previewFiles[activePreviewTab]}</pre>
                </div>

                {/* Copy Button bar */}
                <div className="px-4 py-3.5 border-t border-[#1d2035] bg-slate-900/10 flex items-center justify-between">
                  <span className="text-[10px] text-[#8b91b3] font-semibold">Preview target: <strong>{EDITORS.find(e => e.id === activePreviewTab)?.file}</strong></span>
                  <button onClick={handleCopyRules}
                          className={`${copied ? "btn-success" : "btn-primary"} text-[11px] py-1.5 px-4 font-bold rounded-lg cursor-pointer shrink-0`}>
                    {copied ? "Copied" : "Copy to Clipboard"}
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#1d2035] flex items-center justify-between bg-slate-900/35">
          {step <= 5 ? (
            <>
              {step > 1 ? (
                <button onClick={() => setStep(step - 1)} className="btn-secondary text-xs font-bold py-2 px-5 cursor-pointer">
                  ← Previous
                </button>
              ) : (
                <div />
              )}
              
              {step < 5 ? (
                <button
                  disabled={step === 1 && !name.trim()}
                  onClick={() => setStep(step + 1)}
                  className="btn-primary text-xs font-bold py-2 px-5 cursor-pointer disabled:opacity-40"
                >
                  Next →
                </button>
              ) : (
                <button
                  disabled={loading}
                  onClick={handleCreateProject}
                  className="btn-success text-xs font-bold py-2 px-5 cursor-pointer"
                >
                  {loading ? "Generating Project..." : "Launch Project ✓"}
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-[10px] text-[#4a5070] font-black">All blueprint configurations successfully loaded.</span>
              <button onClick={handleFinish} className="btn-primary text-xs font-bold py-2 px-6 cursor-pointer">
                Done & Finish
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
