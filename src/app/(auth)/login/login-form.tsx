"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { signIn } from "@/lib/auth/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, { status: "idle" });
  // Where to go after signing in; the server action only accepts same-site paths.
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const badLink = searchParams.get("error") === "link";

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      <input type="hidden" name="next" value={next} />
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

      {badLink && state.status === "idle" ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          That link is invalid or has expired. Ask the person who invited you for a new one.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
