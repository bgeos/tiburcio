import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/dal/auth";
import { AccountMenuButton } from "./account-menu-button";

/**
 * Signed-in person's menu. Reads the session, so the layout renders it behind
 * <Suspense> (Cache Components); `AccountMenuSkeleton` is the fallback.
 */
export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/login">
          <LogIn aria-hidden="true" />
          Sign in
        </Link>
      </Button>
    );
  }
  return <AccountMenuButton name={user.fullName} email={user.email} />;
}

export function AccountMenuSkeleton() {
  return <Skeleton className="size-8 rounded-full" aria-hidden="true" />;
}
