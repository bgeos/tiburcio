"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, CircleAlert, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDependency, removeDependency, type DependencyFormState } from "@/lib/projects/subproject-actions";

type Sub = { id: string; name: string };
type Link = { id: string; predecessorId: string; successorId: string };

/** "X starts after Y" links between subprojects. Nothing moves; overlaps show in red. */
export function DependenciesSection({
  orgSlug,
  projectId,
  subprojects,
  dependencies,
  canEdit,
}: {
  orgSlug: string;
  projectId: string;
  subprojects: Sub[];
  dependencies: Link[];
  canEdit: boolean;
}) {
  const name = (id: string) => subprojects.find((s) => s.id === id)?.name ?? "—";

  return (
    <section aria-labelledby="order-heading" className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 id="order-heading" className="text-lg font-semibold">
          Order between subprojects
        </h2>
        <p className="text-sm text-muted-foreground">
          When a subproject can only start after another finishes. Dates never move automatically: if they clash, the
          overlap is shown in red.
        </p>
      </div>

      {dependencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No links yet.</p>
      ) : (
        <ul aria-label="Links between subprojects" className="divide-y rounded-lg border">
          {dependencies.map((d) => (
            <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Link2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{name(d.successorId)}</span> starts after{" "}
                <span className="font-medium">{name(d.predecessorId)}</span> finishes
              </span>
              {canEdit ? (
                <RemoveLink
                  orgSlug={orgSlug}
                  projectId={projectId}
                  id={d.id}
                  label={`${name(d.successorId)} after ${name(d.predecessorId)}`}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit && subprojects.length >= 2 ? <AddLink orgSlug={orgSlug} projectId={projectId} subprojects={subprojects} /> : null}
    </section>
  );
}

function RemoveLink({ orgSlug, projectId, id, label }: { orgSlug: string; projectId: string; id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Remove link: ${label}`}
      onClick={() =>
        startTransition(async () => {
          const result = await removeDependency(orgSlug, projectId, id);
          if (result.ok) toast.success("Link removed");
          else toast.error(result.message);
        })
      }
    >
      <X aria-hidden="true" />
    </Button>
  );
}

function AddLink({ orgSlug, projectId, subprojects }: { orgSlug: string; projectId: string; subprojects: Sub[] }) {
  const [state, formAction, pending] = useActionState(addDependency.bind(null, orgSlug, projectId), {
    status: "idle",
  } as DependencyFormState);
  const [successorId, setSuccessorId] = useState("");
  const [predecessorId, setPredecessorId] = useState("");

  const lastSaved = useRef(0);
  useEffect(() => {
    if (state.status === "saved" && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      toast.success("Link added");
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="successorId" value={successorId} />
        <input type="hidden" name="predecessorId" value={predecessorId} />
        <div className="grid gap-1.5">
          <Label htmlFor="dep-successor">Subproject</Label>
          <Select value={successorId} onValueChange={setSuccessorId}>
            <SelectTrigger id="dep-successor" className="w-48">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {subprojects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="pb-2 text-sm text-muted-foreground">
          starts after <ArrowRight aria-hidden="true" className="inline size-3.5" />
        </span>
        <div className="grid gap-1.5">
          <Label htmlFor="dep-predecessor">finishes</Label>
          <Select value={predecessorId} onValueChange={setPredecessorId}>
            <SelectTrigger id="dep-predecessor" className="w-48">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {subprojects
                .filter((s) => s.id !== successorId)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline" disabled={pending || !successorId || !predecessorId}>
          <Link2 aria-hidden="true" /> Add link
        </Button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
