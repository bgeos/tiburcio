import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogOut, MailQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/auth/actions";
import { requireUser } from "@/lib/dal/auth";
import { getMyMemberships } from "@/lib/dal/organizations";

export const metadata: Metadata = { title: "No organization yet" };

/** Signed in, but not a member of any organization (D-021: invitation-only). */
export default function NoOrganizationPage() {
  return (
    <Card>
      <CardHeader>
        <span className="mb-2 grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <MailQuestion aria-hidden="true" className="size-5" />
        </span>
        <CardTitle>
          <h1 className="text-xl font-semibold">You&apos;re not in an organization yet</h1>
        </CardTitle>
        <CardDescription>
          JupiGenio is invitation-only. An admin or production manager of your organization has
          to invite you before you can see its projects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <Details />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function Details() {
  const user = await requireUser();
  const memberships = await getMyMemberships();

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Ask them to invite <span className="font-medium break-all">{user.email}</span>, then open the
        link in the invitation email.
      </p>
      <div className="flex flex-wrap gap-2">
        {memberships.length > 0 ? (
          <Button asChild>
            <Link href="/">Go to {memberships[0].name}</Link>
          </Button>
        ) : null}
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
