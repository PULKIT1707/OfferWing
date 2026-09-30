import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service · Offerwing" };

const UPDATED = "September 25, 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted">Last updated {UPDATED}</p>
      <p>These terms govern your use of Offerwing&apos;s website, dashboard and browser extension (the &ldquo;service&rdquo;). By creating an account you agree to them.</p>

      <h2>The service</h2>
      <ul>
        <li>Offerwing provides AI-assisted tools for your job search. It prepares drafts, scores and plans; <strong>you</strong> decide what to send, submit or post, and you do it yourself.</li>
        <li>The service is currently free. If you bring your own AI key, your AI provider bills you directly for that usage under their terms.</li>
        <li>Starter mode includes daily limits that we may change to keep the service sustainable.</li>
      </ul>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Give accurate information and upload only documents you have the right to use.</li>
        <li>Review everything before you use it. AI output can be wrong or incomplete. You are responsible for the accuracy of what you send to employers and contacts, including resumes and messages.</li>
        <li>Use LinkedIn and other services in line with their terms. Don&apos;t use Offerwing to spam, mass-message, scrape or automate actions on other services.</li>
        <li>Keep your account secure and any AI key you add protected, for example with a spending limit.</li>
      </ul>

      <h2>No guarantees</h2>
      <p>
        We work hard to help, but we can&apos;t guarantee interviews, offers or any outcome, or that fit scores, salary guidance or other AI
        output are accurate. The service is provided &ldquo;as is&rdquo;.
      </p>

      <h2>Your content</h2>
      <p>
        You own your content. You give us permission to store and process it only to provide the service to you, including sending it to the
        AI provider your settings select. See the <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Ending your use</h2>
      <p>You can delete your account at any time from Settings. We may suspend accounts that abuse the service or break these terms.</p>

      <h2>Liability</h2>
      <p>To the fullest extent the law allows, Offerwing is not liable for indirect or consequential losses, or for decisions you make based on the service.</p>

      <h2>Changes</h2>
      <p>We&apos;ll post updates here and tell you about material changes before they take effect.</p>

      <h2>Contact</h2>
      <p><a href="mailto:hello@offerwing.app">hello@offerwing.app</a></p>
    </>
  );
}
