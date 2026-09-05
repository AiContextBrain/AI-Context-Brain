import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { getAnalyticsConsent, initAnalytics, loadAnalyticsConfig, setAnalyticsConsent, trackPageView } from './utils/analytics';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Authorize from './pages/Authorize';
import Dashboard from './pages/Dashboard';
import Pricing from './pages/Pricing';
import Plans from './pages/Plans';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import BetaApplication from './pages/BetaApplication';
import BetaActivate from './pages/BetaActivate';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

function App() {
  const { user } = useAuth();
  const location = useLocation();
  const [showAnalyticsConsent, setShowAnalyticsConsent] = useState(() => getAnalyticsConsent() === null);

  useEffect(() => {
    loadAnalyticsConfig().then(config => initAnalytics(config));
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  return (
    <AlertProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/beta" element={<BetaApplication />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        
        {/* Auth routes */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" /> : <Login />} 
        />
        
        {/* Protected routes */}
        <Route path="/plans" element={user ? <Plans /> : <Navigate to="/login?returnUrl=/plans" />} />
        <Route path="/authorize" element={<Authorize />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user && user.role === "Admin" ? <AdminPanel /> : <Navigate to="/dashboard" />} />
        <Route path="/admin/feedback" element={user && user.role === "Admin" ? <AdminPanel /> : <Navigate to="/dashboard" />} />
        <Route path="/beta-activate" element={user ? <BetaActivate /> : <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`} />} />
      </Routes>
      {showAnalyticsConsent && (
        <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-2xl rounded-lg border border-white/10 bg-[#0d0f1a] p-4 shadow-2xl">
          <p className="text-sm font-bold text-white">Optional product analytics</p>
          <p className="mt-1 text-xs leading-5 text-[#9aa3bd]">Allow anonymous usage analytics to help improve AI Context Brain. Authentication and project content are not included.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-secondary px-4 py-2 text-xs" onClick={() => { setAnalyticsConsent('denied'); initAnalytics(); setShowAnalyticsConsent(false); }}>Decline</button>
            <button className="btn-primary px-4 py-2 text-xs" onClick={() => { setAnalyticsConsent('granted'); loadAnalyticsConfig().then(config => initAnalytics(config)); setShowAnalyticsConsent(false); }}>Allow analytics</button>
          </div>
        </div>
      )}
    </AlertProvider>
  );
}

export default App;
