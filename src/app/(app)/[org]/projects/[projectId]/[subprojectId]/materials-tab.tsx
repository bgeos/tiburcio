"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CircleAlert, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DueNote } from "@/components/due-note";
import { EmptyState } from "@/components/empty-state";
import { MaterialStatusBadge } from "@/components/material-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MaterialView } from "@/lib/dal/project-detail";
import { MATERIAL_STATUSES, isMaterialLate, type MaterialStatus } from "@/lib/domain/materials";
import type { IsoDate } from "@/lib/domain/schedule";
import {
  addMaterial,
  archiveMaterial,
  setMaterialNeededBy,
  setMaterialStatus,
  type MaterialFormState,
} from "@/lib/projects/material-actions";

type Scope = { orgSlug: string; projectId: string; subprojectId: string; subprojectName: string };

export function MaterialsTab({
  scope,
  materials,
  canEdit,
  today,
}: {
  scope: Scope;
  materials: MaterialView[];
  canEdit: boolean;
  today: IsoDate;
}) {
  return (
    <div className="space-y-4">
      <ul aria-label="Materials by status" className="flex flex-wrap gap-2">
        {MATERIAL_STATUSES.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5 text-sm">
            <MaterialStatusBadge status={s} />
            <span className="tabular-nums">{materials.filter((m) => m.status === s).length}</span>
          </li>
        ))}
      </ul>

      {materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No materials listed yet"
          description={
            canEdit
              ? "List what this subproject needs, e.g. “Steel cable, 8 mm”, and follow each item from To request to On site."
              : "Materials appear here once an admin or production manager lists them."
          }
        />
      ) : (
        <ul aria-label={`${scope.subprojectName} materials`} className="divide-y rounded-xl border bg-card">
          {materials.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium">{m.description}</p>
                <DueNote date={m.neededBy} late={isMaterialLate(m, today)} label="Needed by" />
              </div>
              {canEdit ? (
                <>
                  <NeededByInput scope={scope} material={m} />
                  <MaterialStatusSelect scope={scope} material={m} />
                  <RemoveMaterialButton scope={scope} material={m} />
                </>
              ) : (
                <MaterialStatusBadge status={m.status} />
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? <AddMaterialForm scope={scope} /> : null}
    </div>
  );
}

function MaterialStatusSelect({ scope, material }: { scope: Scope; material: MaterialView }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={material.status}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await setMaterialStatus(scope.orgSlug, scope.projectId, scope.subprojectId, material.id, value as MaterialStatus);
          if (!result.ok) toast.error(result.message);
        })
      }
    >
      <SelectTrigger size="sm" aria-label={`Status of ${material.description}`} className="w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MATERIAL_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <MaterialStatusBadge status={s} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Saved a moment after the date changes (picked or typed), or at once on Enter or leaving the
 * field; the pause keeps a date typed digit by digit from saving every step.
 */
function NeededByInput({ scope, material }: { scope: Scope; material: MaterialView }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(material.neededBy ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const save = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next === (material.neededBy ?? "")) return;
    startTransition(async () => {
      const result = await setMaterialNeededBy(scope.orgSlug, scope.projectId, scope.subprojectId, material.id, next);
      if (result.ok) toast.success(next ? `${material.description}: date saved` : `${material.description}: date cleared`);
      else {
        toast.error(result.message);
        setValue(material.neededBy ?? "");
      }
    });
  };
  return (
    <Input
      type="date"
      aria-label={`${material.description} needed by`}
      className="h-8 w-40"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => save(next), 1000);
      }}
      onBlur={() => save(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") save(value);
      }}
    />
  );
}

function RemoveMaterialButton({ scope, material }: { scope: Scope; material: MaterialView }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${material.description}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      }
      title={`Remove “${material.description}”?`}
      description="It disappears from the list. The history keeps a record."
      confirmLabel="Remove"
      destructive
      onConfirm={async () => {
        const result = await archiveMaterial(scope.orgSlug, scope.projectId, scope.subprojectId, material.id);
        if (result.ok) toast.success(`Removed ${material.description}`);
        else toast.error(result.message);
      }}
    />
  );
}

function AddMaterialForm({ scope }: { scope: Scope }) {
  const [state, formAction, pending] = useActionState(
    addMaterial.bind(null, scope.orgSlug, scope.projectId, scope.subprojectId),
    { status: "idle" } as MaterialFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const lastSaved = useRef(0);
  useEffect(() => {
    if (state.status === "saved" && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      formRef.current?.reset();
    }
  }, [state]);

  const error =
    state.status === "invalid"
      ? (state.fieldErrors.description?.[0] ?? state.fieldErrors.neededBy?.[0])
      : state.status === "error"
        ? state.message
        : null;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-60 flex-1 gap-1.5">
          <Label htmlFor="new-material">New material</Label>
          <Input
            id="new-material"
            name="description"
            maxLength={300}
            placeholder="e.g. Steel cable, 8 mm"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "new-material-error" : undefined}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-material-needed-by">Needed by (optional)</Label>
          <Input id="new-material-needed-by" name="neededBy" type="date" className="w-40" />
        </div>
        <Button type="submit" disabled={pending}>
          <Plus aria-hidden="true" /> Add material
        </Button>
      </div>
      {error ? (
        <p id="new-material-error" role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </form>
  );
}
