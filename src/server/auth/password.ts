import "server-only";
import bcrypt from "bcryptjs";

const COST = 12;

// Compared against when the account doesn't exist, so a failed lookup costs the
// same time as a wrong password (no user enumeration through timing).
let dummyHash: Promise<string> | undefined;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    dummyHash ??= bcrypt.hash("timing-equalizer", COST);
    await bcrypt.compare(plain, await dummyHash);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
