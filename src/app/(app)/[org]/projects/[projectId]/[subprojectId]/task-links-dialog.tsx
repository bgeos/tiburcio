"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Link2, OctagonAlert, X } from "lucide-react";
import { toast } from "sonner";
import { SubprojectDot } from "@/components/subproject-color";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { taskOverlapMessage, taskOverlaps, taskPlace, type LinkedTask, type TaskLink } from "@/lib/domain/task-links";
import { formatDate, formatRange } from "@/lib/format";
import { addTaskLink, removeTaskLink } from "@/lib/projects/task-link-actions";

/**
 * What a task waits for and what waits for it (D-027). Any task of the organization can be
 * chosen; the overlap it would cause is previewed before adding. Nothing moves by itself.
 */
export function TaskLinksButton({
  orgSlug,
  task,
  links,
  candidates,
}: {
  orgSlug: string;
  task: LinkedTask;
  /** Links touching this task. */
  links: TaskLink[];
  /** Every current task of the organization. */
  candidates: LinkedTask[];
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [pending, startTransition] = useTransition();

  const waitsFor = links.filter((l) => l.successor.id === task.id);
  const neededBy = links.filter((l) => l.predecessor.id === task.id);
  const taken = new Set(waitsFor.map((l) => l.predecessor.id));
  // Tasks of the same subproject already run in order.
  const options = candidates.filter((c) => c.subprojectId !== task.subprojectId && !taken.has(c.id));
  const groups = [...new Set(options.map((c) => c.subprojectId))].map((id) => options.filter((c) => c.subprojectId === id));
  const chosen = options.find((c) => c.id === choice);
  const previewLink: TaskLink | null = chosen ? { id: "preview", predecessor: chosen, successor: task } : null;
  const previewOverlap = previewLink ? taskOverlaps([previewLink])[0] : undefined;

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(done);
        setChoice("");
      } else toast.error(result.message);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setChoice("");
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Link2 aria-hidden="true" /> Links<span className="sr-only"> for {task.name}</span>
          {/* The row lists the links as text; the count is a visual summary. */}
          {waitsFor.length + neededBy.length ? <span aria-hidden="true">({waitsFor.length + neededBy.length})</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Links for “{task.name}”</DialogTitle>
          <DialogDescription>
            A task can wait for any other task, also in another subproject or project. Dates never move by themselves:
            if they clash, the overlap shows in red.
          </DialogDescription>
        </DialogHeader>

        <LinkList
          title="Waits for"
          empty="Doesn't wait for other tasks."
          links={waitsFor}
          other={(l) => l.predecessor}
          fromProjectId={task.projectId}
          onRemove={(l) => run(() => removeTaskLink(orgSlug, task.projectId, l.id), "Link removed")}
          pending={pending}
        />

        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor={`wait-for-${task.id}`}>Add: {task.name} waits for…</Label>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id={`wait-for-${task.id}`} className="w-full">
              <SelectValue placeholder="Choose a task" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectGroup key={group[0].subprojectId}>
                  <SelectLabel>
                    {group[0].projectId === task.projectId ? group[0].subprojectName : `${group[0].projectName} › ${group[0].subprojectName}`}
                  </SelectLabel>
                  {group.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      <span className="text-muted-foreground"> · finishes {formatDate(c.range?.end ?? null)}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          {previewLink ? (
            <section aria-label="Preview" aria-live="polite">
              {previewOverlap ? (
                <p className="flex gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                  <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="font-medium">Overlap: </span>
                    {taskOverlapMessage(previewOverlap, task.projectId)} It won&apos;t be moved automatically.
                  </span>
                </p>
              ) : (
                <p className="flex gap-2 text-sm text-status-done">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  No overlap: {taskPlace(chosen!, task.projectId)} finishes {formatDate(chosen!.range?.end ?? null)}, and{" "}
                  {task.name} starts {formatDate(task.range?.start ?? null)}.
                </p>
              )}
            </section>
          ) : null}

          <Button
            type="button"
            disabled={!chosen || pending}
            onClick={() => run(() => addTaskLink(orgSlug, task.projectId, task.id, choice), "Link added")}
          >
            {pending ? "Saving…" : "Add link"}
          </Button>
        </div>

        <LinkList
          title="Needed by"
          empty="No other task waits for this one."
          links={neededBy}
          other={(l) => l.successor}
          fromProjectId={task.projectId}
          onRemove={(l) => run(() => removeTaskLink(orgSlug, task.projectId, l.id), "Link removed")}
          pending={pending}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkList({
  title,
  empty,
  links,
  other,
  fromProjectId,
  onRemove,
  pending,
}: {
  title: string;
  empty: string;
  links: TaskLink[];
  other: (link: TaskLink) => LinkedTask;
  fromProjectId: string;
  onRemove: (link: TaskLink) => void;
  pending: boolean;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul aria-label={title} className="divide-y rounded-lg border">
          {links.map((link) => {
            const task = other(link);
            const overlap = taskOverlaps([link])[0];
            return (
              <li key={link.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                <SubprojectDot color={task.color} className="mt-1.5" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{taskPlace(task, fromProjectId)}</span>
                  <span className="block text-xs text-muted-foreground">{formatRange(task.range)}</span>
                  {overlap ? (
                    <span className="mt-1 flex gap-1.5 text-destructive">
                      <OctagonAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                      {taskOverlapMessage(overlap, fromProjectId)}
                    </span>
                  ) : null}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Remove link: ${link.successor.name} waits for ${link.predecessor.name}`}
                  onClick={() => onRemove(link)}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
