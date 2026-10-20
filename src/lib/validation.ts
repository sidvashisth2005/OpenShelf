import { z } from "zod";

// Handles that could be mistaken for staff accounts are never available.
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "superadmin", "super-admin", "root", "system", "moderator", "mod",
  "staff", "support", "help", "security", "official", "api", "login", "signup", "settings",
]);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address."));

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/, "3–30 characters: letters, numbers, - and _, not at the start or end.")
  .refine(
    (u) => !RESERVED_USERNAMES.has(u) && !u.startsWith("former-admin") && !u.startsWith("deleted-"),
    "That username is reserved.",
  );

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(60),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password." });

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm.").max(128),
  confirm: z.literal("DELETE", { error: 'Type DELETE to confirm.' }),
});

export const signupSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Enter a display name.").max(60),
  password: passwordSchema,
  acceptTerms: z.literal("on", {
    error: "You must accept the Terms of Service and Privacy Policy to create an account.",
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const contentFieldsSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(140),
  description: z.string().trim().max(5000).default(""),
  visibility: z.enum(["public", "unlisted", "private"]),
  status: z.enum(["published", "draft"]),
});

export const reasonSchema = z
  .string()
  .trim()
  .min(3, "Give a short reason (it's shown to the user and logged).")
  .max(500);

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export const setupSchema = z.object({
  serverName: z.string().trim().min(2, "Give your server a name.").max(60),
  email: emailSchema,
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Enter your name.").max(60),
  password: passwordSchema,
  acceptTerms: z.literal("on", { error: "Accept the Terms of Service and Privacy Policy to continue." }),
});

export const serverSettingsSchema = z.object({
  name: z.string().trim().min(2, "Give your server a name.").max(60),
  joinMode: z.enum(["open", "invite", "approval"]),
  // An unchecked checkbox sends nothing at all, so the key must be optional.
  lanEnabled: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export const inviteSchema = z.object({
  note: z.string().trim().max(80).default(""),
  maxUses: z.coerce.number().int().min(0).max(1000).default(0),
  expiresInDays: z.coerce.number().int().min(0).max(365).default(7),
});
