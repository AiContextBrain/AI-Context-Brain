import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { useSEO } from "../hooks/useSEO";

const minimumPasswordLength = 8;

export default function ResetPassword() {
  useSEO({
    title: "Reset Password - AI Context Brain",
    description: "Set a new password for your AI Context Brain account.",
    canonicalUrl: "https://aicontextbrain.me/reset-password",
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token") || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Reset code is missing from the URL.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < minimumPasswordLength) {
      setError(`Password must be at least ${minimumPasswordLength} characters.`);
      return;
    }

    setLoading(true);

    try {
      const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";
      const response = await fetch(`${apiBase}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (response.ok) {
        setMessage("Your password has been reset successfully.");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to reset password. The link may have expired.");
      }
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set a new password" subtitle="Create a new password for your AI Context Brain account.">
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
            <p className="text-xs leading-relaxed text-[#8e939e]">Current sessions were revoked. Sign in again with your new password.</p>
          </div>
          <Link to="/login" className="btn-primary w-full py-2.5 text-center text-xs font-bold">
            Sign in
          </Link>
        </div>
      ) : !token ? (
        <div className="space-y-5 text-center">
          <p className="text-sm font-semibold text-white">No reset code was found in the URL.</p>
          <Link to="/forgot-password" className="btn-primary w-full py-2.5 text-center text-xs font-bold">
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8e939e]">New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Minimum 8 characters" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8e939e]">Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" placeholder="Repeat password" required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
