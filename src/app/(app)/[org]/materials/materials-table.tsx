"use client";

import { useState } from "react";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { DueNote } from "@/components/due-note";
import { EmptyState } from "@/components/empty-state";
import { MaterialStatusBadge } from "@/components/material-status-badge";
import { SubprojectDot } from "@/components/subproject-color";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MaterialRow } from "@/lib/dal/materials";
import { MATERIAL_STATUSES, MATERIAL_STATUS_LABELS, isMaterialLate } from "@/lib/domain/materials";
import type { IsoDate } from "@/lib/domain/schedule";

const ALL = "all";

/** Every material of every subproject, filterable by project, subproject and status. */
export function MaterialsTable({ rows, orgSlug, today }: { rows: MaterialRow[]; orgSlug: string; today: IsoDate }) {
  const [projectId, setProjectId] = useState(ALL);
  const [subprojectId, setSubprojectId] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const projects = [...new Map(rows.map((r) => [r.projectId, r.project])).entries()].map(([id, label]) => ({ id, label }));
  const subprojects = [
    ...new Map(
      rows
        .filter((r) => projectId === ALL || r.projectId === projectId)
        .map((r) => [r.subprojectId, projectId === ALL ? `${r.project} › ${r.subproject}` : r.subproject]),
    ).entries(),
  ].map(([id, label]) => ({ id, label }));
  const filtered = rows.filter(
    (r) =>
      (projectId === ALL || r.projectId === projectId) &&
      (subprojectId === ALL || r.subprojectId === subprojectId) &&
      (status === ALL || r.status === status),
  );
  const isFiltered = projectId !== ALL || subprojectId !== ALL || status !== ALL;

  const columns: DataTableColumn<MaterialRow>[] = [
    {
      id: "material",
      header: "Material",
      cell: (row) => <span className="font-medium">{row.description}</span>,
      sortValue: (row) => row.description,
    },
    { id: "project", header: "Project", cell: (row) => row.project, sortValue: (row) => row.project },
    {
      id: "subproject",
      header: "Subproject",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <SubprojectDot color={row.subprojectColor} />
          <Link
            href={`/${orgSlug}/projects/${row.projectId}/${row.subprojectId}?tab=materials`}
            className="text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {row.subproject}
          </Link>
        </span>
      ),
      sortValue: (row) => row.subproject,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <MaterialStatusBadge status={row.status} />,
      sortValue: (row) => MATERIAL_STATUSES.indexOf(row.status),
    },
    {
      id: "neededBy",
      header: "Needed by",
      cell: (row) =>
        row.neededBy ? <DueNote date={row.neededBy} late={isMaterialLate(row, today)} label="" className="text-sm" /> : "—",
      // Undated materials sort last.
      sortValue: (row) => row.neededBy ?? "9999-12-31",
    },
  ];

  function chooseProject(id: string) {
    setProjectId(id);
    // Keep the subproject filter only if it belongs to the chosen project.
    if (id !== ALL && !rows.some((r) => r.projectId === id && r.subprojectId === subprojectId)) setSubprojectId(ALL);
  }

  return (
    <>
      <div role="group" aria-label="Filters" className="flex flex-wrap items-end gap-3">
        <FilterSelect id="filter-project" label="Project" value={projectId} onChange={chooseProject} options={projects} allLabel="All projects" />
        <FilterSelect id="filter-subproject" label="Subproject" value={subprojectId} onChange={setSubprojectId} options={subprojects} allLabel="All subprojects" />
        <FilterSelect
          id="filter-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={MATERIAL_STATUSES.map((s) => ({ id: s, label: MATERIAL_STATUS_LABELS[s] }))}
          allLabel="All statuses"
        />
        {isFiltered ? (
          <Button
            variant="ghost"
            onClick={() => {
              setProjectId(ALL);
              setSubprojectId(ALL);
              setStatus(ALL);
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing {filtered.length} of {rows.length} materials
        </p>
        <ul aria-label="Shown materials by status" className="flex flex-wrap gap-2">
          {MATERIAL_STATUSES.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5 text-sm">
              <MaterialStatusBadge status={s} />
              <span className="tabular-nums">{filtered.filter((r) => r.status === s).length}</span>
            </li>
          ))}
        </ul>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Materials across all projects and subprojects"
        initialSort={{ columnId: "project", direction: "asc" }}
        empty={
          <EmptyState
            icon={PackageSearch}
            title="No materials match these filters"
            description="Try another project, subproject or status, or clear the filters."
          />
        }
      />
    </>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
