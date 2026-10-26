"use client";

import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MATERIAL_STATUSES, MATERIAL_STATUS_LABELS, type MaterialStatus } from "@/lib/demo/demo-projects";
import { MaterialStatusBadge } from "../materials-tab";
import { usePrototypeStore } from "../prototype-store";

const ALL = "all";

type MaterialRow = {
  id: string;
  description: string;
  projectId: string;
  project: string;
  subprojectId: string;
  subproject: string;
  status: MaterialStatus;
};

const COLUMNS: DataTableColumn<MaterialRow>[] = [
  {
    id: "material",
    header: "Material",
    cell: (row) => <span className="font-medium">{row.description}</span>,
    sortValue: (row) => row.description,
  },
  { id: "project", header: "Project", cell: (row) => row.project, sortValue: (row) => row.project },
  { id: "subproject", header: "Subproject", cell: (row) => row.subproject, sortValue: (row) => row.subproject },
  {
    id: "status",
    header: "Status",
    cell: (row) => <MaterialStatusBadge status={row.status} />,
    sortValue: (row) => MATERIAL_STATUSES.indexOf(row.status),
  },
];

/**
 * Every material from every subproject, read from the same demo state the
 * subproject tabs edit, so additions and status changes show up here at once.
 */
export function AllMaterials() {
  const { state } = usePrototypeStore();
  const [projectId, setProjectId] = useState(ALL);
  const [subprojectId, setSubprojectId] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const rows: MaterialRow[] = state.projects.flatMap((p) =>
    p.subprojects.flatMap((s) =>
      s.materials.map((m) => ({
        id: m.id,
        description: m.description,
        projectId: p.id,
        project: p.name,
        subprojectId: s.id,
        subproject: s.name,
        status: m.status,
      })),
    ),
  );
  const subprojectOptions = state.projects
    .filter((p) => projectId === ALL || p.id === projectId)
    .flatMap((p) => p.subprojects.map((s) => ({ id: s.id, label: projectId === ALL ? `${p.name} › ${s.name}` : s.name })));
  const filtered = rows.filter(
    (r) =>
      (projectId === ALL || r.projectId === projectId) &&
      (subprojectId === ALL || r.subprojectId === subprojectId) &&
      (status === ALL || r.status === status),
  );
  const isFiltered = projectId !== ALL || subprojectId !== ALL || status !== ALL;

  function chooseProject(id: string) {
    setProjectId(id);
    // Keep the subproject filter only if it belongs to the chosen project.
    const keeps = state.projects.find((p) => p.id === id)?.subprojects.some((s) => s.id === subprojectId);
    if (id !== ALL && !keeps) setSubprojectId(ALL);
  }

  return (
    <>
      <PageHeader
        title="All materials"
        description="Every material from every subproject. Add or update materials in a subproject's Materials tab and they appear here."
      />

      <div role="group" aria-label="Filters" className="flex flex-wrap items-end gap-3">
        <FilterSelect id="filter-project" label="Project" value={projectId} onChange={chooseProject}
          options={state.projects.map((p) => ({ id: p.id, label: p.name }))} allLabel="All projects" />
        <FilterSelect id="filter-subproject" label="Subproject" value={subprojectId} onChange={setSubprojectId}
          options={subprojectOptions} allLabel="All subprojects" />
        <FilterSelect id="filter-status" label="Status" value={status} onChange={setStatus}
          options={MATERIAL_STATUSES.map((s) => ({ id: s, label: MATERIAL_STATUS_LABELS[s] }))} allLabel="All statuses" />
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
        columns={COLUMNS}
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
