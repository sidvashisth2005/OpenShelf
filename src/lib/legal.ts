/**
 * Single source of truth for the Terms of Service / Privacy Policy version and
 * the administrator-access disclosure. Consent is collected exactly once, at
 * sign-up (or at server setup for the owner); TOS_VERSION is recorded with it
 * so you know which text each user agreed to. Changing it never prompts
 * existing users again.
 */
export const TOS_VERSION = "2026-10-20.3";
export const TOS_EFFECTIVE_DATE = "20 October 2026";

/**
 * Short form shown right next to the sign-up checkbox. The full text lives in
 * the Terms of Service and Privacy Policy pages.
 */
export const ADMIN_ACCESS_SUMMARY = [
  "This server's admin (the person who runs it) and the OpenShelf platform administrator can view and access your account and everything you upload, including content you mark as private or unlisted.",
  "They can moderate or remove content, and suspend or remove accounts, under these Terms.",
  "Account activity (sign-ins, uploads, edits, deletions) and administrator actions are logged and monitored.",
  "By accepting, you consent to this access once. You will not be asked again for each individual action.",
] as const;

/** Full administrator-powers disclosure, rendered in both legal pages. */
export const ADMIN_POWERS = [
  {
    title: "Who the administrators are",
    body: "Each OpenShelf server is run by its owner, the \"Server Admin\": the person who installed it and invited you. The OpenShelf platform is run by the \"Super Admin\". Both are called \"the administrators\" below, and both have the powers described in this section.",
  },
  {
    title: "Access to all accounts and content",
    body: "The administrators can view your profile details (email address, username, display name, account status, sign-up and last sign-in times) and can open, view, and download any content you upload, whatever its visibility setting (public, unlisted, or private) or status (published, draft, or removed). \"Private\" means hidden from other members and the public. It does not mean hidden from the administrators. Your content is also stored on the Server Admin's computer.",
  },
  {
    title: "Moderation and removal of content",
    body: "The administrators can remove any content from public view, restore it, or permanently delete it, including the stored file. Removed content shows the reason that was recorded.",
  },
  {
    title: "Account management",
    body: "The administrators can approve or reject requests to join, suspend your account (which signs you out everywhere and blocks sign-in), or remove it (which closes the account and takes all of its content out of public view). A Server Admin cannot suspend or remove the Super Admin.",
  },
  {
    title: "Activity logging and monitoring",
    body: "We record an activity log of security-relevant events: sign-ups, sign-ins and failed sign-in attempts, uploads, edits and deletions. Entries can include your IP address and browser user agent. Every administrator action is logged too, including each time an administrator opens content that is not public. The administrators review these logs and server statistics on a monitoring dashboard.",
  },
  {
    title: "What the administrators cannot see",
    body: "Passwords are stored only as one-way bcrypt hashes. Nobody, including the administrators, can read your password.",
  },
  {
    title: "Super Admin panel and remote access",
    body: "When this server is online, it sends a summary to the Super Admin panel about once a minute: the server name and version, member details (username, display name, email address, role, status, last sign-in), and a list of content (title, owner, type, size, visibility, status, upload date). File contents are not sent. While the server is online, it is also reachable through a private internet link that only the Super Admin can open, so the Super Admin can sign in to it remotely with the powers described above. Each of those sign-ins is recorded in the activity log.",
  },
  {
    title: "One-time consent",
    body: "You give your consent to the access described in this section once, when you accept these Terms at sign-up. It is not requested again: the administrators do not ask for separate permission before each individual action, and you will not be asked to accept again later. If you do not agree, do not create an account. You can withdraw at any time by deleting your account.",
  },
] as const;
