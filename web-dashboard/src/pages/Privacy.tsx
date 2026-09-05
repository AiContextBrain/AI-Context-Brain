import AppHeader from './AppHeader';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-[#06080F] text-white selection:bg-[#5E12E0] selection:text-white pb-20">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 pt-32">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#9aa3bd]">Privacy Policy</h1>
          </div>
          <p className="text-[#9aa3bd] text-lg">Last updated: June 22, 2026</p>
        </div>

        <div className="prose prose-invert prose-p:text-[#9aa3bd] prose-headings:text-white max-w-none space-y-8">

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">1. Introduction</h2>
            <p>
              Welcome to AI Context Brain ("we", "our", or "us"). We are committed to protecting your privacy and ensuring you have a secure experience when using our website, VS Code extension, and related services (collectively, the "Services"). This Privacy Policy explains how we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">2. Your Code Remains Yours (No Source Code Uploads)</h2>
            <p>
              <strong>We do not upload, read, or store your source code on our servers.</strong> The core functionality of AI Context Brain operates locally within your VS Code environment.
            </p>
            <ul className="list-disc pl-5 text-[#9aa3bd] space-y-2 mt-4">
              <li><strong>Local Processing:</strong> Context generation, metadata scanning, and project memory mapping happen locally on your machine.</li>
              <li><strong>Local Storage:</strong> Your project memory is saved locally in a `.brain-cache` or similar local directory inside your workspace.</li>
              <li><strong>No Third-Party AI Data Sharing:</strong> We do not send your code to LLM providers directly. You export the context to use manually with your AI assistant of choice (Cursor, Claude, Copilot, Windsurf).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">3. Information We Collect</h2>
            <p>To provide and improve our Services, we collect minimal data:</p>
            <ul className="list-disc pl-5 text-[#9aa3bd] space-y-2 mt-4">
              <li><strong>Account Information:</strong> If you register for an account, we collect your email address, name, and encrypted password.</li>
              <li><strong>Billing Information:</strong> Payments are securely processed via our payment provider (Paddle). We do not store your credit card details. We only store subscription status, plan types (e.g., Free, Pro), and billing identifiers.</li>
              <li><strong>Usage Analytics (Optional):</strong> With your consent, we collect anonymous product usage analytics to improve AI Context Brain. This includes page views and feature usage events. You can opt-out at any time via the banner or settings.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">4. How We Use Your Information</h2>
            <p>We use the collected information strictly for the following purposes:</p>
            <ul className="list-disc pl-5 text-[#9aa3bd] space-y-2 mt-4">
              <li>To provide, maintain, and support the Services.</li>
              <li>To manage your account and subscription access.</li>
              <li>To communicate important updates, security alerts, and transactional messages.</li>
              <li>To analyze usage trends and improve the extension and dashboard (only via aggregated, anonymous analytics).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">5. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your account information. All network communication between the extension and our API (`api.aicontextbrain.me`) is encrypted via HTTPS. Authentication is handled using secure JWT tokens.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">6. Third-Party Services</h2>
            <p>
              We use trusted third-party services for specific operations:
            </p>
            <ul className="list-disc pl-5 text-[#9aa3bd] space-y-2 mt-4">
              <li><strong>Paddle:</strong> For secure payment processing and subscription management.</li>
              <li><strong>Email Providers:</strong> For sending account-related notifications (e.g., password resets).</li>
            </ul>
            <p className="mt-4">
              These services have their own privacy policies governing their handling of data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy occasionally. When we make material changes, we will notify you via email or through an in-app announcement. Your continued use of the Services after such updates constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b border-white/10 pb-2">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or your data, please contact us at <strong>support@aicontextbrain.me</strong>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
