import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy · Offerwing" };

const UPDATED = "September 25, 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted">Last updated {UPDATED}</p>
      <p>
        Offerwing helps you run your job search with AI agents. This policy explains what we collect, why, who processes it, how long we keep
        it and the choices you have. In short: your data is used only to help you, we never sell it, we never train AI models on it, and you
        can export or delete it at any time.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and, if you sign in with Google or LinkedIn, the basic profile those services share (name, email, photo). We never receive your LinkedIn password.</li>
        <li><strong>Your job search answers:</strong> target roles, locations, salary expectations, work authorization needs and other onboarding answers.</li>
        <li><strong>Documents you upload:</strong> your resume, LinkedIn profile PDF and LinkedIn data export. From the data export we keep your connections&apos; names, companies, positions, profile links and connection dates, plus how many messages you&apos;ve exchanged with each person and when. We do not store email addresses or the text of your messages.</li>
        <li><strong>Things you create:</strong> jobs, contacts, drafts, stories, interview prep, offers and posts.</li>
        <li><strong>Job-alert emails you forward:</strong> we extract job listings and keep each email&apos;s sender and subject for 30 days, never its full content.</li>
        <li><strong>The browser extension:</strong> reads the LinkedIn page you are on only when you click &ldquo;Analyze this page&rdquo;, and sends what it reads (for example a job description or a profile link) to Offerwing to show you results.</li>
      </ul>

      <h2>AI processing and your API key</h2>
      <ul>
        <li>To run agents, relevant parts of your data (for example your resume text and a job description) are sent to an AI provider: Anthropic, OpenAI or Google, depending on your settings.</li>
        <li><strong>Starter mode</strong> uses Offerwing&apos;s own key. <strong>Always-on mode</strong> stores your key encrypted in our database vault; it is only decrypted on our servers at the moment an agent runs and is never shown back to you or anyone else. <strong>Private mode</strong> keeps your key only in your browser extension and sends requests from your browser directly to your AI provider; it never reaches our servers.</li>
        <li>We do not use your data to train AI models, and we choose provider settings that don&apos;t allow training on API data.</li>
      </ul>

      <h2>How we use your data</h2>
      <ul>
        <li>To provide the service: scoring jobs, drafting messages, preparing interviews and everything else you ask Offerwing to do.</li>
        <li>To keep the service secure and working, and to enforce fair-use limits.</li>
        <li>We do not sell your data, share it with recruiters or employers, or use it for advertising.</li>
      </ul>

      <h2>Who processes your data</h2>
      <ul>
        <li><strong>Supabase</strong> (database, authentication and file storage)</li>
        <li><strong>Vercel</strong> (hosting)</li>
        <li><strong>Anthropic, OpenAI, Google</strong> (AI processing, depending on your settings)</li>
        <li>Our <strong>inbound email provider</strong> (receiving the job alerts you forward)</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account data stays until you delete it or your account.</li>
        <li>Imported LinkedIn connections not refreshed by a new import within 90 days are deleted automatically, unless you added the person to your referral list.</li>
        <li>Records of forwarded emails are deleted after 30 days.</li>
        <li>When you delete your account, your data, files and stored AI key are permanently deleted.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Export everything as a file, or delete your account, from Settings → Privacy &amp; data.</li>
        <li>Delete imported connections, documents, stored AI keys and any item you created at any time.</li>
        <li>Depending on where you live (for example under GDPR, UK GDPR, CCPA/CPRA or India&apos;s DPDP Act) you may have further rights, such as access, correction, portability and objection. Contact us to exercise them.</li>
      </ul>

      <h2>LinkedIn</h2>
      <p>
        Offerwing is not affiliated with or endorsed by LinkedIn. We never ask for your LinkedIn password, and neither the website nor the
        extension clicks, sends, applies or posts on LinkedIn for you.
      </p>

      <h2>Contact</h2>
      <p>Questions or requests: <a href="mailto:privacy@offerwing.ai">privacy@offerwing.ai</a>.</p>
    </>
  );
}
