"use client";

import { useActionState, useState } from "react";
import { CircleAlert } from "lucide-react";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { slugFromName } from "@/lib/domain/organizations";
import { createOrganization, type OrganizationFormState } from "@/lib/organizations/actions";

/** Start a new workspace (D-033, D-004). On success the action opens it, so there's no "saved" state. */
export function NewOrganizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  // A fresh form (and form state) every time the dialog opens.
  const [formKey, setFormKey] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setFormKey((k) => k + 1);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            For a job such as a festival or a client, with its own projects and calendar, kept apart from
            your personal projects.
          </DialogDescription>
        </DialogHeader>
        <NewOrganizationForm key={formKey} />
      </DialogContent>
    </Dialog>
  );
}

function NewOrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganization, { status: "idle" } as OrganizationFormState);
  const values = state.status === "invalid" || state.status === "error" ? state.values : {};
  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const [name, setName] = useState(values.name ?? "");
  const [slug, setSlug] = useState(values.slug ?? "");
  // The address follows the name until the person edits it.
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FieldGroup>
        <TextField
          name="name"
          label="Name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugFromName(e.target.value));
          }}
          errors={fieldErrors.name}
          placeholder="e.g. Summer Fest 2027"
        />
        <TextField
          name="slug"
          label="Address"
          required
          maxLength={50}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
          errors={fieldErrors.slug}
          description={`Its pages will be at /${slug || "address"}/… Lowercase letters, numbers and hyphens.`}
        />
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
          {pending ? "Creating…" : "Create workspace"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A button that opens the dialog, for pages (the sidebar menu opens it from a menu item). */
export function NewOrganizationButton({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {children}
      </Button>
      <NewOrganizationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
