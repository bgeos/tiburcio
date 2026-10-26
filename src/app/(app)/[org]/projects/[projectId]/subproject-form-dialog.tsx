"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { TextField, TextareaField } from "@/components/form/text-field";
import { PlanPreview } from "@/components/plan-preview";
import { SUBPROJECT_BG } from "@/components/subproject-color";
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
import type { TaskLink } from "@/lib/domain/task-links";
import {
  SUBPROJECT_COLORS,
  SUBPROJECT_COLOR_LABELS,
  nextSubprojectColor,
  type SubprojectColor,
} from "@/lib/domain/subproject-colors";
import { createSubproject, updateSubproject, type SubprojectFormState } from "@/lib/projects/subproject-actions";
import { cn } from "@/lib/utils";

type Props = {
  orgSlug: string;
  projectId: string;
  /** The project's current plan, for the "what changes" preview. */
  plan: PlanSubproject[];
  dependencies: Dependency[];
  /** Task links touching this project, for overlap previews. */
  taskLinks: TaskLink[];
  /** Colours already used in the project: a new subproject gets the least-used one. */
  usedColors: SubprojectColor[];
  /** Omit to create a subproject. */
  subproject?: { id: string; name: string; startDate: string; color: SubprojectColor };
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

function SubprojectForm({ orgSlug, projectId, plan, dependencies, taskLinks, usedColors, subproject, onSaved }: Props & { onSaved: () => void }) {
  const action = subproject
    ? updateSubproject.bind(null, orgSlug, projectId, subproject.id)
    : createSubproject.bind(null, orgSlug, projectId);
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as SubprojectFormState);
  const [name, setName] = useState(subproject?.name ?? "");
  const [startDate, setStartDate] = useState(subproject?.startDate ?? "");
  const [color, setColor] = useState<SubprojectColor>(subproject?.color ?? nextSubprojectColor(usedColors));

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
          taskLinks,
          projectId,
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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Colour</legend>
        <p className="text-sm text-muted-foreground">Used for its timeline bar, card and tasks. Red is kept for overlaps.</p>
        <div className="grid grid-cols-3 gap-2">
          {SUBPROJECT_COLORS.map((c) => (
            <label
              key={c}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                color === c && "border-primary bg-accent font-medium",
              )}
            >
              <input
                type="radio"
                name="color"
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
                className="sr-only"
              />
              <span aria-hidden="true" className={cn("grid size-5 shrink-0 place-items-center rounded-full", SUBPROJECT_BG[c])}>
                {color === c ? <Check className="size-3.5 text-card" /> : null}
              </span>
              {SUBPROJECT_COLOR_LABELS[c]}
            </label>
          ))}
        </div>
      </fieldset>

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
