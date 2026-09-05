import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  asideTitle?: string;
  asideItems?: string[];
};

export default function AuthLayout({
  eyebrow = "AI Context Optimization",
  title,
  subtitle,
  children,
  asideTitle = "Make every AI assistant understand your codebase.",
  asideItems = [
    "Living project memory for long-running codebases",
    "Optimized exports for Cursor, Claude Code, Copilot and Windsurf",
    "Plan limits, billing and team access enforced by the backend",
  ],
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#06070a] text-white font-sans antialiased">
      <header className="border-b border-white/[0.05] bg-[#06070a]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-black text-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]">
              AI
            </div>
            <span className="text-sm font-bold tracking-tight text-white">AI Context Brain</span>
          </Link>
          <Link to="/pricing" className="text-xs font-semibold text-[#8e939e] transition-colors hover:text-white">
            Pricing
          </Link>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        <div className="absolute left-1/2 top-0 h-[360px] w-[720px] -translate-x-1/2 bg-blue-500/[0.04] blur-[120px] pointer-events-none" />

        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <section className="hidden max-w-2xl space-y-8 text-left lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/[0.04] px-3.5 py-1.5 text-xs font-bold text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              {eyebrow}
            </div>
            <div className="space-y-5">
              <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white xl:text-5xl">
                {asideTitle}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-[#8e939e]">
                AI Context Brain keeps project memory, rules, billing access and team collaboration in one consistent developer workflow.
              </p>
            </div>
            <div className="grid max-w-xl gap-3">
              {asideItems.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-[#0b0c10] px-4 py-3 text-xs font-semibold text-[#c4c9d4]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-[420px]">
            <div className="mb-8 space-y-3 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#8e939e]">
                {eyebrow}
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white">{title}</h2>
              <p className="text-sm leading-relaxed text-[#8e939e]">{subtitle}</p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0b0c10] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)] sm:p-8">
              {children}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
