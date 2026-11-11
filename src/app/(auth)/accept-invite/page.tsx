import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleAlert, LogOut, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/auth/actions";
import { requireUser } from "@/lib/dal/auth";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/domain/roles";
import { createClient } from "@/lib/supabase/server";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Accept invitation" };

/**
 * /accept-invite?token=… — reached from the invitation email (via /auth/confirm,
 * which signs new people in) or from a shared link (existing accounts sign in first;
 * the proxy keeps the token in ?next=).
 */
export default function AcceptInvitePage({ searchParams }: PageProps<"/accept-invite">) {
  return (
    <Card>
      <Suspense fallback={<Skeleton className="m-6 h-40" />}>
        <AcceptInvite searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}

type Preview = { organization_name: string; organization_slug: string; role: OrgRole; email: string; status: string };

const STATUS_MESSAGES: Record<string, string> = {
  expired: "This invitation has expired. Ask the person who invited you for a new one.",
  revoked: "This invitation was cancelled. Ask the person who invited you for a new one.",
  accepted: "This invitation has already been used.",
};

async function AcceptInvite({ searchParams }: { searchParams: PageProps<"/accept-invite">["searchParams"] }) {
  const { token } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const preview =
    typeof token === "string" && token
      ? ((await supabase.rpc("invitation_preview", { invite_token: token }).maybeSingle()).data as Preview | null)
      : null;

  if (!preview || preview.status !== "open") {
    const message = preview ? STATUS_MESSAGES[preview.status] : "This invitation link isn't valid.";
    return (
      <Problem title="Can't use this invitation" message={message ?? "This invitation link isn't valid."}>
        <Button asChild variant="outline">
          <Link href="/">Go to JupiGenio</Link>
        </Button>
      </Problem>
    );
  }

  if (preview.email !== user.email.toLowerCase()) {
    return (
      <Problem
        title="This invitation is for someone else"
        message={`It was sent to ${preview.email}, but you're signed in as ${user.email}. Sign out, then open the link again and sign in with ${preview.email}.`}
      >
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </form>
      </Problem>
    );
  }

  const { data: auth } = await supabase.auth.getUser();
  const needsPassword = auth.user?.user_metadata?.needs_password === true;

  return (
    <>
      <CardHeader>
        <span className="mb-2 grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <MailCheck aria-hidden="true" className="size-5" />
        </span>
        <CardTitle>
          <h1 className="text-xl font-semibold">Join {preview.organization_name}</h1>
        </CardTitle>
        <CardDescription>
          You&apos;ve been invited as <span className="font-medium text-foreground">{ORG_ROLE_LABELS[preview.role]}</span>{" "}
          ({user.email}).
          {needsPassword ? " Choose a password to finish setting up your account." : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptForm token={token as string} needsPassword={needsPassword} organizationName={preview.organization_name} />
      </CardContent>
    </>
  );
}

function Problem({ title, message, children }: { title: string; message: string; children: React.ReactNode }) {
  return (
    <>
      <CardHeader>
        <span className="mb-2 grid size-10 place-items-center rounded-lg bg-warning-soft text-warning">
          <CircleAlert aria-hidden="true" className="size-5" />
        </span>
        <CardTitle>
          <h1 className="text-xl font-semibold">{title}</h1>
        </CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </>
  );
}
