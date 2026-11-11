import { z } from "zod";
import { ORG_ROLES, type OrgRole } from "@/lib/domain/roles";

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter an email address.")
    .pipe(z.email("Enter a valid email address."))
    .transform((email) => email.toLowerCase()),
  role: z.enum(ORG_ROLES, "Choose a role."),
});

export type InviteInput = z.input<typeof inviteSchema>;

/** Roles a person may hand out (mirrors the invitations RLS policy). */
export function invitableRoles(inviterRole: OrgRole): OrgRole[] {
  if (inviterRole === "admin") return [...ORG_ROLES];
  if (inviterRole === "production_manager") return ["member", "external"];
  return [];
}

/** Same rule as Supabase Auth (supabase/config.toml): ≥ 8 characters, letters and digits. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Use at most 72 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

export type NewPasswordInput = z.input<typeof newPasswordSchema>;
