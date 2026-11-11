"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { CircleAlert, Crown, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrewView } from "@/lib/dal/project-detail";
import { addCrewMember, archiveCrewMember, setSubprojectOwner, type CrewFormState } from "@/lib/projects/crew-actions";

type Scope = { orgSlug: string; projectId: string; subprojectId: string; subprojectName: string };

export function CrewTab({
  scope,
  crew,
  ownerCrewId,
  canEdit,
}: {
  scope: Scope;
  crew: CrewView[];
  ownerCrewId: string | null;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      {crew.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No crew yet"
          description={
            canEdit
              ? "Add the people working on this subproject with their role, then pick one as the owner."
              : "The crew appears here once an admin or production manager adds them."
          }
        />
      ) : (
        <ul aria-label={`${scope.subprojectName} crew`} className="divide-y rounded-xl border bg-card">
          {crew.map((member) => {
            const isOwner = member.id === ownerCrewId;
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role || "—"}</p>
                </div>
                {isOwner ? (
                  <Badge variant="secondary">
                    <Crown aria-hidden="true" /> Owner
                  </Badge>
                ) : canEdit ? (
                  <MakeOwnerButton scope={scope} member={member} />
                ) : null}
                {canEdit ? <RemoveCrewButton scope={scope} member={member} isOwner={isOwner} /> : null}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit ? <AddCrewForm scope={scope} /> : null}
      <p className="text-xs text-muted-foreground">Crew don&apos;t sign in. Daily costs per person come later.</p>
    </div>
  );
}

function MakeOwnerButton({ scope, member }: { scope: Scope; member: CrewView }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setSubprojectOwner(scope.orgSlug, scope.projectId, scope.subprojectId, member.id);
          if (result.ok) toast.success(`${member.name} is now the owner`);
          else toast.error(result.message);
        })
      }
    >
      <Crown aria-hidden="true" /> Make owner<span className="sr-only"> {member.name}</span>
    </Button>
  );
}

function RemoveCrewButton({ scope, member, isOwner }: { scope: Scope; member: CrewView; isOwner: boolean }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${member.name}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      }
      title={`Remove ${member.name} from the crew?`}
      description={
        isOwner
          ? `${member.name} is the owner, so ${scope.subprojectName} will have no owner until you pick another one. The history keeps a record.`
          : "The history keeps a record."
      }
      confirmLabel="Remove"
      destructive
      onConfirm={async () => {
        const result = await archiveCrewMember(scope.orgSlug, scope.projectId, scope.subprojectId, member.id);
        if (result.ok) toast.success(`Removed ${member.name}`);
        else toast.error(result.message);
      }}
    />
  );
}

function AddCrewForm({ scope }: { scope: Scope }) {
  const [state, formAction, pending] = useActionState(
    addCrewMember.bind(null, scope.orgSlug, scope.projectId, scope.subprojectId),
    { status: "idle" } as CrewFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const lastSaved = useRef(0);
  useEffect(() => {
    if (state.status === "saved" && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      formRef.current?.reset();
    }
  }, [state]);

  const nameError = state.status === "invalid" ? state.fieldErrors.name?.[0] : null;
  const roleError = state.status === "invalid" ? state.fieldErrors.role?.[0] : null;
  const error = nameError ?? roleError ?? (state.status === "error" ? state.message : null);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-48 flex-1 gap-1.5">
          <Label htmlFor="new-crew-name">Name</Label>
          <Input id="new-crew-name" name="name" maxLength={120} aria-invalid={nameError ? true : undefined} />
        </div>
        <div className="grid min-w-40 flex-1 gap-1.5">
          <Label htmlFor="new-crew-role">Role</Label>
          <Input id="new-crew-role" name="role" maxLength={80} placeholder="e.g. Rigger" aria-invalid={roleError ? true : undefined} />
        </div>
        <Button type="submit" disabled={pending}>
          <Plus aria-hidden="true" /> Add crew member
        </Button>
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </form>
  );
}
