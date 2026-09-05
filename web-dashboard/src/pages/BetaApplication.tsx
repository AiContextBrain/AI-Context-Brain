import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { trackPageView, trackEvent } from "../utils/analytics";
import { useAlert } from "../context/AlertContext";

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Côte d'Ivoire", "Cabo Verde",
  "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)",
  "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini (fmr. Swaziland)", "Ethiopia", "Fiji", "Finland",
  "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Holy See", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
  "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", "Vanuatu",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";

export default function BetaApplication() {
  const { showAlert } = useAlert();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    country: "",
    linkedInOrGithubUrl: "",
    primaryIde: "",
    primaryStack: "",
    projectType: "",
    willTestRealProject: true,
    willProvideFeedback: true,
    motivation: "",
    currentProblem: ""
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackPageView("/beta");
    trackEvent("beta_page_view");
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));

    if (name === "fullName" && formData.fullName === "") {
      trackEvent("beta_form_start");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/BetaApplication/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        if (data.emailDelivery === "failed") {
          showAlert("Application saved, but the confirmation email could not be delivered.", "warning");
        }
        trackEvent("beta_application_submitted");
      } else {
        if (data.errors && typeof data.errors === 'object') {
          const firstErrorKey = Object.keys(data.errors)[0];
          const firstErrorMsg = data.errors[firstErrorKey][0];
          setError(firstErrorMsg);
        } else if (response.status === 409 && data.status) {
          const submittedAt = data.createdAt ? new Date(data.createdAt).toLocaleString() : null;
          setError(`An application with this email already exists. Current status: ${data.status}${submittedAt ? `, submitted: ${submittedAt}` : ""}.`);
        } else {
          setError(data.error || data.message || "An error occurred while submitting your application.");
        }
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-[#cbd5e1] font-sans flex items-center justify-center p-4">
        <div className="max-w-md w-full card p-8 text-center" style={{ background: "rgba(13,15,26,0.68)", borderColor: "rgba(16,185,129,0.2)" }}>
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">Application Received!</h2>
          <p className="text-[#8b91b3] text-sm leading-relaxed mb-8">
            Thank you for applying to the AI Context Brain Beta Program. We review applications daily and will notify you via email if a spot opens up for you.
          </p>
          <Link to="/" className="btn-primary px-6 py-3 font-bold text-sm block w-full">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#cbd5e1] font-sans">
      <div className="absolute top-0 w-full h-[500px] bg-gradient-to-b from-[#4f7cff]/10 to-transparent pointer-events-none" />
      
      <div className="max-w-3xl mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
            <span className="w-8 h-8 rounded-lg bg-white text-[#0b0f19] font-black flex items-center justify-center text-xs">AI</span>
            <span className="font-bold text-white tracking-tight">AI Context Brain</span>
          </Link>
          <div className="inline-block px-3 py-1 mb-4 rounded-full border border-[#4f7cff]/30 bg-[#4f7cff]/10 text-[#7ba3ff] text-[10px] font-black uppercase tracking-wider">
            Closed Beta Program
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            Apply for Beta Access
          </h1>
          <p className="text-lg text-[#8b91b3] max-w-xl mx-auto leading-relaxed">
            We are opening <strong className="text-white">10 spots</strong> for serious developers. Selected testers receive 1 month of Pro access for free in exchange for honest feedback.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 md:p-10 space-y-8" style={{ background: "rgba(13,15,26,0.68)", borderColor: "rgba(255,255,255,0.06)" }}>
          
          {error && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm font-semibold">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-xl font-black text-white border-b border-white/[0.06] pb-4">1. Personal Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">Full Name *</label>
                <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="input w-full" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">Email Address *</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="input w-full" placeholder="john@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">Country</label>
                <select name="country" value={formData.country} onChange={handleChange} className="input w-full bg-[#111422]">
                  <option value="">Select a country...</option>
                  {COUNTRIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">LinkedIn or GitHub URL</label>
                <input type="url" name="linkedInOrGithubUrl" value={formData.linkedInOrGithubUrl} onChange={handleChange} className="input w-full" placeholder="https://github.com/..." />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black text-white border-b border-white/[0.06] pb-4 mt-8">2. Technical Profile</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">Primary IDE</label>
                <select name="primaryIde" value={formData.primaryIde} onChange={handleChange} className="input w-full bg-[#111422]">
                  <option value="">Select IDE...</option>
                  <option value="VS Code">VS Code</option>
                  <option value="Cursor">Cursor</option>
                  <option value="Windsurf">Windsurf</option>
                  <option value="Claude Code">Claude Code</option>
                  <option value="Cline">Cline</option>
                  <option value="Continue">Continue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">Primary Stack</label>
                <select name="primaryStack" value={formData.primaryStack} onChange={handleChange} className="input w-full bg-[#111422]">
                  <option value="">Select Stack...</option>
                  <option value=".NET">.NET</option>
                  <option value="Next.js">Next.js</option>
                  <option value="React">React (SPA)</option>
                  <option value="Node.js">Node.js</option>
                  <option value="Python">Python</option>
                  <option value="Go">Go</option>
                  <option value="Java">Java</option>
                  <option value="PHP">PHP</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">Project Type You Will Test On</label>
              <select name="projectType" value={formData.projectType} onChange={handleChange} className="input w-full bg-[#111422]">
                <option value="">Select Project Type...</option>
                <option value="SaaS">SaaS Application</option>
                <option value="API">API Backend</option>
                <option value="Web App">Web App</option>
                <option value="Automation">Automation Script / CLI</option>
                <option value="Open Source">Open Source Project</option>
                <option value="Client Project">Client Project</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black text-white border-b border-white/[0.06] pb-4 mt-8">3. Beta Commitments</h3>
            
            <div className="space-y-4">
              <label className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#111422] cursor-pointer hover:border-[#4f7cff]/50 transition-colors">
                <input type="checkbox" name="willTestRealProject" checked={formData.willTestRealProject} onChange={handleChange} className="mt-1" />
                <div>
                  <p className="text-sm font-bold text-white">I will test this on a real project</p>
                  <p className="text-xs text-[#8b91b3] mt-1">We want to see how the product performs on actual, complex codebases rather than hello-world examples.</p>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#111422] cursor-pointer hover:border-[#4f7cff]/50 transition-colors">
                <input type="checkbox" name="willProvideFeedback" checked={formData.willProvideFeedback} onChange={handleChange} className="mt-1" />
                <div>
                  <p className="text-sm font-bold text-white">I will provide honest feedback</p>
                  <p className="text-xs text-[#8b91b3] mt-1">I agree to share what's working, what's broken, and what's confusing during my 1-month trial.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black text-white border-b border-white/[0.06] pb-4 mt-8">4. Why You?</h3>
            
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">Why do you want to test AI Context Brain? *</label>
              <textarea required minLength={20} name="motivation" value={formData.motivation} onChange={handleChange} className="input w-full min-h-[100px] resize-y" placeholder="I'm tired of re-explaining my architecture to Cursor every day..." />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b91b3] mb-2">What is your biggest current problem with AI coding tools? (Optional)</label>
              <textarea name="currentProblem" value={formData.currentProblem} onChange={handleChange} className="input w-full min-h-[100px] resize-y" placeholder="Context windows are too small, it keeps breaking my existing patterns..." />
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.06]">
            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-sm font-black shadow-[0_0_40px_rgba(79,124,255,0.4)] disabled:opacity-50">
              {loading ? "Submitting Application..." : "Submit Application"}
            </button>
            <p className="text-center text-[10px] text-[#606783] mt-4">
              By submitting, you agree to our <Link to="/terms" className="text-[#8b91b3] hover:text-white underline decoration-white/20">Terms of Service</Link> and <Link to="/privacy" className="text-[#8b91b3] hover:text-white underline decoration-white/20">Privacy Policy</Link>.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
