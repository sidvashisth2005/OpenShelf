/**
 * Single source of truth for the Terms of Service / Privacy Policy version and
 * the administrator-access disclosure. Consent is collected exactly once, at
 * sign-up; TOS_VERSION is recorded with it so you know which text each user
 * agreed to. Changing it never prompts existing users again.
 */
export const TOS_VERSION = "2026-10-20";
export const TOS_EFFECTIVE_DATE = "20 October 2026";

/**
 * Short form shown right next to the signup checkbox. The full text lives in
 * the Terms of Service and Privacy Policy pages.
 */
export const ADMIN_ACCESS_SUMMARY = [
  "The platform's administrator can view and access every account and all uploaded content, including content you mark as private or unlisted.",
  "The administrator can moderate or remove any content, and suspend or remove any account, under these Terms.",
  "Account activity (sign-ins, uploads, edits, deletions) and administrator actions are logged and monitored.",
  "By accepting, you consent to this access once. You will not be asked again for each individual action.",
] as const;

/** Full administrator-powers disclosure, rendered in both legal pages. */
export const ADMIN_POWERS = [
  {
    title: "Access to all accounts and content",
    body: "The platform administrator (the \"Super Admin\") can view your profile details (email address, username, display name, account status, sign-up and last sign-in times) and can open, view, and download any content you upload, whatever its visibility setting (public, unlisted, or private) or status (published, draft, or removed). \"Private\" means hidden from other users and the public. It does not mean hidden from the administrator.",
  },
  {
    title: "Moderation and removal of content",
    body: "The administrator can remove any content from public view, restore it, or permanently delete it, including the stored file. Removed content shows the reason the administrator recorded.",
  },
  {
    title: "Account management",
    body: "The administrator can suspend your account, which signs you out everywhere and blocks sign-in, or remove it, which closes the account and takes all of its content out of public view.",
  },
  {
    title: "Activity logging and monitoring",
    body: "We record an activity log of security-relevant events: sign-ups, sign-ins and failed sign-in attempts, uploads, edits and deletions. Entries can include your IP address and browser user agent. Every administrator action is logged too, including each time the administrator opens content that is not public. The administrator reviews these logs and aggregate platform statistics on a monitoring dashboard.",
  },
  {
    title: "What the administrator cannot see",
    body: "Passwords are stored only as one-way bcrypt hashes. Nobody, including the administrator, can read your password.",
  },
  {
    title: "One-time consent",
    body: "You give your consent to the access described in this section once, when you accept these Terms at sign-up. It is not requested again: the administrator does not ask for separate permission before each individual action, and you will not be asked to accept again later. If you do not agree, do not create an account. You can withdraw at any time by deleting your account.",
  },
] as const;
