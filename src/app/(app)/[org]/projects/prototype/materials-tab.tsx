"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MATERIAL_STATUSES,
  MATERIAL_STATUS_LABELS,
  type MaterialStatus,
  type ProtoSubproject,
} from "@/lib/demo/demo-projects";
import type { StatusCategory } from "@/lib/domain/status";
import type { ChangeLog } from "./prototype-model";

const MATERIAL_CATEGORY: Record<MaterialStatus, StatusCategory> = {
  to_request: "todo",
  requested: "in_progress",
  ready_at_warehouse: "in_progress",
  on_site: "done",
};

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  return <StatusBadge category={MATERIAL_CATEGORY[status]} label={MATERIAL_STATUS_LABELS[status]} />;
}

export function MaterialsTab({
  sub,
  onChange,
}: {
  sub: ProtoSubproject;
  onChange: (subproject: ProtoSubproject, log: ChangeLog) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(event: React.FormEvent) {
    event.preventDefault();
    const description = draft.trim();
    if (!description) return;
    onChange(
      { ...sub, materials: [...sub.materials, { id: crypto.randomUUID(), description, status: "to_request" }] },
      { summary: `Material added: ${description}` },
    );
    setDraft("");
  }

  return (
    <div className="space-y-4">
      <ul aria-label="Materials by status" className="flex flex-wrap gap-2">
        {MATERIAL_STATUSES.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5 text-sm">
            <MaterialStatusBadge status={s} />
            <span className="tabular-nums">{sub.materials.filter((m) => m.status === s).length}</span>
          </li>
        ))}
      </ul>

      {sub.materials.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No materials listed yet.
        </p>
      ) : (
        <ul aria-label={`${sub.name} materials`} className="divide-y rounded-lg border bg-card">
          {sub.materials.map((material) => (
            <li key={material.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <p className="min-w-40 flex-1 text-sm font-medium">{material.description}</p>
              <Select
                value={material.status}
                onValueChange={(value) => {
                  const status = value as MaterialStatus;
                  onChange(
                    { ...sub, materials: sub.materials.map((m) => (m.id === material.id ? { ...m, status } : m)) },
                    {
                      summary: `${material.description}: ${MATERIAL_STATUS_LABELS[material.status]} → ${MATERIAL_STATUS_LABELS[status]}`,
                    },
                  );
                }}
              >
                <SelectTrigger size="sm" aria-label={`Status of ${material.description}`} className="w-48">
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
                onConfirm={() =>
                  onChange(
                    { ...sub, materials: sub.materials.filter((m) => m.id !== material.id) },
                    { summary: `Material removed: ${material.description}` },
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-60 flex-1 gap-1.5">
          <Label htmlFor="new-material">New material</Label>
          <Input
            id="new-material"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Steel cable, 8 mm"
          />
        </div>
        <Button type="submit" disabled={!draft.trim()}>
          <Plus aria-hidden="true" /> Add material
        </Button>
      </form>
    </div>
  );
}
