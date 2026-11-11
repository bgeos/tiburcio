"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Bell, CircleAlert, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TextField, TextareaField } from "@/components/form/text-field";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
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
import {
  MY_TASK_STATUSES,
  MY_TASK_TAGS,
  MY_TASK_TAG_LABELS,
  type MyTask,
  type MyTaskStatus,
  type MyTaskTag,
} from "@/lib/domain/my-tasks";
import { createMyTask, deleteMyTask, setMyTaskStatus, updateMyTask, type MyTaskFormState } from "@/lib/my-tasks/actions";

/** Icon + text: the tag never relies on colour. */
export function MyTaskTagBadge({ tag }: { tag: MyTaskTag }) {
  const Icon = tag === "reminder" ? Bell : ListTodo;
  return (
    <Badge variant="outline" className="gap-1">
      <Icon aria-hidden="true" />
      {MY_TASK_TAG_LABELS[tag]}
    </Badge>
  );
}

/** New task (no `task`) or edit one. */
function MyTaskDialog({ orgSlug, task, trigger }: { orgSlug: string; task?: MyTask; trigger: React.ReactNode }) {
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
          <DialogTitle>{task ? `Edit “${task.name}”` : "New task"}</DialogTitle>
          <DialogDescription>Only you can see your tasks.</DialogDescription>
        </DialogHeader>
        <MyTaskForm
          key={formKey}
          orgSlug={orgSlug}
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

function MyTaskForm({ orgSlug, task, onSaved }: { orgSlug: string; task?: MyTask; onSaved: () => void }) {
  const action = task ? updateMyTask.bind(null, orgSlug, task.id) : createMyTask.bind(null, orgSlug);
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as MyTaskFormState);
  const [status, setStatus] = useState<MyTaskStatus>(task?.status ?? "todo");
  const [tag, setTag] = useState<MyTaskTag>(task?.tag ?? "todo");

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
          maxLength={200}
          defaultValue={values.name ?? task?.name}
          errors={fieldErrors.name}
          placeholder="e.g. Call the bamboo supplier"
        />
        <TextareaField
          name="description"
          label="Description (optional)"
          rows={3}
          maxLength={2000}
          defaultValue={values.description ?? task?.description}
          errors={fieldErrors.description}
        />
        <TextField
          name="dueDate"
          label="Date (optional)"
          type="date"
          defaultValue={values.dueDate ?? task?.dueDate ?? ""}
          errors={fieldErrors.dueDate}
          description="Puts it on the calendar."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="my-task-tag">Tag</Label>
            <input type="hidden" name="tag" value={tag} />
            <Select value={tag} onValueChange={(v) => setTag(v as MyTaskTag)}>
              <SelectTrigger id="my-task-tag" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MY_TASK_TAGS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MY_TASK_TAG_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="my-task-status">Status</Label>
            <input type="hidden" name="status" value={status} />
            <Select value={status} onValueChange={(v) => setStatus(v as MyTaskStatus)}>
              <SelectTrigger id="my-task-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MY_TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <StatusBadge category={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          {pending ? "Saving…" : task ? "Save" : "Add task"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewMyTaskButton({ orgSlug }: { orgSlug: string }) {
  return (
    <MyTaskDialog
      orgSlug={orgSlug}
      trigger={
        <Button>
          <Plus aria-hidden="true" /> New task
        </Button>
      }
    />
  );
}

export function EditMyTaskButton({ orgSlug, task }: { orgSlug: string; task: MyTask }) {
  return (
    <MyTaskDialog
      orgSlug={orgSlug}
      task={task}
      trigger={
        <Button size="sm" variant="outline">
          <Pencil aria-hidden="true" /> Edit<span className="sr-only"> {task.name}</span>
        </Button>
      }
    />
  );
}

export function DeleteMyTaskButton({ orgSlug, task }: { orgSlug: string; task: MyTask }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${task.name}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      }
      title={`Delete “${task.name}”?`}
      description="It's removed for good."
      confirmLabel="Delete"
      destructive
      onConfirm={async () => {
        const result = await deleteMyTask(orgSlug, task.id);
        if (result.ok) toast.success(`Deleted ${task.name}`);
        else toast.error(result.message);
      }}
    />
  );
}

export function MyTaskStatusSelect({ orgSlug, task }: { orgSlug: string; task: MyTask }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={task.status}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await setMyTaskStatus(orgSlug, task.id, value as MyTaskStatus);
          if (!result.ok) toast.error(result.message);
        })
      }
    >
      <SelectTrigger size="sm" aria-label={`Status of ${task.name}`} className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MY_TASK_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <StatusBadge category={s} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
