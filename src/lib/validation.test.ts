import { describe, expect, it } from "vitest";
import { checkUploadType } from "./file-types";
import { signupSchema } from "./validation";

const base = {
  email: "  Person@Example.com ",
  username: "Some_User",
  displayName: "Some User",
  password: "correct horse battery",
  acceptTerms: "on",
};

describe("signupSchema", () => {
  it("normalizes email and username", () => {
    const r = signupSchema.parse(base);
    expect(r.email).toBe("person@example.com");
    expect(r.username).toBe("some_user");
  });

  it("requires accepting the terms", () => {
    expect(signupSchema.safeParse({ ...base, acceptTerms: undefined }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, acceptTerms: "off" }).success).toBe(false);
  });

  it("rejects reserved and malformed usernames", () => {
    for (const username of ["admin", "superadmin", "former-admin-1234", "-bad", "ab", "has space"]) {
      expect(signupSchema.safeParse({ ...base, username }).success, username).toBe(false);
    }
  });

  it("rejects short passwords", () => {
    expect(signupSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
  });

  it("has no role field: extra input is stripped", () => {
    const r = signupSchema.parse({ ...base, role: "super_admin" });
    expect("role" in r).toBe(false);
  });
});

describe("checkUploadType", () => {
  it("accepts allowlisted types with matching extensions", () => {
    expect(checkUploadType("photo.JPG", "image/jpeg")).toEqual({ ext: "jpg", mime: "image/jpeg" });
    expect(checkUploadType("notes.md", "")).toEqual({ ext: "md", mime: "text/markdown" });
  });

  it("rejects scriptable or unknown types", () => {
    expect("error" in checkUploadType("x.svg", "image/svg+xml")).toBe(true);
    expect("error" in checkUploadType("x.html", "text/html")).toBe(true);
    expect("error" in checkUploadType("x.exe", "application/octet-stream")).toBe(true);
  });

  it("rejects extension / type mismatches", () => {
    expect("error" in checkUploadType("x.html", "image/png")).toBe(true);
  });
});
