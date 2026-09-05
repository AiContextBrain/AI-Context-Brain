import { useState, useEffect } from "react";
import { useAlert } from "../context/AlertContext";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.aicontextbrain.me";

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmails: string[];
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const TEMPLATES = [
  {
    name: "Custom",
    subject: "",
    body: ""
  },
  {
    name: "Feedback Reminder",
    subject: "How is your AI Context Brain beta experience?",
    body: `Hello {{fullName}},

We would love to hear your experience.

Please tell us:
* What worked well?
* What was confusing?
* What should be improved?

Feedback:
{{feedbackLink}}`
  },
  {
    name: "Beta Ending Soon",
    subject: "Your AI Context Brain beta access is ending soon",
    body: `Hello {{fullName}},

Your beta access expires in:
{{betaDaysRemaining}} days

Expiration date:
{{betaExpirationDate}}

Thank you for participating.`
  }
];

export default function BulkEmailModal({ isOpen, onClose, selectedEmails, authFetch }: BulkEmailModalProps) {
  const { showAlert, showConfirm } = useAlert();
  const [templateName, setTemplateName] = useState("Custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const t = TEMPLATES.find(x => x.name === templateName);
      if (t) {
        setSubject(t.subject);
        setBody(t.body);
      }
    }
  }, [templateName, isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      showAlert("Subject and Body are required.", "error");
      return;
    }

    if (selectedEmails.length === 0) {
      showAlert("No recipients selected.", "error");
      return;
    }

    if (selectedEmails.length > 50) {
      showAlert("Maximum 50 recipients allowed per request.", "error");
      return;
    }

    const confirmed = await showConfirm({
      title: "Send bulk email?",
      message: `This message will be sent to ${selectedEmails.length} recipient(s).`,
      confirmLabel: "Send email",
      cancelLabel: "Review message",
    });
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/emails/bulk-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmails: selectedEmails,
          templateName,
          subject,
          body
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showAlert(data.message || "Emails sent successfully.", "success");
        onClose();
      } else {
        showAlert(data.error || "Failed to send emails.", "error");
      }
    } catch {
      showAlert("Network error.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0f1a] border border-white/[0.06] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#8b91b3] hover:text-white font-bold px-2">✕</button>
        
        <h2 className="text-xl font-black text-white mb-1">Bulk Email Sender</h2>
        <p className="text-sm text-[#8b91b3] mb-6">Sending to {selectedEmails.length} recipients</p>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8b91b3] mb-1">Template</label>
            <select className="input w-full" value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
              {TEMPLATES.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8b91b3] mb-1">Subject</label>
            <input className="input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject..." />
          </div>

          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8b91b3]">Body</label>
              <span className="text-[10px] text-[#606783]">Variables: {'{{fullName}}, {{email}}, {{planName}}, {{betaExpirationDate}}, {{betaDaysRemaining}}, {{feedbackLink}}'}</span>
            </div>
            <textarea 
              className="input w-full h-64 font-mono text-sm leading-relaxed" 
              value={body} 
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body..."
            />
          </div>
          
          {selectedEmails.length > 50 && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-lg">
              Warning: You have selected {selectedEmails.length} recipients. The maximum allowed per request is 50. Please deselect some.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-white/[0.06] mt-4 flex justify-end gap-3">
          <button className="px-4 py-2 text-sm font-bold text-[#8b91b3] hover:text-white" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary px-6 py-2" 
            onClick={handleSend} 
            disabled={loading || selectedEmails.length > 50 || selectedEmails.length === 0}
          >
            {loading ? "Sending..." : `Send to ${selectedEmails.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
