"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { setProjectArchived } from "@/lib/projects/actions";

export function ArchiveProjectButton({ orgSlug, projectId, name }: { orgSlug: string; projectId: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost">
          <Archive aria-hidden="true" /> Archive<span className="sr-only"> {name}</span>
        </Button>
      }
      title={`Archive “${name}”?`}
      description="It disappears from the project list. Nothing is deleted: you can restore it from Archived projects."
      confirmLabel="Archive"
      destructive
      onConfirm={async () => {
        const result = await setProjectArchived(orgSlug, projectId, true);
        if (result.ok) toast.success(`Archived ${name}`);
        else toast.error(result.message ?? "Couldn't archive the project.");
      }}
    />
  );
}

export function RestoreProjectButton({ orgSlug, projectId, name }: { orgSlug: string; projectId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setProjectArchived(orgSlug, projectId, false);
          if (result.ok) toast.success(`Restored ${name}`);
          else toast.error(result.message ?? "Couldn't restore the project.");
        })
      }
    >
      <ArchiveRestore aria-hidden="true" /> Restore<span className="sr-only"> {name}</span>
    </Button>
  );
}
