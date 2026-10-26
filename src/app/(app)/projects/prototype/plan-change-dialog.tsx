"use client";

import { useState } from "react";
import { CircleCheck, OctagonAlert } from "lucide-react";
import { TextareaField } from "@/components/form/text-field";
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
import type { ProtoProject, ProtoSubproject } from "@/lib/demo/demo-projects";
import { previewChange, type ChangeLog } from "./prototype-model";

export type Values = Record<string, string>;

/** `null` = nothing changed yet; `errors` = invalid input, keyed by field name. */
export type BuildResult =
  | { subproject: ProtoSubproject; summary: string }
  | { errors: Record<string, string[]> }
  | null;

/**
 * Every schedule change goes through this dialog: edit → see exactly which
 * dates move and which overlaps appear → apply with a reason.
 * Other subprojects are never moved; overlaps are only reported.
 */
export function PlanChangeDialog({
  project,
  trigger,
  title,
  description,
  initial,
  renderFields,
  build,
  onApply,
  submitLabel = "Apply change",
  destructive = false,
}: {
  project: ProtoProject;
  trigger: React.ReactNode;
  title: string;
  description?: string;
  initial: Values;
  renderFields?: (
    values: Values,
    set: (name: string, value: string) => void,
    errors: Record<string, string[]>,
  ) => React.ReactNode;
  build: (values: Values) => BuildResult;
  onApply: (subproject: ProtoSubproject, log: ChangeLog) => void;
  submitLabel?: string;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(initial);
  const [reason, setReason] = useState("");

  const result = open ? build(values) : null;
  const errors = result && "errors" in result ? result.errors : {};
  const change = result && "subproject" in result ? result : null;
  const preview = change ? previewChange(project, change.subproject) : null;

  function onOpenChange(next: boolean) {
    if (next) {
      setValues(initial);
      setReason("");
    }
    setOpen(next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!change || !preview) return;
    onApply(change.subproject, {
      summary: change.summary,
      details: [...preview.lines, ...preview.newOverlaps.map((w) => `Warning: ${w}`)],
      reason,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {renderFields ? (
            <FieldGroup>
              {renderFields(values, (name, value) => setValues((v) => ({ ...v, [name]: value })), errors)}
            </FieldGroup>
          ) : null}

          <section aria-labelledby="preview-heading" aria-live="polite" className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <h3 id="preview-heading" className="text-sm font-semibold">
              Preview
            </h3>
            {!preview ? (
              <p className="text-sm text-muted-foreground">Make a change to see what moves.</p>
            ) : (
              <>
                {preview.lines.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {preview.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No dates change.</p>
                )}
                {preview.newOverlaps.map((warning) => (
                  <p key={warning} className="flex gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                    <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-medium">Overlap: </span>
                      {warning} It won&apos;t be moved automatically.
                    </span>
                  </p>
                ))}
                {preview.resolvedOverlaps.map((note) => (
                  <p key={note} className="flex gap-2 text-sm text-status-done">
                    <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {note}
                  </p>
                ))}
              </>
            )}
          </section>

          <TextareaField
            name="reason"
            label="Reason (optional)"
            description="Saved in the history, e.g. “bamboo delivery came late”."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={!change}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
