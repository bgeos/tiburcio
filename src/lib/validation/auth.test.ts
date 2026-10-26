import { describe, expect, it } from "vitest";
import { loginSchema } from "./auth";
import { parseForm } from "./form";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("loginSchema via parseForm", () => {
  it("accepts a valid email and password, trimming the email", () => {
    const result = parseForm(
      loginSchema,
      form({ email: "  manager@example.com ", password: "secret" }),
    );
    expect(result).toEqual({
      success: true,
      data: { email: "manager@example.com", password: "secret" },
    });
  });

  it("reports a missing email and password with friendly messages", () => {
    const result = parseForm(loginSchema, form({ email: "", password: "" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.email).toEqual(["Enter your email address."]);
    expect(result.fieldErrors.password).toEqual(["Enter your password."]);
  });

  it("rejects a malformed email and echoes submitted values", () => {
    const result = parseForm(loginSchema, form({ email: "not-an-email", password: "x" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.email).toEqual(["Enter a valid email address."]);
    expect(result.fieldErrors.password).toBeUndefined();
    expect(result.values.email).toBe("not-an-email");
  });
});
