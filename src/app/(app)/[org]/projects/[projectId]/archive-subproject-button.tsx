"use client";

import { Archive } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { setSubprojectArchived } from "@/lib/projects/subproject-actions";

export function ArchiveSubprojectButton({
  orgSlug,
  projectId,
  subprojectId,
  name,
}: {
  orgSlug: string;
  projectId: string;
  subprojectId: string;
  name: string;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost">
          <Archive aria-hidden="true" /> Archive<span className="sr-only"> {name}</span>
        </Button>
      }
      title={`Archive “${name}”?`}
      description="It disappears from the project, with its links to other subprojects. Its tasks, materials and crew are kept, and nothing is deleted."
      confirmLabel="Archive"
      destructive
      onConfirm={async () => {
        const result = await setSubprojectArchived(orgSlug, projectId, subprojectId, true);
        if (result.ok) toast.success(`Archived ${name}`);
        else toast.error(result.message);
      }}
    />
  );
}
