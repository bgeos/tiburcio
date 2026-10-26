"use client";

import { useActionState } from "react";
import { Info } from "lucide-react";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { parseForm, type FormState } from "@/lib/validation/form";

/**
 * Phase 1: validates input only. Phase 2 swaps `validateOnly` for a server
 * action that re-validates with the same schema and signs in with Supabase.
 */
async function validateOnly(
  _previous: FormState<LoginInput>,
  formData: FormData,
): Promise<FormState<LoginInput>> {
  const result = parseForm(loginSchema, formData);
  if (!result.success) {
    return { status: "invalid", fieldErrors: result.fieldErrors, values: result.values };
  }
  return {
    status: "error",
    message: "Sign-in isn't connected yet. Accounts and organizations arrive in Phase 2.",
    values: { email: result.data.email },
  };
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(validateOnly, { status: "idle" });

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      <FieldGroup>
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          defaultValue={values.email}
          errors={fieldErrors.email}
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          errors={fieldErrors.password}
        />
      </FieldGroup>

      {state.status === "error" ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
