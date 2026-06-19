import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { useAuth } from "../context/AuthContext";
import { useSEO } from "../hooks/useSEO";
import { trackEvent } from "../utils/analytics";

const minimumPasswordLength = 8;

export default function Login() {
  useSEO({
    title: "Sign In - AI Context Brain",
    description: "Sign in or create your AI Context Brain account to manage codebase memory, connect VS Code extension, and sync your development guidelines.",
    canonicalUrl: "https://aicontextbrain.me/login",
  });

  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredSuccessfully, setRegisteredSuccessfully] = useState(false);
  const [registrationEmailWarning, setRegistrationEmailWarning] = useState("");
  const { login, register } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const returnUrl = searchParams.get("returnUrl");
  const tabParam = searchParams.get("tab");
  const fromParam = searchParams.get("from") || "";
  const fromEditor = fromParam === "cursor" ? "Cursor" : fromParam === "windsurf" ? "Windsurf" : "VS Code";
  const isEditorConnection = !!searchParams.get("from") || !!searchParams.get("returnUrl");

  useEffect(() => {
    if (tabParam === "register") {
      setTab("register");
    } else if (tabParam === "login") {
      setTab("login");
    }
  }, [tabParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (tab === "register") {
      if (!username) {
        setError("Username is required.");
        return;
      }
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3 || cleanUsername.length > 30 || !/^[a-zA-Z0-9]+$/.test(cleanUsername)) {
        setError("Username must be between 3 and 30 alphanumeric characters.");
        return;
      }
    }

    if (tab === "register" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < minimumPasswordLength) {
      setError(`Password must be at least ${minimumPasswordLength} characters.`);
      return;
    }

    setLoading(true);
    try {
      if (tab === "register") {
        trackEvent("sign_up_click", { action: "register_submit", source: "login_page" });
        const cleanUsername = username.trim().toLowerCase();
        const result = await register(email, cleanUsername, password);
        if (result.success) {
          setRegistrationEmailWarning(result.emailSent === false ? (result.emailError || "Verification email could not be sent. You can resend it from Profile after sign in.") : "");
          setRegisteredSuccessfully(true);
        } else {
          setError("Registration failed. Email or Username may already be in use.");
        }
      } else if (await login(email, password)) {
        if (returnUrl) {
          navigate(decodeURIComponent(returnUrl));
        } else {
          navigate("/dashboard");
        }
      } else if (tab === "login") {
        setError("Invalid email or password.");
      }
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={tab === "login" ? "Welcome back" : "Create your account"}
      subtitle={tab === "login" ? "Sign in to manage project memory, exports and billing." : "Start with a free project memory workspace."}
    >
      {isEditorConnection && (
        <div className="mb-5 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2 text-xs font-semibold text-blue-300">
          Connecting {fromEditor} for optimized context export.
        </div>
      )}

      {registeredSuccessfully ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-sm font-black text-emerald-300">
            OK
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">Account created</h3>
            <p className="text-xs leading-relaxed text-[#8e939e]">
              {registrationEmailWarning
                ? registrationEmailWarning
                : <>A verification email has been sent to <span className="font-semibold text-blue-300">{email}</span>.</>}
            </p>
          </div>
          {registrationEmailWarning && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-left text-xs font-semibold text-amber-200">
              Account created, but email delivery failed. After sign in, open Profile and use Resend Verification.
            </div>
          )}

          <button
            onClick={() => {
              setRegisteredSuccessfully(false);
              setTab("login");
              setError("");
            }}
            className="btn-primary w-full py-2.5 text-xs font-bold"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 rounded-lg border border-white/[0.06] bg-[#06070a] p-1">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTab(item);
                  setError("");
                }}
                className={`rounded-md px-3 py-2 text-xs font-bold transition-all ${tab === item ? "bg-white text-black" : "text-[#8e939e] hover:text-white"}`}
              >
                {item === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8e939e]">
                {tab === "login" ? "Email or Username" : "Email address"}
              </label>
              <input 
                type={tab === "login" ? "text" : "email"} 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="input" 
                placeholder={tab === "login" ? "you@example.com or username" : "you@example.com"} 
                required 
              />
            </div>

            {tab === "register" && (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8e939e]">Username</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className="input" 
                  placeholder="3-30 alphanumeric characters" 
                  required 
                />
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8e939e]">Password</label>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Minimum 8 characters" required />
              {tab === "login" && (
                <div className="mt-2 text-right">
                  <Link to="/forgot-password" className="text-[10px] font-semibold text-blue-300 hover:text-blue-200">
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            {tab === "register" && (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8e939e]">Confirm password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" placeholder="Repeat password" required />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Processing..." : tab === "login" ? "Sign in" : "Start free"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4d515a]">Tools</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <a
            href="https://marketplace.visualstudio.com/items?itemName=ai-project-brain.ai-project-brain"
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent("install_extension_click", { location: "login_page" })}
            className="btn-secondary w-full py-2.5 text-xs font-semibold"
          >
            Get the VS Code extension
          </a>
        </>
      )}
    </AuthLayout>
  );
}
