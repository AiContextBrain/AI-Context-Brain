import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppHeader from "./AppHeader";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";
const PADDLE_TOKEN = (import.meta as any).env?.VITE_PADDLE_CLIENT_TOKEN || "";
declare const Paddle: any;

const PLANS = [
  {
    id: "free",
    name: "Free",
    headline: "Perfect for exploring AI Context Brain.",
    description: "Everything you need to experience the core workflow.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    color: "#8b91b3",
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

export default function Plans() {
  const { user, refreshUser, authFetch } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const formatPrice = (value: number) => Number.isInteger(value) ? value.toString() : value.toFixed(2);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  // Protected route check
  useEffect(() => {
    if (!user) {
      navigate("/login?returnUrl=/plans");
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    const p = searchParams.get("payment");
    if (p === "success") {
      setToast({ type: "success", msg: "Payment completed. Your subscription status is being confirmed." });
      setTimeout(() => refreshUser(), 3000);
      setTimeout(() => setToast(null), 5000);
    } else if (p === "cancelled") {
      setToast({ type: "error", msg: "Payment cancelled. No charges made." });
      setTimeout(() => setToast(null), 4000);
    }
  }, [searchParams]);

  const handleUpgrade = async (planId: string) => {
    if (!user) return;
    if (planId === "free") return;
    setLoading(planId);
    try {
      const r = await authFetch(`${API_BASE}/payment/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: planId, billing }),
      });
      if (r.ok) {
        const d = await r.json();
        if (PADDLE_TOKEN && typeof Paddle !== "undefined" && d.transactionId) {
          Paddle.Environment.set("production");
          Paddle.Initialize({ token: PADDLE_TOKEN });
          Paddle.Checkout.open({
            transactionId: d.transactionId,
            settings: {
              successUrl: `${window.location.origin}/dashboard?payment=success`,
            },
          });
        } else {
          window.location.href = d.checkoutUrl;
        }
      } else {
        const errorData = await r.json().catch(() => ({}));
        setToast({ type: "error", msg: errorData.error || "Failed to initialize Paddle transaction." });
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast({ type: "error", msg: "Could not establish server connection." });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(null);
    }
  };

  if (!user) return null;

  return (
    <div style={{ background: "#040509", minHeight: "100vh", color: "var(--text-primary)" }} className="relative overflow-x-hidden">
      {/* Background Neon Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute top-[-10%] left-[30%] w-[550px] h-[550px] rounded-full" 
             style={{ background: "radial-gradient(circle, rgba(79,124,255,0.06) 0%, transparent 70%)", filter: "blur(60px)" }}/>
        <div className="absolute bottom-[20%] right-[-10%] w-[450px] h-[450px] rounded-full" 
             style={{ background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", filter: "blur(50px)" }}/>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3.5 rounded-xl text-sm font-bold shadow-xl backdrop-blur-md transition-all duration-300"
             style={{
               background: toast.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
               border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
               color: toast.type === "success" ? "#34d399" : "#f87171"
             }}>{toast.msg}</div>
      )}

      <AppHeader title="Plans" planName={user.plan} />

      {/* ── Pricing Hero ──────────────────────────── */}
      <section className="relative pt-16 pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight mb-4">
          Choose your <span className="gradient-text">context optimization plan</span>
        </h1>
        <p className="text-sm sm:text-base max-w-xl mx-auto mb-10 text-[#8b91b3]">
          Scale from basic project memory to optimized context history, team rules and shared AI readiness across every assistant. Team is for collaboration, not artificial limits.
        </p>

        {/* Duration Toggle */}
        <div className="flex items-center justify-center gap-3.5 mb-16">
          <span className={`text-xs font-bold transition-colors ${billing === "monthly" ? "text-white" : "text-[#4a5070]"}`}>Monthly billing</span>
          <button onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
                  className="w-12 h-6 rounded-full p-1 bg-[#111422] border border-[#1d2035] transition-all relative">
            <div className={`w-3.5 h-3.5 rounded-full bg-indigo-500 transition-all absolute top-1 ${billing === "yearly" ? "right-1.5" : "left-1.5"}`} />
          </button>
          <span className={`text-xs font-bold transition-colors ${billing === "yearly" ? "text-indigo-400" : "text-[#4a5070]"} flex items-center gap-1.5`}>
            Yearly billing
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-black tracking-wide border border-indigo-500/25">2 MONTHS FREE</span>
          </span>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto text-left">
          {PLANS.map(p => {
            const yearlySavings = Math.max(0, p.monthlyPrice * 12 - p.yearlyPrice);
            const displayPrice = billing === "monthly" ? formatPrice(p.monthlyPrice) : formatPrice(p.yearlyPrice / 12);
            const subtext = billing === "yearly" && p.monthlyPrice > 0 ? `2 months free - billed annually at $${p.yearlyPrice}/yr (save $${yearlySavings}/yr)` : null;
            const isUserCurrent = user?.plan?.toLowerCase() === p.id || (!user?.plan && p.id === "free");
            
            return (
              <div key={p.id} className="rounded-2xl border bg-[#0a0c12]/50 backdrop-blur-lg p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:translate-y-[-2px]"
                   style={{
                     borderColor: p.badge ? `${p.color}40` : "rgba(255,255,255,0.05)",
                     boxShadow: p.badge ? `0 10px 40px ${p.color}05` : "none"
                   }}>
                {p.badge && (
                  <span className="absolute top-4 right-4 rounded-full border px-3 py-0.5 text-[9px] font-black uppercase tracking-wider text-white bg-white/[0.05]"
                        style={{
                          borderColor: p.id === "pro" ? "rgba(234, 179, 8, 0.3)" : "rgba(139, 92, 246, 0.3)",
                          color: p.id === "pro" ? "#fef08a" : "#ddd6fe"
                        }}>{p.badge}</span>
                )}

                <div>
                  <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  <p className="mt-2 text-xs font-semibold text-[#7ba3ff]">{p.headline}</p>
                  <p className="mt-2 text-xs text-[#8e939e] leading-relaxed">{p.description}</p>

                  {/* Price */}
                  <div className="mt-8 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">${displayPrice}</span>
                    <span className="text-xs text-[#4a5070] font-bold">/ mo</span>
                  </div>
                  {subtext ? (
                    <div className="text-[10px] text-indigo-400/80 font-bold mt-1">{subtext}</div>
                  ) : (
                    <div className="text-[10px] text-transparent font-bold mt-1">Placeholder</div>
                  )}

                  <div className="mt-6">
                    {isUserCurrent ? (
                      <div className="w-full text-center py-2.5 px-4 rounded-xl text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/25">
                        Active subscription
                      </div>
                    ) : p.id === "free" ? (
                      <div className="w-full text-center py-2.5 px-4 rounded-xl text-xs font-bold text-[#8b91b3] bg-white/[0.02] border border-white/[0.05]">
                        Included in account
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(p.id)}
                        disabled={loading === p.id}
                        className="w-full btn-primary text-xs font-bold py-2.5 rounded-xl transition-all duration-200"
                        style={{ background: `linear-gradient(135deg, ${p.color} 0%, #6366f1 100%)` }}
                      >
                        {loading === p.id ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Initializing...
                          </span>
                        ) : (
                          p.cta
                        )}
                      </button>
                    )}
                  </div>

                  {/* Features */}
                  <div className="mt-8 border-t border-white/[0.05] pt-6">
                    <ul className="space-y-3">
                      {p.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-xs text-[#c3cadb] leading-relaxed">
                          <span>{f}</span>
                        </li>
                      ))}
                      {p.disabled.map(d => (
                        <li key={d} className="flex items-start gap-2.5 text-xs text-white/[0.2] line-through select-none leading-relaxed">
                          <span>{d}</span>
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
    </div>
  );
}
