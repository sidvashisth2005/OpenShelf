// Minimal .env editing helpers (no dependencies).

/** Returns the value of KEY in .env text, or undefined when missing/empty. */
export function getEnvVar(text, key) {
  const m = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  const v = m?.[1]?.trim();
  return v ? v : undefined;
}

/** Sets KEY=value in .env text, replacing an existing line or appending one. */
export function setEnvVar(text, key, value) {
  if (/[\r\n]/.test(value)) throw new Error(`Refusing to write a multi-line value for ${key}`);
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, () => line);
  return `${text.replace(/\s*$/, "")}\n${line}\n`;
}
