import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalString,
  // Single-PC installs (setup script / OpenShelf.exe) run production with the embedded database.
  EMBEDDED_DB: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => v === "true"),
  PGLITE_DIR: z.string().default("./.data/pglite"),
  UPLOAD_DIR: z.string().default("./.data/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(2048).default(50),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(90).default(7),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().max(72).default(12),
  SUPER_ADMIN_EMAIL: optionalString,
  SUPER_ADMIN_PASSWORD_HASH_B64: optionalString,
  PLATFORM_NAME: z.string().default("OpenShelf"),
  PLATFORM_CONTACT_EMAIL: optionalString,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  if (Boolean(e.SUPER_ADMIN_EMAIL) !== Boolean(e.SUPER_ADMIN_PASSWORD_HASH_B64)) {
    throw new Error("Set both SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD_HASH_B64, or neither.");
  }
  cached = e;
  return e;
}

/** Decoded super admin config, or null when super admin login is disabled. */
export function superAdminConfig(): { email: string; passwordHash: string } | null {
  const e = env();
  if (!e.SUPER_ADMIN_EMAIL || !e.SUPER_ADMIN_PASSWORD_HASH_B64) return null;
  const passwordHash = Buffer.from(e.SUPER_ADMIN_PASSWORD_HASH_B64, "base64").toString("utf8");
  if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(passwordHash)) {
    throw new Error("SUPER_ADMIN_PASSWORD_HASH_B64 does not decode to a bcrypt hash. Regenerate it with `npm run admin:hash`.");
  }
  return { email: e.SUPER_ADMIN_EMAIL.toLowerCase(), passwordHash };
}
