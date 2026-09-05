import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAlert } from "../context/AlertContext";
import AppHeader from "./AppHeader";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";

export default function BetaActivate() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const { authFetch, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const activatedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      showAlert("Missing activation token.", "error");
      navigate("/dashboard");
      return;
    }

    if (activatedRef.current) return;
    activatedRef.current = true;

    async function activate() {
      try {
        window.history.replaceState({}, document.title, "/beta-activate");
        const res = await authFetch(`${API_BASE}/BetaApplication/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          await refreshUser();
          setSuccess(true);
          showAlert(data.message || "Beta access activated successfully!", "success");
          setTimeout(() => navigate("/dashboard"), 3000);
        } else {
          showAlert(data.error || "Failed to activate beta access.", "error");
          navigate("/dashboard");
        }
      } catch (err) {
        showAlert("Network error.", "error");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    activate();
  }, [token, navigate, showAlert, authFetch, refreshUser]);

  return (
    <div className="min-h-screen bg-[#06080d] flex flex-col items-center">
      <AppHeader />
      <div className="w-full max-w-md mt-20 p-8 card text-center border-[#4f7cff30]" style={{ background: "rgba(13,15,26,0.85)" }}>
        <h2 className="text-2xl font-black text-white mb-4">Beta Activation</h2>
        {loading ? (
          <div>
            <LoadingState title="Activating your beta access..." description="Please wait..." />
          </div>
        ) : success ? (
          <div>
            <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-400 font-bold mb-2">Activation Successful!</p>
            <p className="text-sm text-[#8b91b3]">Redirecting to your dashboard...</p>
          </div>
        ) : (
          <div>
            <p className="text-red-400 font-bold">Activation failed or token expired.</p>
          </div>
        )}
      </div>
    </div>
  );
}
