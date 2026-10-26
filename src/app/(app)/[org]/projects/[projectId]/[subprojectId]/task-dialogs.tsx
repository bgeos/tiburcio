"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CircleAlert, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TextField, TextareaField } from "@/components/form/text-field";
import { PlanPreview } from "@/components/plan-preview";
import { StatusBadge } from "@/components/status-badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { describePlanChange, type PlanSubproject, type PlanTask } from "@/lib/domain/project-plan";
import type { Dependency } from "@/lib/domain/schedule";
import type { TaskLink } from "@/lib/domain/task-links";
import { TASK_STATUSES, type TaskStatus } from "@/lib/domain/tasks";
import { addTask, archiveTask, setTaskStatus, updateTask, type TaskFormState } from "@/lib/projects/task-actions";

/** Where a task lives, plus the project's plan for previews. */
export type TaskScope = {
  orgSlug: string;
  projectId: string;
  subprojectId: string;
  plan: PlanSubproject[];
  dependencies: Dependency[];
  /** Task links touching this project, for overlap previews. */
  taskLinks: TaskLink[];
};

type EditableTask = PlanTask & { progress: number | null; status: TaskStatus };

const wholeNumber = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null);

function withTasks(scope: TaskScope, tasks: (tasks: PlanTask[]) => PlanTask[]): PlanSubproject[] {
  return scope.plan.map((s) => (s.id === scope.subprojectId ? { ...s, tasks: tasks(s.tasks) } : s));
}

/** Add a task (no `task`) or update one, with a live preview of what moves. */
export function TaskDialog({ scope, task, trigger }: { scope: TaskScope; task?: EditableTask; trigger: React.ReactNode }) {
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? `Update “${task.name}”` : "Add a task"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Later tasks in this subproject move with it. Other subprojects never move."
              : "New tasks go at the end of the cronograma, right after the last one."}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          key={formKey}
          scope={scope}
          task={task}
          onSaved={() => {
            setOpen(false);
            toast.success(task ? "Task saved" : "Task added");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ scope, task, onSaved }: { scope: TaskScope; task?: EditableTask; onSaved: () => void }) {
  const action = task
    ? updateTask.bind(null, scope.orgSlug, scope.projectId, scope.subprojectId, task.id)
    : addTask.bind(null, scope.orgSlug, scope.projectId, scope.subprojectId);
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as TaskFormState);
  const [name, setName] = useState(task?.name ?? "");
  const [duration, setDuration] = useState(String(task?.durationDays ?? 1));
  const [delay, setDelay] = useState(String(task?.delayDays ?? 0));
  const [progress, setProgress] = useState(String(task ? (task.status === "done" ? 100 : (task.progress ?? 0)) : 0));

  const lastSaved = useRef(0);
  useEffect(() => {
    if (state.status === "saved" && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      onSaved();
    }
  }, [state, onSaved]);

  const durationDays = wholeNumber(duration);
  const delayDays = wholeNumber(delay);
  const valid = durationDays !== null && durationDays >= 1 && delayDays !== null;
  const draft: PlanTask = { id: task?.id ?? "new-task", name: name.trim() || "New task", durationDays: durationDays ?? 1, delayDays: delayDays ?? 0 };
  const changed = !task || task.durationDays !== draft.durationDays || task.delayDays !== draft.delayDays;
  const preview =
    valid && changed
      ? describePlanChange(
          scope.plan,
          withTasks(scope, (tasks) => (task ? tasks.map((t) => (t.id === task.id ? draft : t)) : [...tasks, draft])),
          scope.dependencies,
          scope.taskLinks,
          scope.projectId,
        )
      : null;

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FieldGroup>
        <TextField name="name" label="Task name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} errors={fieldErrors.name} />
        <TextField
          name="durationDays"
          label="Duration (calendar days)"
          type="number"
          min={1}
          required
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          errors={fieldErrors.durationDays}
        />
        <TextField
          name="delayDays"
          label="Wait before starting (days)"
          description="Use this when the task can't start on time, e.g. a late delivery."
          type="number"
          min={0}
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
          errors={fieldErrors.delayDays}
        />
        {task ? (
          <TextField
            name="progress"
            label="Progress (%)"
            description="0–100. 100 % marks the task done."
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            errors={fieldErrors.progress}
          />
        ) : null}
      </FieldGroup>

      <PlanPreview change={preview} />

      <TextareaField
        name="reason"
        label="Reason (optional)"
        description="Saved in the history, e.g. “bamboo delivery came late”."
        rows={2}
        maxLength={1000}
        errors={fieldErrors.reason}
      />

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
          {pending ? "Saving…" : task ? "Save" : "Add task"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddTaskButton({ scope }: { scope: TaskScope }) {
  return (
    <TaskDialog
      scope={scope}
      trigger={
        <Button size="sm">
          <Plus aria-hidden="true" /> Add task
        </Button>
      }
    />
  );
}

export function UpdateTaskButton({ scope, task }: { scope: TaskScope; task: EditableTask }) {
  return (
    <TaskDialog
      scope={scope}
      task={task}
      trigger={
        <Button size="sm" variant="outline">
          <Pencil aria-hidden="true" /> Update<span className="sr-only"> {task.name}</span>
        </Button>
      }
    />
  );
}

/** Remove (archive) a task, after previewing which later tasks move earlier. */
export function RemoveTaskButton({ scope, task }: { scope: TaskScope; task: PlanTask }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const preview = describePlanChange(
    scope.plan,
    withTasks(scope, (tasks) => tasks.filter((t) => t.id !== task.id)),
    scope.dependencies,
    scope.taskLinks,
    scope.projectId,
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
        if (next) setReason("");
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${task.name}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{`Remove “${task.name}”?`}</DialogTitle>
          <DialogDescription>The tasks after it move earlier. It stays in the history.</DialogDescription>
        </DialogHeader>
        <PlanPreview change={preview} />
        <TextareaField name="reason" label="Reason (optional)" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await archiveTask(scope.orgSlug, scope.projectId, scope.subprojectId, task.id, reason);
                if (result.ok) {
                  setOpen(false);
                  toast.success(`Removed ${task.name}`);
                } else toast.error(result.message);
              })
            }
          >
            {pending ? "Removing…" : "Remove task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline status: actual dates and progress follow automatically on the server. */
export function TaskStatusSelect({ scope, taskId, taskName, status }: { scope: TaskScope; taskId: string; taskName: string; status: TaskStatus }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await setTaskStatus(scope.orgSlug, scope.projectId, scope.subprojectId, taskId, value as TaskStatus);
          if (!result.ok) toast.error(result.message);
        })
      }
    >
      <SelectTrigger size="sm" aria-label={`Status of ${taskName}`} className="w-40">
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
  );
}
