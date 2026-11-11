import { describe, expect, it } from "vitest";
import { invitableRoles, inviteSchema, newPasswordSchema } from "./invitations";

describe("inviteSchema", () => {
  it("normalises the email", () => {
    expect(inviteSchema.parse({ email: "  Ana@Example.COM ", role: "member" })).toEqual({
      email: "ana@example.com",
      role: "member",
    });
  });

  it("rejects bad input", () => {
    expect(inviteSchema.safeParse({ email: "nope", role: "member" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@example.com", role: "owner" }).success).toBe(false);
  });
});

describe("invitableRoles", () => {
  it("mirrors the database rule", () => {
    expect(invitableRoles("admin")).toEqual(["admin", "production_manager", "member", "external"]);
    expect(invitableRoles("production_manager")).toEqual(["member", "external"]);
    expect(invitableRoles("member")).toEqual([]);
    expect(invitableRoles("external")).toEqual([]);
  });
});

describe("newPasswordSchema", () => {
  it.each([
    ["short1", "Use at least 8 characters."],
    ["onlyletters", "Include at least one number."],
    ["12345678", "Include at least one letter."],
  ])("rejects %s", (password, message) => {
    const result = newPasswordSchema.safeParse({ password, confirm: password });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });

  it("requires matching confirmation", () => {
    const result = newPasswordSchema.safeParse({ password: "festival2027", confirm: "festival2028" });
    expect(result.error?.issues[0].path).toEqual(["confirm"]);
  });

  it("accepts a valid password", () => {
    expect(newPasswordSchema.safeParse({ password: "festival2027", confirm: "festival2027" }).success).toBe(true);
  });
});
