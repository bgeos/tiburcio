import Link from "next/link";
import { ShieldX } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";
import { Button } from "@/components/ui/button";

/** Rendered when a route calls forbidden() — signed in, but no permission. */
export default function Forbidden() {
  return (
    <StatusScreen
      icon={ShieldX}
      code="403"
      title="You don't have access"
      description="Your role doesn't include this page or project. Ask a production manager or an organization admin to share it with you."
      tone="danger"
      actions={
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to overview</Link>
        </Button>
      }
    />
  );
}
