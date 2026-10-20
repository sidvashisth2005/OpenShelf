import Link from "next/link";
import { AdminPowersSection } from "@/components/legal/admin-powers-section";
import { env } from "@/lib/env";
import { TOS_EFFECTIVE_DATE, TOS_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const { PLATFORM_NAME: name, PLATFORM_CONTACT_EMAIL: contact, SESSION_TTL_DAYS } = env();
  return (
    <article className="prose-legal card mx-auto max-w-3xl p-6 sm:p-12">
      <p className="eyebrow mb-2">Legal</p>
      <h1 className="page-title">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">
        Version {TOS_VERSION} · Effective {TOS_EFFECTIVE_DATE}
      </p>

      <p className="mt-4">
        This policy explains what {name} collects, why, and who can see it. Read it together with our{" "}
        <Link className="link" href="/terms">Terms of Service</Link>.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email address, username, display name, and a one-way hash of your password.</li>
        <li><strong>Content:</strong> the files you upload, with their titles, descriptions, file names, types, sizes, and visibility settings.</li>
        <li><strong>Messages:</strong> what you write to the server admin from the Messages page, and announcements the admin sends.</li>
        <li><strong>Consent records:</strong> which version of the Terms and this policy you accepted, when, and from which IP address and browser.</li>
        <li><strong>Activity logs:</strong> sign-ups, sign-ins, failed sign-in attempts, sign-outs, uploads, edits, and deletions, with time, IP address, and (for sessions) browser user agent.</li>
        <li><strong>Session cookie:</strong> one strictly necessary, HTTP-only cookie that keeps you signed in, for up to {SESSION_TTL_DAYS} days. We use no advertising or tracking cookies.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To run your account and to store and serve your content according to your settings.</li>
        <li>To keep the platform secure: preventing abuse, investigating incidents, and enforcing the Terms.</li>
        <li>To show aggregate statistics (for example, total users and storage used) to the administrator.</li>
      </ul>
      <p>We do not sell your data and we do not use it for advertising.</p>

      <AdminPowersSection id="admin-access" heading="3. Administrator access to your data" />

      <h2>4. Who else can see your data</h2>
      <ul>
        <li>Other users and visitors see only your username, display name, and the content you make public or share by link.</li>
        <li>Hosting and storage providers process data on our behalf to run the service.</li>
        <li>We may disclose data when the law requires it.</li>
      </ul>

      <h2>5. Retention</h2>
      <ul>
        <li>Content stays until you delete it or the administrator removes or deletes it. When content is deleted, the file is erased from storage.</li>
        <li>When <strong>you delete your account</strong> (Settings), all of your content and files are erased, and your email, username, display name, and password hash are scrubbed. An anonymized placeholder record, your consent records, and the activity log (including IP addresses) are kept for security and accountability.</li>
        <li>When the <strong>administrator removes an account</strong>, it is closed and its content is taken out of public view. The account record and activity logs are kept for security and accountability.</li>
        <li>Expired sessions are cleaned up automatically.</li>
      </ul>

      <h2>6. Your choices and rights</h2>
      <ul>
        <li>You can change the visibility of your content, or delete it, at any time from your dashboard.</li>
        <li>Depending on where you live, you may have rights to access, correct, export, or erase your personal data. Contact us to use them.</li>
        <li>You can change your display name and password, or delete your account, at any time from Settings.</li>
        <li>You can withdraw your consent at any time by deleting your account.</li>
      </ul>

      <h2>7. Security</h2>
      <p>
        Passwords are hashed with bcrypt. Session tokens are stored only as hashes. Administrator sessions expire
        quickly, and every administrator action is logged.
      </p>

      <h2>8. Contact</h2>
      <p>{contact ? <>Privacy questions: <a className="link" href={`mailto:${contact}`}>{contact}</a>.</> : "Contact details are available from the platform operator."}</p>
    </article>
  );
}
