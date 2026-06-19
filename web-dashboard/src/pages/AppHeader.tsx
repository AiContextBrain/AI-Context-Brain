import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type AppHeaderProps = {
  title?: string;
  planName?: string;
  onSave?: () => void;
  saveLabel?: string;
  saveState?: "idle" | "saving" | "saved";
  onSignOut?: () => void;
};

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/authorize", label: "Connect IDE" },
  { path: "/plans", label: "Plans" },
];

export default function AppHeader({
  title = "Context Ops",
  planName,
  onSave,
  saveLabel = "Save",
  saveState = "idle",
  onSignOut,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user?.email?.[0]?.toUpperCase() ?? "U";
  const activePlan = planName ?? user?.plan ?? "Free";
  const planColor = activePlan === "Team" ? "#8b5cf6" : activePlan === "Pro" ? "#4f7cff" : "#8b91b3";

  const navItems = user?.role === "Admin"
    ? [...NAV_ITEMS, { path: "/admin", label: "Admin" }]
    : NAV_ITEMS;

  const isActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#06070a]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button onClick={() => navigate("/dashboard")} className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-black text-black shadow-[0_2px_8px_rgba(255,255,255,0.15)]">
              AI
            </div>
            <span className="hidden text-sm font-bold tracking-tight text-white sm:block">AI Context Brain</span>
          </button>

          <div className="hidden h-6 w-px bg-white/[0.08] md:block" />

          <span className="hidden truncate text-xs font-bold uppercase tracking-wider text-[#8e939e] md:block">
            {title}
          </span>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                isActive(item.path)
                  ? "bg-white/[0.08] text-white"
                  : "text-[#8b91b3] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            className="hidden rounded-lg px-2.5 py-1 text-[10px] font-black sm:inline-flex"
            style={{ background: `${planColor}15`, color: planColor, border: `1px solid ${planColor}30` }}
          >
            {activePlan}
          </span>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="btn-secondary rounded-lg px-2.5 py-2 text-xs lg:hidden"
            aria-label="Toggle menu"
          >
            Menu
          </button>

          <button onClick={() => navigate("/settings")} className="hidden btn-secondary rounded-lg px-3 py-2 text-xs sm:inline-flex">
            Settings
          </button>

          {onSave && (
            <button onClick={onSave} disabled={saveState === "saving"} className="btn-primary rounded-lg px-3 py-2 text-xs disabled:opacity-50 sm:px-4">
              {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveLabel}
            </button>
          )}

          {onSignOut ? (
            <button
              onClick={onSignOut}
              className="hidden btn-secondary rounded-lg px-3 py-2 text-xs sm:inline-flex"
              style={{ color: "#f87171", borderColor: "rgba(239,68,68,0.25)" }}
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => navigate("/profile")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white transition hover:scale-105"
              style={{ background: `linear-gradient(135deg,${planColor},#8b5cf6)`, boxShadow: `0 2px 12px ${planColor}40` }}
              title={user?.email}
            >
              {initials}
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/[0.06] bg-[#06070a]/98 px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMenuOpen(false);
                }}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${
                  isActive(item.path) ? "bg-white/[0.08] text-white" : "text-[#8b91b3]"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                navigate("/settings");
                setMenuOpen(false);
              }}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#8b91b3]"
            >
              Settings
            </button>
            <button
              onClick={() => {
                navigate("/profile");
                setMenuOpen(false);
              }}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#8b91b3]"
            >
              Profile
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
