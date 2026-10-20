/**
 * Generates the SUPER_ADMIN_PASSWORD_HASH_B64 value for .env.
 *
 *   npm run admin:hash            (prompts, input hidden)
 *   echo -n "pw" | npm run admin:hash   (reads stdin when not a TTY)
 *
 * The plaintext password is never written anywhere; only the bcrypt hash
 * (base64-encoded, so "$" characters don't trip .env variable expansion) is printed.
 */
import bcrypt from "bcryptjs";

async function readHidden(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const c of stdin) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
  }
  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") {
          stdin.setRawMode(false);
          return reject(new Error("Cancelled"));
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const pw = await readHidden("Super admin password: ");
  if (pw.length < 14) {
    console.error("Use at least 14 characters for the super admin password.");
    process.exit(1);
  }
  if (process.stdin.isTTY) {
    const again = await readHidden("Repeat password: ");
    if (again !== pw) {
      console.error("Passwords don't match.");
      process.exit(1);
    }
  }
  const hash = await bcrypt.hash(pw, 12);
  console.log("\nAdd this line to your .env (or your host's secret manager):\n");
  console.log(`SUPER_ADMIN_PASSWORD_HASH_B64=${Buffer.from(hash, "utf8").toString("base64")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
