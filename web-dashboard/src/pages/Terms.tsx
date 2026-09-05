import AppHeader from './AppHeader';

const Terms = () => {
  return (
    <div className="min-h-screen bg-[#06080F] text-white selection:bg-[#5E12E0] selection:text-white pb-20">
      <AppHeader />
      
      <main className="max-w-4xl mx-auto px-6 pt-32">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#9aa3bd]">Terms of Service</h1>
          </div>
          <p className="text-[#9aa3bd] text-lg">Last updated: June 22, 2026</p>
        </div>

        <div className="prose prose-invert prose-p:text-[#9aa3bd] prose-headings:text-white max-w-none space-y-8">
          
          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">1. Acceptance of Terms</h2>
            <p>
              By downloading the AI Context Brain extension, creating an account, or accessing our web dashboard ("Services"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">2. Description of Service</h2>
            <p>
              AI Context Brain is a developer tool that optimizes AI coding assistants (e.g., Cursor, Claude, Copilot, Windsurf). It operates as a VS Code extension that locally maps project metadata, generates optimized context files, and provides architecture-aware rules. We offer both Free and paid Pro tiers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">3. User Accounts & Security</h2>
            <ul className="list-disc pl-5 text-[#9aa3bd] space-y-2 mt-4">
              <li>You must provide a valid email address to register for an account.</li>
              <li>You are entirely responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You may not share your account or subscription with other individuals. Subscriptions are strictly per-user unless otherwise specified (e.g., Team plans).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">4. Payment and Subscriptions</h2>
            <ul className="list-disc pl-5 text-[#9aa3bd] space-y-2 mt-4">
              <li><strong>Billing:</strong> Our Pro features require a paid subscription. Payments are processed securely via our merchant of record, Paddle.</li>
              <li><strong>Renewals & Cancellations:</strong> Subscriptions renew automatically unless canceled before the next billing cycle. You can cancel anytime via the dashboard. Refunds are granted solely at our discretion and in accordance with Paddle's policies.</li>
              <li><strong>Beta Access:</strong> Users granted "Pro (Beta)" access receive promotional access governed by specific beta testing rules, subject to revocation if beta terms are violated.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">5. Intellectual Property and Code Ownership</h2>
            <p>
              <strong>Your Code:</strong> You retain all rights to the source code you process using our extension. We do not claim ownership, nor do we upload, store, or train models on your proprietary source code. The metadata and context files generated locally belong entirely to you.
            </p>
            <p className="mt-4">
              <strong>Our IP:</strong> The AI Context Brain extension, dashboard, logos, and software architecture are our intellectual property and may not be reproduced, decompiled, or distributed without authorization.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">6. Limitation of Liability</h2>
            <p>
              The Services are provided "AS IS" and "AS AVAILABLE". We make no warranties regarding the accuracy of the generated context or its interpretation by third-party AI assistants. We shall not be held liable for any damages, code loss, or productivity impacts arising from the use of our Services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">7. Acceptable Use</h2>
            <p>
              You agree not to reverse-engineer our software, bypass our licensing verification, share Pro activation tokens, or use the Services in any way that attempts to overwhelm or harm our API infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">8. Governing Law</h2>
            <p>
              These terms are governed by and construed in accordance with applicable commercial laws. Any disputes arising from these terms will be handled in the appropriate jurisdiction corresponding to our primary place of business.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">9. Contact Information</h2>
            <p>
              For legal inquiries regarding these Terms of Service, contact us at <strong>legal@aicontextbrain.me</strong>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;
