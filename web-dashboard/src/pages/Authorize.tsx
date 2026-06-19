import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';

export default function Authorize() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, generateExtensionToken } = useAuth();
  const { showAlert } = useAlert();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const fromParam = searchParams.get('from') || '';
  const redirectUri = searchParams.get('redirect_uri') || 'vscode://ai-project-brain.ai-project-brain/auth';
  const fromVscode = !!searchParams.get('redirect_uri');

  // Guess editor from redirectUri or fromParam
  let editor = 'vscode';
  if (fromParam) {
    editor = fromParam.toLowerCase();
  } else if (redirectUri.includes('cursor')) {
    editor = 'cursor';
  } else if (redirectUri.includes('windsurf')) {
    editor = 'windsurf';
  }

  const editorName = editor === 'cursor' ? 'Cursor' : editor === 'windsurf' ? 'Windsurf' : 'VS Code';

  // Auto-redirect countdown after authorization
  useEffect(() => {
    if (!authorized || !token) return;
    if (countdown <= 0) {
      window.location.href = `${redirectUri}?token=${token}`;
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [authorized, token, countdown, redirectUri]);

  const handleAuthorize = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const generated = await generateExtensionToken(editor);
      if (generated) {
        setToken(generated);
        setAuthorized(true);
      } else {
        showAlert('Failed to generate connection key. Please try again.', 'error');
      }
    } catch {
      showAlert('An error occurred during authorization.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRedirectToExtension = () => {
    if (token) {
      window.location.href = `${redirectUri}?token=${token}`;
    }
  };

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) {
    const currentParams = searchParams.toString();
    const returnUrl = encodeURIComponent(`/authorize?${currentParams}`);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#040509] relative overflow-hidden">
        {/* Neon Backdrop Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', filter: 'blur(50px)' }} />

        <div className="relative card text-center max-w-sm w-full mx-4" style={{ background: 'rgba(13,15,26,0.8)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg"
               style={{ background: 'linear-gradient(135deg,#4f7cff,#8b5cf6)', boxShadow: '0 8px 30px rgba(79,124,255,0.3)' }}>
            🧠
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Sign in to continue</h2>
          {fromVscode && (
            <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-4">
              IDE extension ({editorName}) is waiting for authorization
            </p>
          )}
          <p className="text-sm text-[#8b91b3] mb-6">
            You need to be logged in to authorize your IDE extension and sync your project memory.
          </p>
          <button
            onClick={() => navigate(`/login?from=${editor}&returnUrl=${returnUrl}`)}
            className="btn-primary w-full mb-3"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate(`/login?from=${editor}&tab=register&returnUrl=${returnUrl}`)}
            className="btn-secondary w-full"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#040509] relative overflow-hidden">
      {/* Neon Backdrop Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-6">
          <a href="/dashboard" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                 style={{ background: 'linear-gradient(135deg,#4f7cff,#8b5cf6)', boxShadow: '0 4px 15px rgba(79,124,255,0.25)' }}>
              🧠
            </div>
            <span className="text-lg font-bold text-white">AI Context Brain</span>
          </a>
          <h1 className="text-2xl font-bold text-white">
            {authorized ? 'Connected successfully!' : `Connect with ${editorName}`}
          </h1>
          <p className="text-[#8b91b3] mt-1 text-sm">
            {authorized ? 'Your AI tool can now use optimized project context.' : `Authorize secure context integration for ${editorName}`}
          </p>
        </div>

        <div className="card" style={{ background: 'rgba(13,15,26,0.8)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)' }}>
          {!authorized ? (
            <div className="space-y-5">
              {/* Permissions */}
              <div className="bg-[#06070d] rounded-xl p-4 space-y-3.5 border border-white/[0.03]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8b91b3]">This will allow {editorName} to:</p>
                {[
                  { icon: '01', text: 'Collect repository signals for project memory' },
                  { icon: '02', text: 'Retrieve optimized AI instructions and conventions' },
                  { icon: '03', text: 'Save context history for future restore and diff' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center text-sm">
                      {item.icon}
                    </div>
                    <span className="text-sm text-gray-300">{item.text}</span>
                  </div>
                ))}
              </div>

              {/* User info */}
              <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md">
                  {user.email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] text-[#4a5070] font-bold uppercase tracking-wider">Signed in as</p>
                  <p className="text-sm text-white font-medium">{user.email}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAuthorize}
                  disabled={loading}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm py-2.5"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Connecting...
                    </span>
                  ) : '✓ Connect Editor'}
                </button>
                <button onClick={() => navigate('/dashboard')} className="flex-1 btn-secondary text-sm py-2.5">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <div>
                  <p className="text-emerald-400 font-bold text-sm">Integration Authorized!</p>
                  <p className="text-emerald-400/70 text-xs mt-0.5">Secure connection key created successfully.</p>
                </div>
              </div>

              {/* Auto-redirect countdown */}
              {fromVscode && countdown > 0 && (
                <div className="flex items-center justify-between bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
                  <span className="text-blue-400 text-xs font-semibold">Redirecting back to {editorName}...</span>
                  <span className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md animate-pulse">
                    {countdown}
                  </span>
                </div>
              )}

              {/* Connection key preview */}
              <div className="bg-[#06070d] p-3.5 rounded-xl border border-white/[0.03]">
                <p className="text-[10px] text-[#4a5070] font-bold uppercase tracking-wider mb-1.5">Connection Key</p>
                <code className="text-xs text-indigo-300 break-all font-mono">
                  {token?.substring(0, 36)}...
                </code>
              </div>

              <div className="space-y-2 pt-2">
                <button onClick={handleRedirectToExtension} className="w-full btn-primary py-2.5">
                  Launch {editorName}
                </button>
                <button
                  onClick={handleCopyToken}
                  className={`w-full py-2.5 transition-all ${
                    copied ? 'btn-success' : 'btn-secondary'
                  }`}
                >
                  {copied ? '✓ Copied Key!' : '📋 Copy Access Key'}
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full text-center text-[#8b91b3] hover:text-white py-2 text-xs font-semibold transition-colors"
                >
                  ← Go back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
