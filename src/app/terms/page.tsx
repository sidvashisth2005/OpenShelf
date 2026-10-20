import Link from "next/link";
import { AdminPowersSection } from "@/components/legal/admin-powers-section";
import { env } from "@/lib/env";
import { TOS_EFFECTIVE_DATE, TOS_VERSION } from "@/lib/legal";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const { PLATFORM_NAME: name, PLATFORM_CONTACT_EMAIL: contact, MAX_UPLOAD_MB } = env();
  return (
    <article className="prose-legal card mx-auto max-w-3xl p-6 sm:p-12">
      <p className="eyebrow mb-2">Legal</p>
      <h1 className="page-title">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">
        Version {TOS_VERSION} · Effective {TOS_EFFECTIVE_DATE}
      </p>

      <h2>1. About these terms</h2>
      <p>
        These Terms govern your use of {name} (the &quot;platform&quot;), a service where registered users can upload,
        publish, and manage content. By creating an account you agree to these Terms and to our{" "}
        <Link className="link" href="/privacy">Privacy Policy</Link>. If you do not agree, do not create an account.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must give a valid email address and keep your password secret. You are responsible for activity on your account.</li>
        <li>One person per account. You may not impersonate anyone or pick a username that suggests you are platform staff.</li>
        <li>You may stop using the platform at any time. You can delete your own content from your dashboard, or your whole account from Settings.</li>
      </ul>

      <h2>3. Your content</h2>
      <ul>
        <li>You keep ownership of what you upload. You grant us a licence to store, process, and display it as needed to run the platform according to the visibility you choose.</li>
        <li>
          Visibility settings: <strong>public</strong> content appears in listings and on your profile; <strong>unlisted</strong>{" "}
          content is reachable by anyone with the link; <strong>private</strong> content is visible only to you and to the
          administrator (see section 5).
        </li>
        <li>Allowed file types are images, audio, video, PDF, and plain text/Markdown, up to {MAX_UPLOAD_MB} MB per file.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You must not upload or share content that:</p>
      <ul>
        <li>is illegal, or infringes someone else&apos;s copyright, trademark, privacy, or other rights;</li>
        <li>sexually exploits minors, promotes violence or terrorism, or harasses, threatens, or doxxes anyone;</li>
        <li>contains malware, or is meant to disrupt the platform or other users;</li>
        <li>is spam, or misleads people about who you are.</li>
      </ul>

      <AdminPowersSection id="admin-powers" heading="5. Administrator powers and your consent" />

      <h2>6. Moderation and enforcement</h2>
      <p>
        If content or an account breaks these Terms or the law, or puts the platform or its users at risk, the
        administrator may remove the content, suspend the account, or remove the account, as described in section 5.
        Where practical, the reason is recorded and shown to you.
      </p>

      <h2>7. Open-source software</h2>
      <p>
        The platform&apos;s software is open source. Its licence covers the code only. It gives no rights over content
        that other users upload.
      </p>

      <h2>8. Disclaimers and liability</h2>
      <p>
        The platform is provided &quot;as is&quot;, without warranties of any kind. Keep your own backups of anything you
        upload. To the extent the law allows, we are not liable for lost data or for indirect or consequential damages.
      </p>

      <h2>9. Changes to these terms</h2>
      <p>
        We may update these Terms; the version and effective date at the top of this page show the current text.
        Your consent to administrator access is given once, at sign-up, and you will not be asked to accept again.
        If you do not agree with an update, you can delete your account at any time from Settings.
      </p>

      <h2>10. Contact</h2>
      <p>{contact ? <>Questions about these Terms: <a className="link" href={`mailto:${contact}`}>{contact}</a>.</> : "Contact details are available from the platform operator."}</p>
    </article>
  );
}
