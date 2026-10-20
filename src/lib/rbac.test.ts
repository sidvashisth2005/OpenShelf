import { describe, expect, it } from "vitest";
import { can, canView, hasPermission, PERMISSIONS, permissionsFor, type Principal } from "./rbac";

const user: Principal = { id: "u1", role: "user", status: "active" };
const other: Principal = { id: "u2", role: "user", status: "active" };
const admin: Principal = { id: "a1", role: "super_admin", status: "active" };
const suspended: Principal = { id: "u1", role: "user", status: "suspended" };

const item = (over: Partial<Parameters<typeof canView>[1]> = {}) => ({
  ownerId: "u1",
  visibility: "public" as const,
  status: "published" as const,
  ...over,
});

describe("permissions", () => {
  it("gives the super admin every permission", () => {
    expect([...permissionsFor("super_admin")].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("gives regular users only own-content permissions", () => {
    for (const p of permissionsFor("user")) expect(p.startsWith("content:") && !p.endsWith(":any")).toBe(true);
    expect(hasPermission(user, "admin:dashboard")).toBe(false);
    expect(hasPermission(user, "content:read:any")).toBe(false);
    expect(hasPermission(user, "user:suspend")).toBe(false);
  });

  it("denies everything to non-active principals and anonymous visitors", () => {
    expect(hasPermission(suspended, "content:create")).toBe(false);
    expect(hasPermission({ ...admin, status: "suspended" }, "admin:dashboard")).toBe(false);
    expect(hasPermission(null, "content:create")).toBe(false);
  });
});

describe("can(update|delete)", () => {
  it("lets owners edit and delete their own content", () => {
    expect(can(user, "update", item())).toBe(true);
    expect(can(user, "delete", item())).toBe(true);
  });

  it("blocks other users", () => {
    expect(can(other, "update", item())).toBe(false);
    expect(can(other, "delete", item())).toBe(false);
  });

  it("lets admins delete but never edit someone else's content", () => {
    expect(can(admin, "delete", item())).toBe(true);
    expect(can(admin, "update", item())).toBe(false);
  });

  it("blocks suspended owners", () => {
    expect(can(suspended, "update", item())).toBe(false);
  });
});

describe("canView", () => {
  it("shows published public and unlisted content to anyone", () => {
    expect(canView(null, item())).toBe(true);
    expect(canView(null, item({ visibility: "unlisted" }))).toBe(true);
  });

  it("hides private and draft content from everyone but the owner and admin", () => {
    for (const it_ of [item({ visibility: "private" }), item({ status: "draft" })]) {
      expect(canView(null, it_)).toBe(false);
      expect(canView(other, it_)).toBe(false);
      expect(canView(user, it_)).toBe(true);
      expect(canView(admin, it_)).toBe(true);
    }
  });

  it("shows removed content only to its owner (to see the reason) and admin", () => {
    const removed = item({ status: "removed" });
    expect(canView(null, removed)).toBe(false);
    expect(canView(other, removed)).toBe(false);
    expect(canView(user, removed)).toBe(true);
    expect(canView(admin, removed)).toBe(true);
  });
});
