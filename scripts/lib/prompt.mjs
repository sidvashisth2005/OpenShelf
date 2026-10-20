// Tiny terminal prompts with no dependencies (usable before `npm install`).
import readline from "node:readline";

/** Asks a question and returns the trimmed answer. */
export function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Reads a line without echoing it (falls back to plain stdin when not a TTY). */
export async function askHidden(question) {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    const chunks = [];
    for await (const c of stdin) chunks.push(c);
    // Windows PowerShell 5.1 prefixes piped stdin with a UTF-8 BOM.
    return Buffer.concat(chunks).toString("utf8").replace(/^ÿ/, "").replace(/\r?\n$/, "");
  }
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const done = (fn) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      fn();
    };
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n") return done(() => resolve(value));
        if (c === "\u0003") return done(() => reject(new Error("Cancelled")));
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

/** Prompts for a new password twice (TTY only) and enforces a minimum length. */
export async function askNewPassword(label, minLength) {
  for (;;) {
    const pw = await askHidden(`${label}: `);
    if (pw.length < minLength) {
      console.error(`  Use at least ${minLength} characters.`);
      if (!process.stdin.isTTY) throw new Error("Password too short.");
      continue;
    }
    if (!process.stdin.isTTY) return pw;
    if ((await askHidden("Repeat password: ")) === pw) return pw;
    console.error("  Passwords don't match, try again.");
  }
}
