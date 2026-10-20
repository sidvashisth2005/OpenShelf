/**
 * Generates the SUPER_ADMIN_PASSWORD_HASH_B64 value for .env.
 *
 *   npm run admin:hash                   (prompts, input hidden)
 *   echo -n "pw" | npm run admin:hash    (reads stdin when not a TTY)
 *
 * The plaintext password is never written anywhere; only the bcrypt hash
 * (base64-encoded, so "$" characters don't trip .env variable expansion) is printed.
 */
import bcrypt from "bcryptjs";
import { askNewPassword } from "./lib/prompt.mjs"; // dependency-free helper shared with setup

async function main() {
  const pw: string = await askNewPassword("Super admin password", 14);
  const hash = await bcrypt.hash(pw, 12);
  console.log("\nAdd this line to your .env (or your host's secret manager):\n");
  console.log(`SUPER_ADMIN_PASSWORD_HASH_B64=${Buffer.from(hash, "utf8").toString("base64")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
