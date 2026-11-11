"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { parseForm, type FormState } from "@/lib/validation/form";

/** Sign in with email + password. Re-validates on the server with the shared schema. */
export async function signIn(
  _previous: FormState<LoginInput>,
  formData: FormData,
): Promise<FormState<LoginInput>> {
  const result = parseForm(loginSchema, formData);
  if (!result.success) {
    return { status: "invalid", fieldErrors: result.fieldErrors, values: { email: result.values.email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) {
    // One message for unknown email and wrong password, so the form doesn't reveal who has an account.
    const message =
      error.code === "invalid_credentials"
        ? "Email or password is incorrect."
        : error.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : "Couldn't sign in right now. Try again in a moment.";
    return { status: "error", message, values: { email: result.data.email } };
  }

  // `next` falls back to Tibúrcio's Home (`/`).
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // This device only; other devices stay signed in.
  await supabase.auth.signOut({ scope: "local" });
  redirect(LOGIN_PATH);
}
