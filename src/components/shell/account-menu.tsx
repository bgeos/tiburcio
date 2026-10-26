import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Phase 1: there is no authentication yet, so the shell honestly shows a
 * signed-out state. Phase 2 replaces this with the signed-in user's menu
 * (name, organization switcher, sign out), read behind a <Suspense> boundary.
 */
export function AccountMenu() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href="/login">
        <LogIn aria-hidden="true" />
        Sign in
      </Link>
    </Button>
  );
}
