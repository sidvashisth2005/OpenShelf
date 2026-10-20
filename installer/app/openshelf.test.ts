import { describe, expect, it } from "vitest";
import { highlights, newerThan } from "./openshelf.mjs";

describe("newerThan", () => {
  it("compares numerically, not as strings", () => {
    expect(newerThan("0.10.0", "0.9.9")).toBe(true);
    expect(newerThan("1.0.0", "0.99.99")).toBe(true);
    expect(newerThan("v0.2.0", "0.1.0")).toBe(true);
  });

  it("is false for equal or older versions", () => {
    expect(newerThan("0.1.0", "0.1.0")).toBe(false);
    expect(newerThan("0.1.0", "0.2.0")).toBe(false);
  });
});

describe("highlights", () => {
  it("strips the notify marker and markdown, keeping the first lines", () => {
    const body = "<!-- notify-users -->\n## Shared servers\n- **Join** any server\n- Invite links\n\nMore";
    expect(highlights(body)).toBe("Shared servers\n• Join any server\n• Invite links\nMore");
  });
});
