import { z } from "zod";

/**
 * Sign-in form. Shared by the client form and (Phase 2) the server action,
 * which must re-validate. Password strength rules belong to sign-up and
 * invitations, not sign-in.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;
