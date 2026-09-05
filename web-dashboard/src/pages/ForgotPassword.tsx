import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { useSEO } from "../hooks/useSEO";

export default function ForgotPassword() {
  useSEO({
    title: "Forgot Password - AI Context Brain",
    description: "Reset the password for your AI Context Brain account.",
    canonicalUrl: "https://aicontextbrain.me/forgot-password",
  });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";
      const response = await fetch(`${apiBase}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setMessage("If the account exists, a password reset link has been sent.");
      } else {
        const data = await response.json();
        setError(data.message || data.error || "Failed to send the reset link.");
      }
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your account email and we will send a secure reset link.">
      {error && (
        <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300">
          {error}
        </div>
      )}

      {message ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-sm font-black text-emerald-300">
            OK
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">{message}</p>
            <p className="text-xs leading-relaxed text-[#8e939e]">
              The link expires in one hour. Check spam or request a new link if it does not arrive.
            </p>
          </div>

          <Link to="/login" className="btn-primary w-full py-2.5 text-center text-xs font-bold">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8e939e]">Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Sending..." : "Send reset link"}
          </button>

          <div className="text-center">
            <Link to="/login" className="text-xs font-semibold text-blue-300 hover:text-blue-200">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
