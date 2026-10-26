"use client";

import { CalendarDays, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { TextField } from "@/components/form/text-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProtoProject, ProtoSubproject, ProtoTask } from "@/lib/demo/demo-projects";
import { daysBetween, scheduleSubproject } from "@/lib/domain/schedule";
import { itemProgress } from "@/lib/domain/progress";
import { STATUS_CATEGORY_LABELS } from "@/lib/domain/status";
import { PlanChangeDialog, type BuildResult, type Values } from "./plan-change-dialog";
import { formatDate, formatRange, pluralDays, type ChangeLog } from "./prototype-model";
import { Timeline } from "@/components/timeline";

const TASK_STATUSES: ProtoTask["status"][] = ["todo", "in_progress", "blocked", "done"];

type OnChange = (subproject: ProtoSubproject, log: ChangeLog) => void;

/** Whole number ≥ `min`, or records an error for `field`. */
function parseWhole(values: Values, field: string, min: number, errors: Record<string, string[]>) {
  const n = Number(values[field]);
  if (values[field]?.trim() === "" || !Number.isInteger(n) || n < min) {
    errors[field] = [`Enter a whole number of ${min} or more.`];
    return min;
  }
  return n;
}

function hasErrors(errors: Record<string, string[]>) {
  return Object.keys(errors).length > 0;
}

export function CronogramaTab({
  project,
  sub,
  onChange,
}: {
  project: ProtoProject;
  sub: ProtoSubproject;
  onChange: OnChange;
}) {
  const schedule = scheduleSubproject(sub.start, sub.tasks);
  const baseline = project.baseline?.ranges ?? {};

  function setStatus(task: ProtoTask, status: ProtoTask["status"]) {
    const actualStart = status === "todo" ? null : (task.actualStart ?? project.today);
    const actualEnd = status === "done" ? (task.actualEnd ?? project.today) : null;
    const progress = status === "done" ? 100 : status === "todo" ? null : task.progress === 100 ? null : task.progress;
    const next = { ...task, status, progress, actualStart, actualEnd };
    const details = [
      actualStart !== task.actualStart && `Actual start: ${formatDate(actualStart)}`,
      actualEnd !== task.actualEnd && `Actual end: ${formatDate(actualEnd)}`,
    ].filter((d): d is string => Boolean(d));
    onChange(
      { ...sub, tasks: sub.tasks.map((t) => (t.id === task.id ? next : t)) },
      {
        summary: `${task.name}: ${STATUS_CATEGORY_LABELS[task.status]} → ${STATUS_CATEGORY_LABELS[status]}`,
        details,
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <PlanChangeDialog
          project={project}
          trigger={
            <Button size="sm">
              <Plus aria-hidden="true" /> Add task
            </Button>
          }
          title={`Add a task to ${sub.name}`}
          description="New tasks go at the end of the cronograma."
          initial={{ name: "", duration: "1" }}
          renderFields={(v, set, errors) => (
            <>
              <TextField name="name" label="Task name" required value={v.name} onChange={(e) => set("name", e.target.value)} errors={errors.name} />
              <TextField name="duration" label="Duration (calendar days)" type="number" min={1} required value={v.duration} onChange={(e) => set("duration", e.target.value)} errors={errors.duration} />
            </>
          )}
          build={(v): BuildResult => {
            const errors: Record<string, string[]> = {};
            const durationDays = parseWhole(v, "duration", 1, errors);
            if (!v.name.trim()) return hasErrors(errors) ? { errors } : null;
            if (hasErrors(errors)) return { errors };
            const task: ProtoTask = {
              id: crypto.randomUUID(),
              name: v.name.trim(),
              durationDays,
              delayDays: 0,
              status: "todo",
              progress: null,
              actualStart: null,
              actualEnd: null,
            };
            return { subproject: { ...sub, tasks: [...sub.tasks, task] }, summary: `Task added: ${task.name}` };
          }}
          onApply={onChange}
          submitLabel="Add task"
        />
        <PlanChangeDialog
          project={project}
          trigger={
            <Button size="sm" variant="outline">
              <CalendarDays aria-hidden="true" /> Change start date
            </Button>
          }
          title={`Change when ${sub.name} starts`}
          description="All its tasks move with it. Other subprojects stay where they are."
          initial={{ start: sub.start }}
          renderFields={(v, set, errors) => (
            <TextField name="start" label="Start date" type="date" required value={v.start} onChange={(e) => set("start", e.target.value)} errors={errors.start} />
          )}
          build={(v): BuildResult => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v.start)) return { errors: { start: ["Choose a date."] } };
            if (v.start === sub.start) return null;
            return {
              subproject: { ...sub, start: v.start },
              summary: `${sub.name} start: ${formatDate(sub.start)} → ${formatDate(v.start)}`,
            };
          }}
          onApply={onChange}
        />
      </div>

      {sub.tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No tasks yet. Add the first task; it starts on {formatDate(sub.start)}.
        </p>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>vs. original</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sub.tasks.map((task, i) => {
                  const planned = schedule.tasks[i];
                  const original = baseline[task.id];
                  const slip = original ? daysBetween(original.end, planned.end) : null;
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <p className="font-medium">{task.name}</p>
                        {task.delayDays > 0 ? (
                          <p className="text-xs text-muted-foreground">Waits {pluralDays(task.delayDays)} before starting</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatRange(planned)}</TableCell>
                      <TableCell className="text-right tabular-nums">{task.durationDays}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {slip === null ? (
                          <span className="text-muted-foreground">New task</span>
                        ) : slip === 0 ? (
                          <span className="text-muted-foreground">On plan</span>
                        ) : slip > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium text-warning">
                            <TriangleAlert aria-hidden="true" className="size-3.5" />
                            {pluralDays(slip)} later
                          </span>
                        ) : (
                          <span className="font-medium text-status-done">{pluralDays(-slip)} earlier</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select value={task.status} onValueChange={(s) => setStatus(task, s as ProtoTask["status"])}>
                          <SelectTrigger size="sm" aria-label={`Status of ${task.name}`} className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                <StatusBadge category={s} />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{itemProgress(task)}%</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {task.actualEnd ? (
                          `Done ${formatDate(task.actualEnd)}`
                        ) : task.actualStart ? (
                          `Started ${formatDate(task.actualStart)}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TaskUpdateDialog project={project} sub={sub} task={task} onChange={onChange} />
                          <PlanChangeDialog
                            project={project}
                            trigger={
                              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${task.name}`}>
                                <Trash2 aria-hidden="true" />
                              </Button>
                            }
                            title={`Remove “${task.name}”?`}
                            description="The tasks after it move earlier."
                            initial={{}}
                            build={() => ({
                              subproject: { ...sub, tasks: sub.tasks.filter((t) => t.id !== task.id) },
                              summary: `Task removed: ${task.name}`,
                            })}
                            onApply={onChange}
                            submitLabel="Remove task"
                            destructive
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Timeline
            label={`${sub.name} tasks timeline`}
            today={project.today}
            rows={sub.tasks.map((task, i) => ({
              id: task.id,
              label: task.name,
              sublabel: pluralDays(task.durationDays),
              range: schedule.tasks[i],
              baseline: baseline[task.id] ?? null,
              done: task.status === "done",
            }))}
          />
        </>
      )}
    </div>
  );
}

function TaskUpdateDialog({
  project,
  sub,
  task,
  onChange,
}: {
  project: ProtoProject;
  sub: ProtoSubproject;
  task: ProtoTask;
  onChange: OnChange;
}) {
  return (
    <PlanChangeDialog
      project={project}
      trigger={
        <Button size="sm" variant="outline">
          <Pencil aria-hidden="true" /> Update<span className="sr-only"> {task.name}</span>
        </Button>
      }
      title={`Update “${task.name}”`}
      description="Later tasks in this subproject move with it."
      initial={{
        name: task.name,
        duration: String(task.durationDays),
        delay: String(task.delayDays),
        progress: String(itemProgress(task) ?? 0),
      }}
      renderFields={(v, set, errors) => (
        <>
          <TextField name="name" label="Task name" required value={v.name} onChange={(e) => set("name", e.target.value)} errors={errors.name} />
          <TextField name="duration" label="Duration (calendar days)" type="number" min={1} required value={v.duration} onChange={(e) => set("duration", e.target.value)} errors={errors.duration} />
          <TextField
            name="delay"
            label="Wait before starting (days)"
            description="Use this when the task can't start on time, e.g. a late delivery."
            type="number"
            min={0}
            value={v.delay}
            onChange={(e) => set("delay", e.target.value)}
            errors={errors.delay}
          />
          <TextField
            name="progress"
            label="Progress (%)"
            description="0–100. Setting the status to Done makes it 100."
            type="number"
            min={0}
            max={100}
            value={v.progress}
            onChange={(e) => set("progress", e.target.value)}
            errors={errors.progress}
          />
        </>
      )}
      build={(v): BuildResult => {
        const errors: Record<string, string[]> = {};
        const name = v.name.trim();
        if (!name) errors.name = ["Enter a task name."];
        const durationDays = parseWhole(v, "duration", 1, errors);
        const delayDays = parseWhole(v, "delay", 0, errors);
        const progress = parseWhole(v, "progress", 0, errors);
        if (progress > 100) errors.progress = ["Enter a number from 0 to 100."];
        if (hasErrors(errors)) return { errors };
        const oldProgress = itemProgress(task) ?? 0;
        const changes = [
          name !== task.name && `renamed to “${name}”`,
          durationDays !== task.durationDays && `duration ${task.durationDays} → ${pluralDays(durationDays)}`,
          delayDays !== task.delayDays && `wait ${task.delayDays} → ${pluralDays(delayDays)}`,
          progress !== oldProgress && `progress ${oldProgress}% → ${progress}%`,
        ].filter(Boolean);
        if (changes.length === 0) return null;
        // Progress drives status: 100% is done, anything else re-opens a done task.
        const status: ProtoTask["status"] =
          progress === 100 ? "done" : task.status === "done" || (task.status === "todo" && progress > 0) ? "in_progress" : task.status;
        const actualStart = status === "todo" ? task.actualStart : (task.actualStart ?? project.today);
        const actualEnd = status === "done" ? (task.actualEnd ?? project.today) : null;
        return {
          subproject: {
            ...sub,
            tasks: sub.tasks.map((t) =>
              t.id === task.id
                ? { ...t, name, durationDays, delayDays, progress, status, actualStart, actualEnd }
                : t,
            ),
          },
          summary: `${task.name}: ${changes.join(", ")}`,
        };
      }}
      onApply={onChange}
    />
  );
}
