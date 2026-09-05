import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSEO } from "../hooks/useSEO";
import { trackEvent } from "../utils/analytics";

const PLANS = [
  {
    id: "free",
    name: "Free",
    headline: "Perfect for exploring AI Context Brain.",
    description: "Everything you need to experience the core workflow.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: "Current Plan",
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

const FAQ = [
  {
    q: "Is this a code scanner?",
    a: "No. Scanning is only how the product gathers signal. The core value is AI Context Optimization: turning your repository into the right memory for AI assistants.",
  },
  {
    q: "Which AI tools does it support?",
    a: "AI Context Brain is designed around Cursor, Claude Code, GitHub Copilot and Windsurf, with export formats that can also be used in generic AI workflows.",
  },
  {
    q: "Why pay for this if I can paste files into chat?",
    a: "Manual paste workflows go stale, waste time and miss decisions. AI Context Brain keeps a reusable project memory that is compressed, structured and consistent.",
  },
];

export default function Pricing() {
  useSEO({
    title: "Pricing Plans - AI Context Brain",
    description: "Choose the perfect plan for your development needs. Free for individuals, affordable Pro and Team tiers with deep codebase intelligence, context history, and priority support.",
    canonicalUrl: "https://aicontextbrain.me/pricing",
    keywords: "pricing, subscription, AI Context Brain plans, developer tools pricing",
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const formatPrice = (value: number) => Number.isInteger(value) ? value.toString() : value.toFixed(2);

  const handleAction = () => {
    if (user) navigate("/plans");
    else navigate("/login?returnUrl=/plans");
  };

  return (
    <div className="min-h-screen bg-[#05060b] text-white">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#05060b]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-[#05060b] flex items-center justify-center text-sm font-black">AC</div>
            <span className="text-sm font-bold tracking-tight">AI Context Brain</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/" className="px-3 py-2 text-sm font-medium text-[#9aa3bd] hover:text-white">Home</Link>
            <a href="https://github.com/AiContextBrain/AI-Context-Brain" target="_blank" rel="noreferrer" onClick={() => trackEvent("github_click", { location: "nav_header" })} className="px-3 py-2 text-sm font-medium text-[#9aa3bd] hover:text-white">GitHub</a>
            {user ? (
              <Link to="/dashboard" className="btn-secondary rounded-lg px-4 py-2 text-sm">Dashboard</Link>
            ) : (
              <Link to="/login" className="btn-secondary rounded-lg px-4 py-2 text-sm">Sign in</Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-white/[0.07] bg-grid-pattern">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-[#7ba3ff] mb-4">
              Pricing for AI Context Optimization
            </p>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
              Pay for better AI understanding, not another tool dashboard.
            </h1>
            <p className="mt-6 text-base sm:text-lg leading-8 text-[#9aa3bd] max-w-2xl mx-auto">
              Start free, then scale into optimized context history, shared project memory and architecture consistency as AI becomes part of your development workflow.
            </p>

            <div className="mt-10 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
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
        </section>

        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 gap-8 items-stretch">
            {PLANS.map((plan) => {
              const yearlySavings = Math.max(0, plan.monthlyPrice * 12 - plan.yearlyPrice);
              const displayPrice = billing === "monthly" ? formatPrice(plan.monthlyPrice) : formatPrice(plan.yearlyPrice / 12);
              const subtext = billing === "yearly" && plan.monthlyPrice > 0 ? `2 months free - billed annually at $${plan.yearlyPrice}/yr (save $${yearlySavings}/yr)` : null;
              const isCurrent = !!user && (user.plan?.toLowerCase() === plan.id || (!user.plan && plan.id === "free"));

              return (
                <div
                  key={plan.id}
                  className="rounded-2xl border bg-[#0a0c12]/50 backdrop-blur-lg p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:translate-y-[-2px]"
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

                    <button
                      onClick={() => {
                        trackEvent("sign_up_click", { plan: plan.id, location: "pricing_page" });
                        handleAction();
                      }}
                      className={`mt-8 w-full rounded-xl py-3 text-xs font-bold transition-all duration-200 ${
                        isCurrent 
                          ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/15" 
                          : plan.featured 
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_4px_20px_rgba(59,130,246,0.15)]" 
                            : "bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08]"
                      }`}
                    >
                      {isCurrent ? "Active subscription" : plan.cta}
                    </button>

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
        </section>

        <section className="border-t border-white/[0.07] py-20 bg-[#080a10]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-[#7ba3ff] mb-4">Positioning</p>
              <h2 className="text-3xl sm:text-4xl font-black">Every plan is built around one promise.</h2>
              <p className="mt-4 text-sm leading-7 text-[#9aa3bd]">
                Make every AI assistant fully understand your codebase. Scanning, rules, history and exports only matter because they improve that outcome, and Team adds shared context so collaborators stay aligned.
              </p>
            </div>

            <div className="mt-12 grid md:grid-cols-3 gap-5">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-lg border border-white/[0.07] bg-[#0d1018] p-5">
                  <h3 className="text-base font-bold">{item.q}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#9aa3bd]">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs font-semibold text-[#9aa3bd]">AI Context Brain 2026</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" onClick={() => trackEvent("footer_link_click", { destination: "terms" })} className="text-xs text-[#7ba3ff] hover:text-white">Terms</Link>
            <Link to="/privacy" onClick={() => trackEvent("footer_link_click", { destination: "privacy" })} className="text-xs text-[#7ba3ff] hover:text-white">Privacy</Link>
            <a href="https://github.com/AiContextBrain/AI-Context-Brain" target="_blank" rel="noreferrer" onClick={() => trackEvent("github_click", { location: "footer" })} className="text-xs text-[#7ba3ff] hover:text-white">GitHub</a>
            <Link to="/" className="text-xs text-[#7ba3ff] hover:text-white">Back to landing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
