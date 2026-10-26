"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { TextField, TextareaField } from "@/components/form/text-field";
import { PlanPreview } from "@/components/plan-preview";
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
import { describePlanChange, type PlanSubproject } from "@/lib/domain/project-plan";
import type { Dependency } from "@/lib/domain/schedule";
import { createSubproject, updateSubproject, type SubprojectFormState } from "@/lib/projects/subproject-actions";

type Props = {
  orgSlug: string;
  projectId: string;
  /** The project's current plan, for the "what changes" preview. */
  plan: PlanSubproject[];
  dependencies: Dependency[];
  /** Omit to create a subproject. */
  subproject?: { id: string; name: string; startDate: string };
  trigger: React.ReactNode;
};

export function SubprojectFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setFormKey((k) => k + 1);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.subproject ? `Edit “${props.subproject.name}”` : "Add a subproject"}</DialogTitle>
          <DialogDescription>
            {props.subproject
              ? "Its tasks move with the start date. Other subprojects never move; overlaps are shown in red."
              : "An area of the project with its own owner, cronograma, materials and crew, e.g. Structure or DJ Booth."}
          </DialogDescription>
        </DialogHeader>
        <SubprojectForm
          key={formKey}
          {...props}
          onSaved={() => {
            setOpen(false);
            toast.success(props.subproject ? "Subproject saved" : "Subproject added");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function SubprojectForm({ orgSlug, projectId, plan, dependencies, subproject, onSaved }: Props & { onSaved: () => void }) {
  const action = subproject
    ? updateSubproject.bind(null, orgSlug, projectId, subproject.id)
    : createSubproject.bind(null, orgSlug, projectId);
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as SubprojectFormState);
  const [name, setName] = useState(subproject?.name ?? "");
  const [startDate, setStartDate] = useState(subproject?.startDate ?? "");

  const lastSaved = useRef(0);
  useEffect(() => {
    if (state.status === "saved" && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      onSaved();
    }
  }, [state, onSaved]);

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};

  // Preview the effect of a new start date (edit only; a new subproject has no tasks yet).
  const preview =
    subproject && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && startDate !== subproject.startDate
      ? describePlanChange(
          plan,
          plan.map((s) => (s.id === subproject.id ? { ...s, startDate } : s)),
          dependencies,
        )
      : null;

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FieldGroup>
        <TextField
          name="name"
          label="Name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          errors={fieldErrors.name}
          placeholder="e.g. Structure"
        />
        <TextField
          name="startDate"
          label="Start date"
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          errors={fieldErrors.startDate}
          description="Its tasks run one after another from this day."
        />
      </FieldGroup>

      {preview ? <PlanPreview change={preview} emptyText="No tasks yet, so no other dates change." /> : null}

      {subproject ? (
        <TextareaField
          name="reason"
          label="Reason (optional)"
          description="Saved in the history, e.g. “site access delayed”."
          rows={2}
          maxLength={1000}
          errors={fieldErrors.reason}
        />
      ) : null}

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
          {pending ? "Saving…" : subproject ? "Save" : "Add subproject"}
        </Button>
      </DialogFooter>
    </form>
  );
}
