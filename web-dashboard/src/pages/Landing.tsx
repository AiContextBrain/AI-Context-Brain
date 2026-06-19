import { useState } from "react";
import { Link } from "react-router-dom";
import { useSEO } from "../hooks/useSEO";
import { trackEvent } from "../utils/analytics";
import { generateRules } from "../utils/rulesTemplates";

export default function Landing() {
  useSEO({
    title: "AI Context Brain - Codebase Context Sync & Real-Time Architecture Guard",
    description: "AI Context Brain dynamically maps project frameworks, structures project memory, filters files recursively with .brainignore, and synchronizes custom architectural constraints directly with Cursor, Windsurf, VS Code, Claude Code, and Aider in real-time.",
    canonicalUrl: "https://aicontextbrain.me/",
    keywords: "AI context memory, codebase context sync, .cursorrules, .windsurfrules, Claude.md, developer tools, VS Code extension, architecture guard, incremental code scanning",
  });

  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const [selectedFramework, setSelectedFramework] = useState("nextjs");
  const [selectedStyling, setSelectedStyling] = useState("tailwind");
  const [selectedTarget, setSelectedTarget] = useState("cursor");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = generateRules({
      framework: selectedFramework,
      styling: selectedStyling,
      target: selectedTarget,
    });
    navigator.clipboard.writeText(text);
    setCopied(true);
    trackEvent("rules_copy_click", { framework: selectedFramework, styling: selectedStyling, target: selectedTarget });
    setTimeout(() => setCopied(false), 2000);
  };

  const productFilmUrl = "/videos/ads-film.mp4";
  const productDemoUrl = "/videos/demo-aicontextbrain.mp4";
  const formatPrice = (value: number) => Number.isInteger(value) ? value.toString() : value.toFixed(2);
  const demoSteps = [
    {
      title: "Repository Scan",
      detail: "Local VS Code scan detects frameworks, services, routes, DTOs, rules, exports, and plan gates without sending a raw repository dump.",
      signal: "Scan complete: ASP.NET Core, React, PostgreSQL, JWT, Paddle, Resend"
    },
    {
      title: "Context Generation",
      detail: "The backend turns scanned metadata into optimized project memory with route maps, service graph, database summary, and editing risks.",
      signal: ".ai-context.md + AI_INSTRUCTIONS.md generated"
    },
    {
      title: "Explain",
      detail: "AI Explain uses selected code, surrounding lines, and saved project memory so the answer is grounded in the actual codebase.",
      signal: "Pro/Team gated, AI usage counted server-side"
    },
    {
      title: "Export",
      detail: "Assistant-specific exports are written for Cursor, Claude Code, Copilot, Windsurf, Aider, and generic markdown workflows.",
      signal: "Rules exported to IDE-specific targets"
    },
    {
      title: "Dashboard",
      detail: "Project memories, team workspace, integrations, context sources, history, and plan state stay visible in the web dashboard.",
      signal: "Shared memory and project status visible"
    },
    {
      title: "Usage Statistics",
      detail: "Plan capacity, context refreshes, AI requests, and subscription state are enforced by the backend and surfaced in the UI.",
      signal: "Usage shown as current plan capacity"
    }
  ];
  
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-white font-sans antialiased selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* ── Announcement Banner ────────────────────────────────── */}
      <div className="bg-[#0b0714] border-b border-purple-500/10 py-2.5 px-4 text-center text-xs font-semibold tracking-wide text-purple-200 flex items-center justify-center gap-2">
        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-black uppercase tracking-wider">Public Beta</span>
        <span>AI Context Brain is currently in Public Beta. Some features may evolve and minor bugs may exist. We actively improve the product based on user feedback.</span>
      </div>

      {/* ── Navigation Header ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#06070a]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-xs font-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]">AI</div>
            <span className="text-sm font-bold tracking-tight text-white">AI Context Brain</span>
            <span className="text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/25 ml-1.5">BETA</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection("problem")} className="text-xs font-semibold text-[#8e939e] hover:text-white transition-colors">
              The Problem
            </button>
            <button onClick={() => scrollToSection("how-it-works")} className="text-xs font-semibold text-[#8e939e] hover:text-white transition-colors">
              Workflow
            </button>
            <button onClick={() => scrollToSection("features")} className="text-xs font-semibold text-[#8e939e] hover:text-white transition-colors">
              Features
            </button>
            <button onClick={() => { scrollToSection("pricing"); trackEvent("pricing_click", { location: "nav_header" }); }} className="text-xs font-semibold text-[#8e939e] hover:text-white transition-colors">
              Pricing
            </button>
            <a href="https://github.com/AiContextBrain/AI-Context-Brain" target="_blank" rel="noreferrer" onClick={() => trackEvent("github_click", { location: "nav_header" })} className="text-xs font-semibold text-[#8e939e] hover:text-white transition-colors">
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/login" onClick={() => trackEvent("sign_up_click", { action: "sign_in", location: "nav_header" })} className="text-xs font-semibold text-[#8e939e] hover:text-white transition-colors">
              Sign In
            </Link>
            <Link to="/login" onClick={() => trackEvent("sign_up_click", { action: "start_free", location: "nav_header" })} className="bg-white hover:bg-gray-100 text-black text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-[0_1px_2px_rgba(255,255,255,0.1)]">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-16 lg:pt-32 lg:pb-24 border-b border-white/[0.05]">
        {/* Subtle glow background */}
        <div className="absolute top-[-10%] left-[50%] -translate-x-[50%] w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
            
            {/* Hero Copy */}
            <div className="space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/25 bg-purple-500/5 text-xs font-bold text-purple-300">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Public Beta Active
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
                Not another AI explanation. Architecture-aware project understanding.
              </h1>
              <p className="text-base sm:text-lg text-[#8e939e] leading-relaxed max-w-xl">
                Minimal AI Cost. Maximum Project Understanding. AI Context Brain uses intelligent retrieval and project memory instead of repeatedly consuming expensive AI tokens.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link to="/login" onClick={() => trackEvent("sign_up_click", { action: "start_free", location: "hero" })} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-3.5 rounded-lg text-center transition-all shadow-[0_2px_10px_rgba(37,99,235,0.2)]">
                  Start Free
                </Link>
                <button onClick={() => { scrollToSection("product-demo"); trackEvent("watch_demo_click", { location: "hero" }); }} className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-6 py-3.5 rounded-lg text-center border border-white/10 transition-all">
                  Watch Demo
                </button>
              </div>

              {/* Supported Platforms Badges */}
              <div className="pt-6 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#4d515a]">Optimized exports for</p>
                <div className="flex flex-wrap gap-2">
                  {["VS Code Extension", "Cursor", "Claude Code", "GitHub Copilot", "Windsurf"].map((tag) => (
                    <span key={tag} className="px-2.5 py-1 text-[10px] font-semibold bg-white/[0.03] border border-white/[0.05] rounded-md text-[#c4c9d4]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cinematic teaser video */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0b0c10] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="border-b border-white/[0.06] bg-[#08090d] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-[11px] font-mono text-[#8e939e]">product-film.mp4</span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-blue-300 bg-blue-400/10 px-1.5 py-0.5 rounded">Cinematic Teaser</span>
              </div>
              <video
                className="block w-full aspect-video bg-black object-cover"
                src={productFilmUrl}
                controls
                muted
                playsInline
                preload="metadata"
                aria-label="AI Context Brain cinematic product film"
              />
              <div className="grid grid-cols-3 border-t border-white/[0.06] bg-[#08090d] text-center divide-x divide-white/[0.06]">
                {[
                  ["Film", "Excitement"],
                  ["Workflow", "Trust"],
                  ["Memory", "Outcome"],
                ].map(([val, label]) => (
                  <div key={label} className="py-3">
                    <p className="text-sm font-black text-white">{val}</p>
                    <p className="text-[8px] uppercase tracking-widest text-[#585c67] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Interactive Rules Generator Section ────────────────── */}
      <section id="rules-generator" className="py-20 lg:py-28 border-b border-white/[0.05] bg-[#06070a] relative overflow-hidden">
        {/* Glows */}
        <div className="absolute top-[30%] left-[-10%] w-[350px] h-[350px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[30%] right-[-10%] w-[350px] h-[350px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Interactive Tools
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Free AI Rules Generator (.cursorrules, CLAUDE.md)
            </h2>
            <p className="text-sm sm:text-base text-[#8e939e] max-w-xl mx-auto leading-relaxed">
              Instantly create custom configuration rules for your favorite AI coding assistant. Choose your stack below.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-stretch">
            {/* Left Side: Selections */}
            <div className="space-y-6 flex flex-col justify-between">
              {/* Target IDE */}
              <div className="space-y-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#4d515a]">1. Target Assistant</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "cursor", name: "Cursor (.cursorrules)" },
                    { id: "claude", name: "Claude Code (CLAUDE.md)" },
                    { id: "windsurf", name: "Windsurf (.windsurfrules)" },
                    { id: "copilot", name: "Copilot (copilot-instructions.md)" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTarget(t.id); trackEvent("generator_select_target", { target: t.id }); }}
                      className={`px-3 py-2.5 rounded-lg text-xs font-semibold text-left border transition-all ${
                        selectedTarget === t.id
                          ? "bg-blue-600/10 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                          : "bg-white/[0.02] border-white/[0.05] text-gray-400 hover:border-white/[0.1] hover:text-white"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Framework */}
              <div className="space-y-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#4d515a]">2. Project Framework</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    { id: "nextjs", name: "React / Next.js", desc: "App Router & TS" },
                    { id: "express", name: "Node / Express", desc: "MVC API & ES Modules" },
                    { id: "dotnet", name: "ASP.NET Core", desc: "C# Clean Architecture" },
                    { id: "fastapi", name: "Python / FastAPI", desc: "Pydantic v2 & Async" },
                    { id: "go", name: "Go", desc: "Standard cmd/internal layout" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setSelectedFramework(f.id); trackEvent("generator_select_framework", { framework: f.id }); }}
                      className={`p-3 rounded-lg text-left border transition-all flex flex-col justify-between ${
                        selectedFramework === f.id
                          ? "bg-blue-600/10 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                          : "bg-white/[0.02] border-white/[0.05] text-gray-400 hover:border-white/[0.1] hover:text-white"
                      }`}
                    >
                      <span className="text-xs font-bold">{f.name}</span>
                      <span className="text-[10px] text-gray-500 mt-1">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Styling */}
              <div className="space-y-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#4d515a]">3. Styling Library</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "tailwind", name: "TailwindCSS", desc: "Utility-first css rules" },
                    { id: "modules", name: "CSS Modules", desc: "Isolated modular sheets" },
                    { id: "bootstrap", name: "Bootstrap", desc: "Standard grid helper classes" },
                    { id: "css", name: "Vanilla CSS", desc: "Custom properties & BEM" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedStyling(s.id); trackEvent("generator_select_styling", { styling: s.id }); }}
                      className={`p-3 rounded-lg text-left border transition-all flex flex-col justify-between ${
                        selectedStyling === s.id
                          ? "bg-blue-600/10 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                          : "bg-white/[0.02] border-white/[0.05] text-gray-400 hover:border-white/[0.1] hover:text-white"
                      }`}
                    >
                      <span className="text-xs font-bold">{s.name}</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side: Code Preview Box */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0b0c10] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-between text-left">
              <div className="border-b border-white/[0.06] bg-[#08090d] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-[11px] font-mono text-[#8e939e]">
                  {selectedTarget === "cursor" ? ".cursorrules" : selectedTarget === "claude" ? "CLAUDE.md" : selectedTarget === "windsurf" ? ".windsurfrules" : ".github/copilot-instructions.md"}
                </span>
                <button
                  onClick={handleCopy}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-all ${
                    copied
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse"
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  }`}
                >
                  {copied ? "Copied! ✓" : "Copy Rules"}
                </button>
              </div>

              {/* Text Area Code Display */}
              <div className="p-4 bg-black/40 font-mono text-[11px] leading-relaxed text-[#c4c9d4] overflow-y-auto h-[350px]">
                <pre className="whitespace-pre-wrap">
                  {generateRules({
                    framework: selectedFramework,
                    styling: selectedStyling,
                    target: selectedTarget,
                  })}
                </pre>
              </div>

              {/* Conversion Footer */}
              <div className="p-4 border-t border-white/[0.06] bg-[#08090d] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left space-y-1">
                  <p className="text-xs font-bold text-white">Automate your codebase memory</p>
                  <p className="text-[10px] text-gray-500">Sync framework structures and custom rule guardrails dynamically.</p>
                </div>
                <Link
                  to="/login"
                  onClick={() => trackEvent("generator_cta_click", { action: "start_free" })}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-4 py-2.5 rounded-lg text-center transition-all shadow-[0_2px_8px_rgba(37,99,235,0.15)] whitespace-nowrap"
                >
                  Install Extension Free
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Context Problem Section ───────────────────────── */}
      <section id="product-demo" className="py-20 lg:py-28 border-b border-white/[0.05] bg-[#08090d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">Real Product Workflow</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">The actual path from repository to AI-ready memory.</h3>
            <p className="text-sm sm:text-base text-[#8e939e] max-w-2xl mx-auto leading-relaxed">
              The film above builds energy. This section shows the real product flow users should expect inside the extension, backend, and dashboard.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-12 items-stretch">
            <div className="rounded-xl border border-white/[0.08] bg-[#0b0c10] overflow-hidden text-left">
              <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between bg-[#08090d]">
                <span className="text-[11px] font-mono text-[#8e939e]">real-product-demo.mp4</span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-300 bg-emerald-400/10 px-1.5 py-0.5 rounded">Recorded Workflow</span>
              </div>
              <video
                className="block w-full aspect-video bg-black object-contain"
                src={productDemoUrl}
                controls
                playsInline
                preload="metadata"
                aria-label="AI Context Brain real product demo"
              />
              <div className="p-5 sm:p-6 space-y-4 border-t border-white/[0.06]">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.04] p-4 font-mono text-[11px] leading-6 text-[#c4c9d4]">
                  <p><span className="text-blue-300">scan</span> repository signals in VS Code</p>
                  <p><span className="text-blue-300">generate</span> project memory and AI instructions</p>
                  <p><span className="text-blue-300">export</span> assistant-specific context files</p>
                  <p><span className="text-blue-300">review</span> dashboard usage and integrations</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["500", "Refreshes"],
                    ["100", "AI Requests"],
                    ["32k", "Context Cap"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                      <p className="text-lg font-black text-white">{value}</p>
                      <p className="mt-1 text-[8px] uppercase tracking-wider text-[#70758a]">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-left">
              {demoSteps.map((step, index) => (
                <div key={step.title} className="rounded-xl border border-white/[0.06] bg-[#0b0c10] p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-white">{step.title}</h4>
                    <span className="text-[10px] font-black text-blue-300 bg-blue-400/10 border border-blue-400/20 rounded-md px-2 py-0.5">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-xs leading-6 text-[#8e939e]">{step.detail}</p>
                  <p className="text-[11px] leading-5 text-emerald-300/90 border-t border-white/[0.05] pt-3">{step.signal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="py-20 lg:py-28 border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">The Context Problem</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">AI coding breaks when context disappears.</h3>
            <p className="text-sm sm:text-base text-[#8e939e] max-w-xl mx-auto leading-relaxed">
              Every software project grows beyond a single prompt. When context windows fill up or models restart, AI coding tools lose critical context.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Before Card */}
            <div className="p-6 rounded-xl border border-red-500/10 bg-[#0b0c10] space-y-4 text-left flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-red-400 bg-red-400/10 px-2 py-0.5 rounded">Without Project Memory</span>
                <h4 className="text-lg font-bold text-white mt-2">Traditional AI Prompting</h4>
                <p className="text-xs text-[#8e939e] leading-relaxed">
                  You spend valuable time copy-pasting code slices, re-explaining architecture directories, warning the AI not to use legacy methods, and reviewing garbage boilerplate generated because the model forgot your conventions.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-red-400/90 border-t border-white/[0.03] pt-4">
                <li className="flex items-center gap-2">x Forgets architecture rules after 3-4 prompts</li>
                <li className="flex items-center gap-2">x Misunderstands folder conventions and structures</li>
                <li className="flex items-center gap-2">x Generates inconsistent code drifting from your codebase</li>
                <li className="flex items-center gap-2">x Wastes context budget sending massive raw file trees</li>
              </ul>
            </div>

            {/* After Card */}
            <div className="p-6 rounded-xl border border-emerald-500/25 bg-[#0b0c10] space-y-4 text-left flex flex-col justify-between shadow-[0_4px_30px_rgba(16,185,129,0.02)]">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">With AI Context Brain</span>
                <h4 className="text-lg font-bold text-white mt-2">Living Project Memory</h4>
                <p className="text-xs text-[#8e939e] leading-relaxed">
                  A persistent context adapter analyzes your codebase, creates highly compressed memory files, and feeds structured guidelines directly to your assistant. Your AI starts coding with full context already established.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-emerald-400/90 border-t border-white/[0.03] pt-4">
                <li className="flex items-center gap-2">OK Permanent rules for folder structure and imports</li>
                <li className="flex items-center gap-2">OK Dynamic context updating via background file watchers</li>
                <li className="flex items-center gap-2">OK Generates optimized context and rule files for Cursor, Claude Code, GitHub Copilot, and Windsurf</li>
                <li className="flex items-center gap-2">OK Compact compression targeting high-signal data</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Living Project Memory Section ─────────────────────── */}
      <section className="py-20 lg:py-28 border-b border-white/[0.05] bg-[#08090d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Visual adaptor representation */}
            <div className="relative p-6 rounded-xl border border-white/[0.08] bg-[#0b0c10] text-left space-y-4">
              <h4 className="text-xs font-mono text-blue-400">Context Pipeline</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/[0.03]">
                  <span className="text-xs text-gray-300">Local Repository Code</span>
                  <span className="text-[9px] uppercase font-bold text-gray-500">Inputs</span>
                </div>
                <div className="flex items-center justify-center py-2 text-lg text-blue-500 animate-pulse">↓</div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <span className="text-xs text-blue-300 font-bold">AI Context Brain Optimizer</span>
                  <span className="text-[9px] uppercase font-bold text-blue-400">Compression Engine</span>
                </div>
                <div className="flex items-center justify-center py-2 text-lg text-emerald-500 animate-pulse">↓</div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-emerald-300 font-bold">Cursor, Claude Code, Copilot, Windsurf Rules</span>
                  <span className="text-[9px] uppercase font-bold text-emerald-400">Target Adapters</span>
                </div>
              </div>
            </div>

            {/* Living Memory Details */}
            <div className="space-y-6 text-left">
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">Living Project Memory</h2>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">Continuously maintain your project's shape.</h3>
              <p className="text-sm sm:text-base text-[#8e939e] leading-relaxed">
                This is not a static list. AI Context Brain works as an active adapter, keeping track of changes, dependency mutations, naming violations, and architecture directions. When your system evolves, your AI instructions adapt instantly.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-[#c4c9d4] pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Not a one-time prompt
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Not a static template
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Project-specific rules
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Dashboard controls
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── How It Works Section ──────────────────────────────── */}
      <section id="how-it-works" className="py-20 lg:py-28 border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">Simple Workflow</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">How it works</h3>
            <p className="text-sm sm:text-base text-[#8e939e] max-w-xl mx-auto leading-relaxed">
              Integrate AI Context Brain into your local development routine in 4 simple steps.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {[
              { step: "01", title: "Scan Project", desc: "Our VS Code extension scans repository directories, configs, and patterns locally to capture dependencies and architecture facts." },
              { step: "02", title: "Build Context", desc: "The extension uploads metadata to generate a compressed 12-section .ai-context.md, eliminating metadata noise." },
              { step: "03", title: "Export Intelligence", desc: "Export rulesets custom-tailored for Cursor (.cursor/rules/), Claude Code (CLAUDE.md), GitHub Copilot, or Windsurf." },
              { step: "04", title: "Develop Faster", desc: "Write code with your AI coding tool. The assistant uses the generated guidelines to produce more consistent, context-aware code." },
            ].map((item) => (
              <div key={item.step} className="p-5 rounded-xl border border-white/[0.05] bg-[#0b0c10] space-y-4 hover:border-white/[0.1] transition-all group">
                <span className="text-xs font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded group-hover:bg-blue-500 group-hover:text-white transition-all">{item.step}</span>
                <h4 className="text-base font-bold text-white">{item.title}</h4>
                <p className="text-xs text-[#8e939e] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Grouping Section ───────────────────────────── */}
      <section id="features" className="py-20 lg:py-28 border-b border-white/[0.05] bg-[#08090d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">Product Capability</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">Full-spectrum context control</h3>
            <p className="text-sm sm:text-base text-[#8e939e] max-w-xl mx-auto leading-relaxed">
              We group context optimization into specific capabilities to ensure your AI gets clean, relevant data.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {[
              {
                group: "Context Intelligence",
                promise: "Read repository patterns directly.",
                items: ["Project Scanning", "Framework Detection", "Dependency Analysis", "Metadata Generation"],
              },
              {
                group: "Context Optimization",
                promise: "Compress raw file trees into rules.",
                items: ["Compression", "Context Reduction", "AI Instructions", "Incremental Updates"],
              },
              {
                group: "Project Memory",
                promise: "Restore previous structures over time.",
                items: ["Context History", "Diff Tracking", "Restore History"],
              },
              {
                group: "Architecture Intelligence",
                promise: "Guard constraints and rule sets.",
                items: ["Architecture Guard", "Naming Rules", "Import Rules", "Folder Rules"],
              },
              {
                group: "Integrations",
                promise: "Export clean files to your preferred editor.",
                items: ["Cursor rules", "Claude Code", "GitHub Copilot", "Windsurf rules"],
              },
            ].map((g) => (
              <div key={g.group} className="p-6 rounded-xl border border-white/[0.05] bg-[#0a0b10] space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white">{g.group}</h4>
                  <p className="text-[11px] text-gray-500 mt-1">{g.promise}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {g.items.map((item) => (
                    <span key={item} className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-[10px] text-gray-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built for Real Codebases (Developer Trust) ─────────── */}
      <section className="py-20 lg:py-28 border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">Developer Trust</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">Built for real codebases.</h3>
            <p className="text-sm sm:text-base text-[#8e939e] max-w-xl mx-auto leading-relaxed">
              We design features that respect developer realities, keeping your source code safe, incremental, and highly structured.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {[
              { title: "Incremental Scanning", desc: "No massive rescans. We track file hashes locally via SHA-256 and scan only changed files." },
              { title: "Architecture Validation", desc: "Ensure AI rules match your target directory architectures before exporting files." },
              { title: "IDE Integrations", desc: "Runs directly where you write code. Access rulesets via our lightweight VS Code extension." },
              { title: "Auto-Sync", desc: "A built-in background watcher tracks modifications and synchronizes memory in real-time." },
              { title: "Zero Source Exposure", desc: "Only codebase structures, metadata metrics, and dependencies are analyzed. Your core intellectual property remains private." },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-white/[0.05] bg-[#0b0c10] space-y-2">
                <h4 className="text-sm font-bold text-white">{f.title}</h4>
                <p className="text-xs text-[#8e939e] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Typical Developer Workflows Section ────────────────── */}
      <section className="py-20 lg:py-28 border-b border-white/[0.05] bg-[#08090d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">Typical Developer Workflows</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">How codebase memory optimizes development</h3>
            <p className="text-sm sm:text-base text-[#8e939e] max-w-xl mx-auto leading-relaxed">
              Understand how developers use optimized project memory adapters to maintain context and code faster.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              { title: "Context Handover to Cursor", desc: "Automatically sets up rules and project memory in .cursor/rules/ to avoid manual copying and pasting of workspace files.", target: "Cursor Integration" },
              { title: "Guarding Architecture Boundaries", desc: "Enforces custom boundary rules inside Claude Code to ensure generated code doesn't leak imports across modules.", target: "Claude Code Integration" },
              { title: "Team Coding Guidelines", desc: "Share rules and conventions globally with team members to ensure all developer assistants code under the same standards.", target: "Team Collaboration" },
            ].map((t, idx) => (
              <div key={idx} className="p-5 rounded-xl border border-white/[0.05] bg-[#0a0b10] flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white">{t.title}</h4>
                  <p className="text-xs text-[#8e939e] leading-relaxed">{t.desc}</p>
                </div>
                <div className="border-t border-white/[0.03] pt-3 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-blue-400">{t.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Context Quality & Readiness Showcase Section ────────────────── */}
      <section className="py-20 lg:py-28 border-b border-white/[0.05] bg-[#06070a] relative overflow-hidden">
        <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Visual AI Context Quality Card */}
            <div className="p-6 rounded-xl border border-blue-500/10 bg-[#0b0c10] text-left space-y-6 shadow-[0_4px_30px_rgba(59,130,246,0.01)]">
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Sample Context Quality Report</h4>
                <span className="text-2xl font-black text-white">92<span className="text-xs font-normal text-gray-500">/100</span></span>
              </div>
              
              <div className="space-y-4">
                {[
                  ["Framework Detection", 100, "emerald"],
                  ["Architecture Detection", 97, "emerald"],
                  ["Dependency Detection", 100, "emerald"],
                  ["Database Detection", 61, "yellow"],
                  ["AI Readiness", 94, "emerald"],
                ].map(([label, pct, color]) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-gray-300">
                      <span>{label}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${color === "emerald" ? "bg-emerald-500" : "bg-yellow-500"}`} 
                        style={{ width: `${pct}%` }} 
                        />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Proposition Description */}
            <div className="space-y-6 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-500">AI Project Intelligence</span>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">This is not just a markdown generator.</h3>
              <p className="text-sm sm:text-base text-[#8e939e] leading-relaxed">
                AI Context Brain analyzes repository structures, detects frameworks, evaluates dependencies, builds optimized project context, and generates AI-ready instructions dynamically.
              </p>
              <p className="text-sm text-[#8e939e] leading-relaxed">
                By presenting clean, verified, and structured quality metrics, it guarantees that whatever LLM coding assistant you use gets high-readiness, verified context instead of guesswork.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Pricing Section ───────────────────────────────────── */}
      <section id="pricing" className="py-20 lg:py-28 border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">Plans</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">Simple, developer-first pricing</h3>
            <p className="text-sm sm:text-base text-[#8e939e] max-w-xl mx-auto leading-relaxed">
              Choose the tier that matches your repository size and optimization frequency.
            </p>

            <div className="mt-8 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
              <button
                onClick={() => setBilling("monthly")}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition-all duration-200 ${billing === "monthly" ? "bg-white text-[#05060b] shadow-lg" : "text-[#9aa3bd] hover:text-white"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition-all duration-200 ${billing === "yearly" ? "bg-white text-[#05060b] shadow-lg" : "text-[#9aa3bd] hover:text-white"}`}
              >
                Yearly - 2 months free
              </button>
            </div>
          </div>

          {(() => {
            const LANDING_PLANS = [
              {
                id: "free",
                name: "Free",
                headline: "Perfect for exploring AI Context Brain.",
                description: "Everything you need to experience the core workflow.",
                monthlyPrice: 0,
                yearlyPrice: 0,
                color: "#8b91b3",
                cta: "Get Started",
                badge: null,
                features: [
                  "⚡ Quick Explain (Basic AI Context)",
                  "📁 Up to 3 Project Memories",
                  "🔍 Local Project Scanning",
                  "💻 IDE Export Integrations",
                  "🔄 50 Context Refreshes / Month",
                  "🤖 30 AI Requests / Month",
                  "💬 Community Support",
                ],
                disabled: [
                  "✕ Deep Explain",
                  "✕ Deep Explain + Review",
                  "✕ Context History",
                  "✕ Diff & Restore",
                  "✕ Priority Gemini Generation",
                  "✕ API Access",
                  "✕ Team Workspace",
                ]
              },
              {
                id: "pro",
                name: "Pro",
                headline: "Built for developers using AI every day.",
                description: "Deep codebase intelligence for personal workflow optimization.",
                monthlyPrice: 9,
                yearlyPrice: 90,
                color: "#4f7cff",
                cta: "Upgrade to Pro",
                featured: true,
                badge: "⭐ MOST POPULAR",
                features: [
                  "⚡ Quick Explain (Basic AI Context)",
                  "🧠 Deep Explain (Deep Optimized AI Context)",
                  "📚 Context History & Restore",
                  "⚡ Priority Gemini Generation",
                  "🏗️ Architecture Rules",
                  "📂 Naming & Folder Rules",
                  "📤 Advanced IDE Exports",
                  "🔌 API Access",
                  "🚀 Priority Support",
                  "📁 Up to 999 Project Memories",
                  "🔄 500 Context Refreshes / Month",
                  "🤖 100 AI Requests / Month",
                ],
                disabled: [
                  "✕ Deep Explain + Review",
                  "✕ Shared Team Workspace",
                  "✕ Team Collaboration",
                ]
              },
              {
                id: "team",
                name: "Team",
                headline: "Shared project memory for engineering teams.",
                description: "Scale alignment, permissions, and history across your organization.",
                monthlyPrice: 29,
                yearlyPrice: 290,
                color: "#8b5cf6",
                cta: "Upgrade to Team",
                badge: "👥 COLLABORATION FIRST",
                features: [
                  "⚡ Quick Explain (Basic AI Context)",
                  "🧠 Deep Explain (Deep Optimized AI Context)",
                  "🔍 Deep Explain + Review",
                  "👥 Shared Team Workspace",
                  "🧠 Shared Project Memory",
                  "🔄 Shared AI Context",
                  "📂 Project Sharing",
                  "👤 Roles & Permissions",
                  "📨 Invitation Management",
                  "📊 Team Activity History",
                  "📈 Team Usage Overview",
                  "🔑 Ownership Transfer",
                  "👥 Up to 10 Members",
                  "🚀 Priority Support",
                  "🔄 1,000 Context Refreshes / Month",
                  "🤖 500 AI Requests / Month",
                ],
                disabled: []
              }
            ];

            return (
              <div className="grid lg:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
                {LANDING_PLANS.map((plan) => {
                  const yearlySavings = Math.max(0, plan.monthlyPrice * 12 - plan.yearlyPrice);
                  const displayPrice = billing === "monthly" ? formatPrice(plan.monthlyPrice) : formatPrice(plan.yearlyPrice / 12);
                  const subtext = billing === "yearly" && plan.monthlyPrice > 0 ? `2 months free - billed annually at $${plan.yearlyPrice}/yr (save $${yearlySavings}/yr)` : null;

                  return (
                    <div
                      key={plan.id}
                      className="rounded-2xl border bg-[#0a0c12]/50 backdrop-blur-lg p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:translate-y-[-2px] text-left"
                      style={{
                        borderColor: plan.featured ? "rgba(79, 124, 255, 0.3)" : "rgba(255, 255, 255, 0.05)",
                        boxShadow: plan.featured ? "0 10px 40px rgba(79, 124, 255, 0.03)" : "none"
                      }}
                    >
                      {plan.badge && (
                        <span className="absolute top-4 right-4 rounded-full border px-3 py-0.5 text-[9px] font-black uppercase tracking-wider text-white bg-white/[0.05]"
                              style={{
                                borderColor: plan.id === "pro" ? "rgba(234, 179, 8, 0.3)" : "rgba(139, 92, 246, 0.3)",
                                color: plan.id === "pro" ? "#fef08a" : "#ddd6fe"
                              }}>
                          {plan.badge}
                        </span>
                      )}

                      <div>
                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        <p className="mt-2 text-xs font-semibold text-[#7ba3ff]">{plan.headline}</p>
                        <p className="mt-2 text-xs text-[#8e939e] leading-relaxed">{plan.description}</p>

                        <div className="mt-8 flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold text-white">${displayPrice}</span>
                          <span className="text-xs text-[#4a5070] font-bold">/ mo</span>
                        </div>
                        {subtext ? (
                          <p className="text-[10px] text-indigo-400/80 font-bold mt-1">{subtext}</p>
                        ) : (
                          <p className="text-[10px] text-transparent font-bold mt-1">Placeholder</p>
                        )}

                        <Link
                          to="/login?returnUrl=/plans"
                          onClick={() => trackEvent("sign_up_click", { plan: plan.id, location: "pricing_table" })}
                          className={`mt-8 block text-center w-full rounded-xl py-3 text-xs font-bold transition-all duration-200 ${
                            plan.featured
                              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_4px_20px_rgba(59,130,246,0.15)]"
                              : "bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08]"
                          }`}
                        >
                          {plan.cta}
                        </Link>

                        <div className="mt-8 border-t border-white/[0.05] pt-6">
                          <ul className="space-y-3">
                            {plan.features.map((feature) => (
                              <li key={feature} className="flex items-start gap-2.5 text-xs text-[#c3cadb] leading-relaxed">
                                <span>{feature}</span>
                              </li>
                            ))}
                            {plan.disabled.map((disabledFeature) => (
                              <li key={disabledFeature} className="flex items-start gap-2.5 text-xs text-white/[0.2] line-through select-none leading-relaxed">
                                <span>{disabledFeature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Final CTA Section ─────────────────────────────────── */}
      <section className="py-24 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Your AI tools are only as good as their context.
          </h2>
          <p className="text-sm sm:text-base text-[#8e939e] max-w-xl mx-auto leading-relaxed">
            Give every AI assistant a complete, optimized understanding of your codebase. Start shipping consistent code today.
          </p>
          <div className="pt-2">
            <Link to="/login" onClick={() => trackEvent("sign_up_click", { action: "start_free", location: "final_cta" })} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-8 py-3.5 rounded-lg inline-block transition-all shadow-[0_2px_10px_rgba(37,99,235,0.2)]">
              Start Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-12 bg-[#050609]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-6 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-xs font-black">AI</div>
            <span className="text-xs font-bold text-gray-400">AI Context Brain (c) 2026</span>
          </div>
          <p className="text-xs text-[#585c67]">
            Professional codebase adaptors for AI-first engineers.
          </p>
          <a href="https://github.com/AiContextBrain/AI-Context-Brain" target="_blank" rel="noreferrer" onClick={() => trackEvent("github_click", { location: "footer" })} className="text-xs font-semibold text-[#8e939e] hover:text-white transition-colors">
            GitHub Repository
          </a>
        </div>
      </footer>

    </div>
  );
}
