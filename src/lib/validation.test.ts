import { describe, expect, it } from "vitest";
import { checkUploadType, cleanUploadPath, matchesSignature } from "./file-types";
import { serverSettingsSchema, signupSchema } from "./validation";

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
    expect("error" in checkUploadType("x.exe", "application/octet-stream")).toBe(true);
  });

  it("never keeps a scriptable type: HTML is stored as plain text", () => {
    expect(checkUploadType("x.html", "text/html")).toEqual({ ext: "html", mime: "text/plain" });
  });

  it("rejects extension / type mismatches", () => {
    expect("error" in checkUploadType("x.png", "image/jpeg")).toBe(true);
  });
});

describe("matchesSignature", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const EXE = enc("MZ\x90\x00\x03\x00\x00\x00");

  it("accepts real files of the claimed type", () => {
    expect(matchesSignature("image/png", PNG)).toBe(true);
    expect(matchesSignature("application/pdf", enc("%PDF-1.7\n"))).toBe(true);
    expect(matchesSignature("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(matchesSignature("text/markdown", enc("# Notes\nhello ✓"))).toBe(true);
  });

  it("rejects renamed executables and mismatched content", () => {
    expect(matchesSignature("image/png", EXE)).toBe(false);
    expect(matchesSignature("application/pdf", PNG)).toBe(false);
    expect(matchesSignature("text/plain", Uint8Array.from([0x4d, 0x5a, 0x00, 0x01]))).toBe(false);
  });
});

describe("serverSettingsSchema", () => {
  it("treats a missing (unchecked) Wi-Fi checkbox as off", () => {
    const r = serverSettingsSchema.safeParse({ name: "Team Shelf", joinMode: "approval" });
    expect(r.success && r.data.lanEnabled).toBe(false);
  });
  it("reads a checked box as on", () => {
    const r = serverSettingsSchema.safeParse({ name: "Team Shelf", joinMode: "open", lanEnabled: "on" });
    expect(r.success && r.data.lanEnabled).toBe(true);
  });
});

describe("code and folder uploads", () => {
  it("stores code files as plain text whatever the browser claims", () => {
    expect(checkUploadType("app.js", "text/javascript")).toEqual({ ext: "js", mime: "text/plain" });
    expect(checkUploadType("index.html", "text/html")).toEqual({ ext: "html", mime: "text/plain" });
    expect(checkUploadType("Dockerfile", "")).toEqual({ ext: "txt", mime: "text/plain" });
  });
  it("refuses .env files and binaries", () => {
    expect("error" in checkUploadType(".env", "")).toBe(true);
    expect("error" in checkUploadType("setup.exe", "application/x-msdownload")).toBe(true);
  });
  it("cleans folder paths and rejects traversal", () => {
    expect(cleanUploadPath("project\\src\\app.js", "app.js")).toBe("project/src/app.js");
    expect(cleanUploadPath("./project//a.txt", "a.txt")).toBe("project/a.txt");
    expect(cleanUploadPath("", "a.txt")).toBe("a.txt");
    expect(cleanUploadPath("../etc/passwd", "passwd")).toBeNull();
    expect(cleanUploadPath("a/\u0000b.txt", "b.txt")).toBeNull();
  });
});
