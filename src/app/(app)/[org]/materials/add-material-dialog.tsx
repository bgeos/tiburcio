"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleAlert, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SubprojectChoice } from "@/lib/dal/materials";
import { addMaterialToSubproject, type MaterialFormState } from "@/lib/projects/material-actions";

/** Add a material from the Materials page: choose where it's needed, then what and by when. */
export function AddMaterialDialog({ orgSlug, choices }: { orgSlug: string; choices: SubprojectChoice[] }) {
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
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" /> Add material
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add material</DialogTitle>
          <DialogDescription>It&apos;s listed in the subproject&apos;s Materials tab too, starting as “To request”.</DialogDescription>
        </DialogHeader>
        <AddMaterialForm
          key={formKey}
          orgSlug={orgSlug}
          choices={choices}
          onSaved={() => {
            setOpen(false);
            toast.success("Material added");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddMaterialForm({
  orgSlug,
  choices,
  onSaved,
}: {
  orgSlug: string;
  choices: SubprojectChoice[];
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(addMaterialToSubproject.bind(null, orgSlug), { status: "idle" } as MaterialFormState);
  const projects = [...new Map(choices.map((c) => [c.projectId, c.project])).entries()];
  const [projectId, setProjectId] = useState(projects.length === 1 ? projects[0][0] : "");
  const subprojects = choices.filter((c) => c.projectId === projectId);
  const [subprojectId, setSubprojectId] = useState(subprojects.length === 1 ? subprojects[0].subprojectId : "");

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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="add-material-project">Project</Label>
            <input type="hidden" name="projectId" value={projectId} />
            <Select
              value={projectId}
              onValueChange={(next) => {
                setProjectId(next);
                const subs = choices.filter((c) => c.projectId === next);
                setSubprojectId(subs.length === 1 ? subs[0].subprojectId : "");
              }}
            >
              <SelectTrigger id="add-material-project" className="w-full">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-material-subproject">Subproject</Label>
            <input type="hidden" name="subprojectId" value={subprojectId} />
            <Select value={subprojectId} onValueChange={setSubprojectId} disabled={!projectId}>
              <SelectTrigger
                id="add-material-subproject"
                className="w-full"
                aria-invalid={fieldErrors.subprojectId ? true : undefined}
                aria-describedby={fieldErrors.subprojectId ? "add-material-subproject-error" : undefined}
              >
                <SelectValue placeholder={projectId ? "Choose a subproject" : "Choose a project first"} />
              </SelectTrigger>
              <SelectContent>
                {subprojects.map((s) => (
                  <SelectItem key={s.subprojectId} value={s.subprojectId}>
                    {s.subproject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.subprojectId ? (
              <p id="add-material-subproject-error" className="text-sm text-destructive">
                {fieldErrors.subprojectId[0]}
              </p>
            ) : null}
          </div>
        </div>
        <TextField
          name="description"
          label="Material"
          required
          maxLength={300}
          defaultValue={values.description}
          errors={fieldErrors.description}
          placeholder="e.g. Steel cable, 8 mm"
        />
        <TextField name="neededBy" label="Needed by (optional)" type="date" defaultValue={values.neededBy} errors={fieldErrors.neededBy} />
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
          {pending ? "Adding…" : "Add material"}
        </Button>
      </DialogFooter>
    </form>
  );
}
