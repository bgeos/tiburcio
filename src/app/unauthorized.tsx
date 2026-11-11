import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";
import { Button } from "@/components/ui/button";

/** Rendered when a route calls unauthorized() — the visitor is not signed in. */
export default function Unauthorized() {
  return (
    <StatusScreen
      icon={LockKeyhole}
      code="401"
      title="Sign in to continue"
      description="This page is private. Sign in to continue."
      tone="warning"
      actions={
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}
