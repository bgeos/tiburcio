"use client";

import { Lock } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { lockPlan } from "@/lib/projects/plan-actions";

export function LockPlanButton({ orgSlug, projectId, relock }: { orgSlug: string; projectId: string; relock: boolean }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <Lock aria-hidden="true" /> {relock ? "Lock plan again" : "Lock plan"}
        </Button>
      }
      title={relock ? "Lock the plan again?" : "Lock the current plan?"}
      description={
        relock
          ? "Today's dates replace the original plan that delays are measured against. The previous original plan stays in the history."
          : "Today's dates become the original plan. From then on, each subproject and task shows how many days it has moved."
      }
      confirmLabel={relock ? "Lock again" : "Lock plan"}
      onConfirm={async () => {
        const result = await lockPlan(orgSlug, projectId);
        if (result.ok) toast.success("Plan locked");
        else toast.error(result.message);
      }}
    />
  );
}
