import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmail() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();

  const token = searchParams.get("token") || "";

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError("Verification code is missing from the URL.");
        setLoading(false);
        return;
      }

      try {
        const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";
        const response = await fetch(`${apiBase}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (response.ok) {
          setSuccess(true);
          await refreshUser().catch(() => {});
        } else {
          const data = await response.json();
          setError(data.error || "Verification failed. The code may be invalid or expired.");
        }
      } catch {
        setError("A connection error occurred. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token, refreshUser]);

  return (
    <AuthLayout title="Email verification" subtitle="We are confirming your account so project memory stays tied to the right user.">
      {loading ? (
        <div className="space-y-4 py-4 text-center">
          <svg className="mx-auto h-8 w-8 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm font-semibold text-white">Verifying your email address...</p>
        </div>
      ) : success ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-sm font-black text-emerald-300">
            OK
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">Email verified</h3>
            <p className="text-xs leading-relaxed text-[#8e939e]">Your account is ready for context optimization workflows.</p>
          </div>
          <Link to="/dashboard" className="btn-primary w-full py-2.5 text-center text-xs font-bold">
            Go to dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-5 text-center">
          <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300">
            {error}
          </div>
          <Link to="/login" className="btn-primary w-full py-2.5 text-center text-xs font-bold">
            Sign in
          </Link>
          <Link to="/dashboard" className="block text-xs font-semibold text-blue-300 hover:text-blue-200">
            Back to dashboard
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
