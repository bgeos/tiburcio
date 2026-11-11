"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleAlert, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import type { Milestone } from "@/lib/domain/milestones";
import { deleteMilestone, saveMilestone, type MilestoneFormState } from "@/lib/projects/milestone-actions";

/** Add a milestone (no `milestone`) or change one (D-030). */
function MilestoneDialog({ orgSlug, milestone, trigger }: { orgSlug: string; milestone?: Milestone; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // A fresh form (and form state) every time the dialog opens.
  const [formKey, setFormKey] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setFormKey((k) => k + 1);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{milestone ? `Edit “${milestone.name}”` : "New milestone"}</DialogTitle>
          <DialogDescription>
            A key date shown in every project, like “Festival opens”. Tasks linked to it must be done before its day.
          </DialogDescription>
        </DialogHeader>
        <MilestoneForm
          key={formKey}
          orgSlug={orgSlug}
          milestone={milestone}
          onSaved={() => {
            setOpen(false);
            toast.success(milestone ? "Milestone saved" : "Milestone added");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function MilestoneForm({ orgSlug, milestone, onSaved }: { orgSlug: string; milestone?: Milestone; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(saveMilestone.bind(null, orgSlug, milestone?.id ?? null), {
    status: "idle",
  } as MilestoneFormState);

  const lastSaved = useRef(0);
  useEffect(() => {
    if (state.status === "saved" && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      onSaved();
    }
  }, [state, onSaved]);

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : {};

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FieldGroup>
        <TextField
          name="name"
          label="Name"
          required
          maxLength={120}
          defaultValue={values.name ?? milestone?.name}
          errors={fieldErrors.name}
          placeholder="e.g. Festival opens"
        />
        <TextField name="date" label="Date" type="date" required defaultValue={values.date ?? milestone?.date} errors={fieldErrors.date} />
      </FieldGroup>

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : milestone ? "Save" : "Add milestone"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewMilestoneButton({ orgSlug }: { orgSlug: string }) {
  return (
    <MilestoneDialog
      orgSlug={orgSlug}
      trigger={
        <Button size="sm" variant="outline">
          <Plus aria-hidden="true" /> New milestone
        </Button>
      }
    />
  );
}

export function EditMilestoneButton({ orgSlug, milestone }: { orgSlug: string; milestone: Milestone }) {
  return (
    <MilestoneDialog
      orgSlug={orgSlug}
      milestone={milestone}
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${milestone.name}`}>
          <Pencil aria-hidden="true" />
        </Button>
      }
    />
  );
}

export function DeleteMilestoneButton({ orgSlug, milestone }: { orgSlug: string; milestone: Milestone }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${milestone.name}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      }
      title={`Delete “${milestone.name}”?`}
      description="It disappears from every project, and tasks linked to it are no longer checked against it."
      confirmLabel="Delete"
      destructive
      onConfirm={async () => {
        const result = await deleteMilestone(orgSlug, milestone.id);
        if (result.ok) toast.success(`Deleted ${milestone.name}`);
        else toast.error(result.message);
      }}
    />
  );
}
