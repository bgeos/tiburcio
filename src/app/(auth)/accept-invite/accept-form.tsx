"use client";

import { useActionState } from "react";
import { CircleAlert } from "lucide-react";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { acceptInvitation, type AcceptState } from "@/lib/invitations/actions";

export function AcceptForm({
  token,
  needsPassword,
  organizationName,
}: {
  token: string;
  needsPassword: boolean;
  organizationName: string;
}) {
  const [state, formAction, pending] = useActionState(acceptInvitation.bind(null, token), { status: "idle" } as AcceptState);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {needsPassword ? (
        <FieldGroup>
          <TextField
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            description="At least 8 characters, with letters and numbers."
            required
            errors={fieldErrors.password}
          />
          <TextField
            name="confirm"
            label="Repeat password"
            type="password"
            autoComplete="new-password"
            required
            errors={fieldErrors.confirm}
          />
        </FieldGroup>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Joining…" : `Join ${organizationName}`}
      </Button>
    </form>
  );
}
