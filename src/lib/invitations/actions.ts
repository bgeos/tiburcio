"use server";

import { createHash, randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { getMembership } from "@/lib/dal/organizations";
import { createAdminClient, getSiteUrl } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseForm, type FieldErrors } from "@/lib/validation/form";
import { invitableRoles, inviteSchema, newPasswordSchema } from "@/lib/validation/invitations";

export type InviteState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  /** Supabase emailed a link to a new person. */
  | { status: "sent"; email: string }
  /** No email was sent (existing account, or sending failed): share this link instead. */
  | { status: "share"; email: string; link: string; reason: "existing_account" | "email_failed" };

/** Invite someone to `orgSlug`. Bound to the organization by the Team page. */
export async function inviteMember(orgSlug: string, _previous: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = parseForm(inviteSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const { email, role } = parsed.data;
  const values = { email, role };

  // Authorize in code for clear messages; RLS enforces the same rule on insert.
  await requireUser();
  const membership = await getMembership(orgSlug);
  if (!membership || invitableRoles(membership.role).length === 0) {
    return { status: "error", message: "You can't invite people to this organization.", values };
  }
  if (!invitableRoles(membership.role).includes(role)) {
    return { status: "invalid", fieldErrors: { role: ["You can invite members and external collaborators only."] }, values };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("organization_members")
    .select("user_id, profiles!organization_members_user_id_fkey!inner(email)")
    .eq("organization_id", membership.id)
    .eq("profiles.email", email)
    .limit(1);
  if (existing && existing.length > 0) {
    return { status: "invalid", fieldErrors: { email: ["This person is already a member."] }, values };
  }

  // The token goes in the link only; the database keeps its SHA-256 hash.
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error: insertError } = await supabase
    .from("invitations")
    .insert({ organization_id: membership.id, email, role, token_hash: tokenHash });
  if (insertError) {
    if (insertError.code === "23505") {
      return {
        status: "invalid",
        fieldErrors: { email: ["There's already an open invitation for this email. Revoke it to send a new one."] },
        values,
      };
    }
    return { status: "error", message: "Couldn't create the invitation. Try again.", values };
  }

  const site = getSiteUrl();
  const acceptPath = `/accept-invite?token=${token}`;
  refresh();

  // New people: Supabase creates the account and emails a sign-in link that
  // lands on /auth/confirm, then /accept-invite. People with an account already
  // can't be emailed by Supabase Auth, so they get a link to share instead.
  const { error: emailError } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/auth/confirm?next=${encodeURIComponent(acceptPath)}`,
    data: { needs_password: true, organization_name: membership.name },
  });
  if (!emailError) return { status: "sent", email };
  return {
    status: "share",
    email,
    link: `${site}${acceptPath}`,
    reason: emailError.code === "email_exists" ? "existing_account" : "email_failed",
  };
}

/** Revoke an open invitation. RLS decides who may (admins; PMs for member/external). */
export async function revokeInvitation(invitationId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitationId);
  refresh();
}

export type AcceptState = { status: "idle" } | { status: "error"; message: string; fieldErrors?: FieldErrors };

const ACCEPT_ERRORS: Record<string, string> = {
  invitation_not_found: "This invitation link isn't valid.",
  invitation_revoked: "This invitation was cancelled. Ask for a new one.",
  invitation_used: "This invitation has already been used.",
  invitation_expired: "This invitation has expired. Ask for a new one.",
  invitation_wrong_account: "This invitation is for a different email address.",
};

/** Join the organization. New accounts choose their password in the same step. */
export async function acceptInvitation(token: string, _previous: AcceptState, formData: FormData): Promise<AcceptState> {
  await requireUser();
  const supabase = await createClient();

  // Re-read the account rather than trusting the form about whether a password is needed.
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.user_metadata?.needs_password === true) {
    const parsed = parseForm(newPasswordSchema, formData);
    if (!parsed.success) return { status: "error", message: "Check your password.", fieldErrors: parsed.fieldErrors };
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { needs_password: false },
    });
    if (error) {
      return {
        status: "error",
        message: error.code === "weak_password" ? "Choose a stronger password." : "Couldn't save your password. Try again.",
      };
    }
  }

  const { data: slug, error } = await supabase.rpc("accept_invitation", { invite_token: token });
  if (error || typeof slug !== "string") {
    return { status: "error", message: ACCEPT_ERRORS[error?.message ?? ""] ?? "Couldn't accept the invitation. Try again." };
  }
  redirect(`/${slug}/dashboard`);
}
