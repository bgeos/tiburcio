"use client";

import { useActionState, useState } from "react";
import { CircleAlert, CircleCheck, Copy, Send } from "lucide-react";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/domain/roles";
import { inviteMember, type InviteState } from "@/lib/invitations/actions";

export function InviteForm({ orgSlug, roles }: { orgSlug: string; roles: OrgRole[] }) {
  const [state, formAction, pending] = useActionState(inviteMember.bind(null, orgSlug), { status: "idle" } as InviteState);
  const [role, setRole] = useState<OrgRole>(roles.includes("member") ? "member" : roles[0]);
  const [copied, setCopied] = useState(false);

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : {};

  return (
    <div className="space-y-4">
      <form action={formAction} noValidate className="flex flex-wrap items-start gap-3">
        <div className="min-w-64 flex-1">
          {/* key: clear the field after a successful invite */}
          <TextField
            key={state.status === "sent" || state.status === "share" ? state.email : "draft"}
            name="email"
            label="Email"
            type="email"
            autoComplete="off"
            required
            defaultValue={values.email}
            errors={fieldErrors.email}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <input type="hidden" name="role" value={role} />
          <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
            <SelectTrigger id="invite-role" className="w-56" aria-invalid={fieldErrors.role ? true : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ORG_ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.role ? <p className="text-sm text-destructive">{fieldErrors.role[0]}</p> : null}
        </div>
        <Button type="submit" className="mt-[1.375rem]" disabled={pending}>
          <Send aria-hidden="true" /> {pending ? "Inviting…" : "Send invitation"}
        </Button>
      </form>

      <div aria-live="polite">
        {state.status === "error" ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {state.message}
          </p>
        ) : null}
        {state.status === "sent" ? (
          <p className="flex items-start gap-2 rounded-lg border border-status-done/40 bg-status-done-soft p-3 text-sm text-status-done">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Invitation email sent to {state.email}. The link works for 7 days.
          </p>
        ) : null}
        {state.status === "share" ? (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
            <p className="flex items-start gap-2">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {state.reason === "existing_account"
                ? `Invitation created. ${state.email} already has a JupiGenio account, so no email was sent: share this link with them.`
                : `Invitation created, but the email couldn't be sent. Share this link with ${state.email}.`}{" "}
              It works for 7 days and only for that email address.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs text-foreground" data-testid="invite-link">
                {state.link}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.link);
                  setCopied(true);
                }}
              >
                <Copy aria-hidden="true" /> {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
