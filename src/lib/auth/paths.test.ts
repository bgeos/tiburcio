import { describe, expect, it } from "vitest";
import { DEFAULT_SIGNED_IN_PATH, isPublicPath, safeNextPath } from "./paths";

describe("isPublicPath", () => {
  it("allows only the login page and auth routes", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/login-help")).toBe(false);
    expect(isPublicPath("/authority")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/projects")).toBe("/projects");
    expect(safeNextPath("/projects/abc/def?tab=materials")).toBe("/projects/abc/def?tab=materials");
  });

  it.each([
    undefined,
    null,
    42,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "projects",
    "/login",
    "/login?next=/x",
  ])("falls back to the default for %j", (value) => {
    expect(safeNextPath(value)).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
