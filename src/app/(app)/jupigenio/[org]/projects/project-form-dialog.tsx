"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { TextField, TextareaField } from "@/components/form/text-field";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/domain/projects";
import { createProject, updateProject, type ProjectFormState } from "@/lib/projects/actions";

export type EditableProject = { id: string; name: string; description: string; status: ProjectStatus };

/** Create a project (no `project`) or edit one. */
export function ProjectFormDialog({
  orgSlug,
  project,
  trigger,
}: {
  orgSlug: string;
  project?: EditableProject;
  trigger: React.ReactNode;
}) {
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? `Edit “${project.name}”` : "New project"}</DialogTitle>
          <DialogDescription>
            {project
              ? "Changes are saved in the project's history."
              : "A festival, event or build. You'll add its subprojects (areas like Structure or DJ Booth) next."}
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          key={formKey}
          orgSlug={orgSlug}
          project={project}
          onSaved={() => {
            setOpen(false);
            toast.success(project ? "Project saved" : "Project created");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({
  orgSlug,
  project,
  onSaved,
}: {
  orgSlug: string;
  project?: EditableProject;
  onSaved: () => void;
}) {
  const action = project ? updateProject.bind(null, orgSlug, project.id) : createProject.bind(null, orgSlug);
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ProjectFormState);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "planning");

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
          defaultValue={values.name ?? project?.name}
          errors={fieldErrors.name}
          placeholder="e.g. Main Stage"
        />
        <TextareaField
          name="description"
          label="Description (optional)"
          rows={3}
          maxLength={2000}
          defaultValue={values.description ?? project?.description}
          errors={fieldErrors.description}
        />
        <div className="grid gap-2">
          <Label htmlFor="project-status">Status</Label>
          <input type="hidden" name="status" value={status} />
          <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
            <SelectTrigger id="project-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          {pending ? "Saving…" : project ? "Save" : "Create project"}
        </Button>
      </DialogFooter>
    </form>
  );
}
