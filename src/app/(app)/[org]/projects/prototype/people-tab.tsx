"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProtoSubproject } from "@/lib/demo/demo-projects";
import type { ChangeLog } from "./prototype-model";

export function PeopleTab({
  sub,
  onChange,
}: {
  sub: ProtoSubproject;
  onChange: (subproject: ProtoSubproject, log: ChangeLog) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const person = { id: crypto.randomUUID(), name: name.trim(), role: role.trim() || "Crew" };
    onChange(
      { ...sub, people: [...sub.people, person] },
      { summary: `Person added: ${person.name} (${person.role})` },
    );
    setName("");
    setRole("");
  }

  return (
    <div className="space-y-4">
      <ul aria-label={`${sub.name} people`} className="divide-y rounded-lg border bg-card">
        {sub.people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{person.name}</p>
              <p className="text-xs text-muted-foreground">{person.role}</p>
            </div>
            {person.id === sub.ownerId ? (
              <Badge variant="secondary">Owner</Badge>
            ) : (
              <ConfirmDialog
                trigger={
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${person.name}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                }
                title={`Remove ${person.name} from ${sub.name}?`}
                description="The history keeps a record."
                confirmLabel="Remove"
                destructive
                onConfirm={() =>
                  onChange(
                    { ...sub, people: sub.people.filter((p) => p.id !== person.id) },
                    { summary: `Person removed: ${person.name}` },
                  )
                }
              />
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-48 flex-1 gap-1.5">
          <Label htmlFor="new-person">Name</Label>
          <Input id="new-person" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid min-w-40 flex-1 gap-1.5">
          <Label htmlFor="new-role">Role</Label>
          <Input id="new-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Rigger" />
        </div>
        <Button type="submit" disabled={!name.trim()}>
          <Plus aria-hidden="true" /> Add person
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">Crew don&apos;t sign in. Daily costs per person come later.</p>
    </div>
  );
}
