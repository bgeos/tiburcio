"use client";

import { useActionState } from "react";
import { Archive, Inbox, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { DemoDataNotice } from "@/components/demo-data-notice";
import { EmptyState } from "@/components/empty-state";
import { TextField, TextareaField } from "@/components/form/text-field";
import { StatTile } from "@/components/stat-tile";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_TASKS, type DemoTask } from "@/lib/demo/demo-tasks";
import { PRIORITIES, PRIORITY_RANK, STATUS_CATEGORIES } from "@/lib/domain/status";
import { parseForm, type FormState } from "@/lib/validation/form";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });

const TASK_COLUMNS: DataTableColumn<DemoTask>[] = [
  {
    id: "title",
    header: "Task",
    cell: (row) => (
      <div className="min-w-48">
        <p className="font-medium">{row.title}</p>
        <p className="text-xs text-muted-foreground">{row.project}</p>
      </div>
    ),
    sortValue: (row) => row.title,
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => <StatusBadge category={row.status} />,
    sortValue: (row) => STATUS_CATEGORIES.indexOf(row.status),
  },
  {
    id: "priority",
    header: "Priority",
    cell: (row) => <PriorityBadge priority={row.priority} />,
    sortValue: (row) => PRIORITY_RANK[row.priority],
  },
  {
    id: "owner",
    header: "Owner",
    cell: (row) => row.owner,
    sortValue: (row) => row.owner,
  },
  {
    id: "due",
    header: "Due",
    cell: (row) =>
      row.due ? (
        dateFormat.format(new Date(row.due))
      ) : (
        <span className="text-muted-foreground">No date</span>
      ),
    sortValue: (row) => (row.due ? new Date(row.due) : null),
  },
  {
    id: "progress",
    header: "Progress",
    align: "right",
    cell: (row) =>
      row.progress === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        `${row.progress}%`
      ),
    sortValue: (row) => row.progress,
  },
];

const demoTaskSchema = z.object({
  title: z.string().trim().min(3, "Give the task a title of at least 3 characters."),
  description: z.string().trim().max(500, "Keep the description under 500 characters."),
});

async function validateDemoTask(
  _previous: FormState<z.infer<typeof demoTaskSchema>>,
  formData: FormData,
): Promise<FormState<z.infer<typeof demoTaskSchema>>> {
  const result = parseForm(demoTaskSchema, formData);
  if (!result.success) {
    return { status: "invalid", fieldErrors: result.fieldErrors, values: result.values };
  }
  toast.success("Form is valid", {
    description: "Demo only — nothing was saved.",
  });
  return { status: "success", message: "Valid" };
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DemoTaskForm() {
  const [state, formAction, pending] = useActionState(validateDemoTask, { status: "idle" });
  const errors = state.status === "invalid" ? state.fieldErrors : {};
  const values = state.status === "invalid" ? state.values : {};

  return (
    <form action={formAction} noValidate className="max-w-md space-y-4">
      <FieldGroup>
        <TextField
          name="title"
          label="Task title"
          required
          defaultValue={values.title}
          errors={errors.title}
          description="Short and specific, e.g. “Cut plywood for DJ booth front”."
        />
        <TextareaField
          name="description"
          label="Description"
          defaultValue={values.description}
          errors={errors.description}
        />
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        Validate
      </Button>
    </form>
  );
}

export function DesignShowcase() {
  return (
    <div className="space-y-10">
      <Section id="buttons" title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>
            <Plus aria-hidden="true" /> Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2 aria-hidden="true" /> Destructive
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section
        id="badges"
        title="Status and priority"
        description="Every status shows an icon and a label; colour is never the only signal."
      >
        <div className="flex flex-wrap gap-2">
          {STATUS_CATEGORIES.map((category) => (
            <StatusBadge key={category} category={category} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {PRIORITIES.map((priority) => (
            <PriorityBadge key={priority} priority={priority} />
          ))}
        </div>
      </Section>

      <Section id="tiles" title="Stat tiles">
        <DemoDataNotice />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Active projects (demo)" value={5} />
          <StatTile label="Open tasks (demo)" value={18} hint="3 due this week" />
          <StatTile label="Overdue tasks (demo)" value={2} />
          <StatTile label="No data example" value={null} hint="No tasks yet" />
        </div>
      </Section>

      <Section id="table" title="Data table" description="Click a column header to sort; empty values stay last.">
        <DemoDataNotice />
        <DataTable
          rows={DEMO_TASKS}
          columns={TASK_COLUMNS}
          getRowId={(row) => row.id}
          caption="Demo tasks"
          empty={null}
        />
      </Section>

      <Section id="forms" title="Form fields and validation" description="Submit empty to see validation messages.">
        <DemoTaskForm />
      </Section>

      <Section id="dialogs" title="Dialogs and toasts">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit in context</DialogTitle>
                <DialogDescription>
                  Dialogs let people create and edit records without leaving the page.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            trigger={
              <Button variant="destructive">
                <Archive aria-hidden="true" /> Archive project
              </Button>
            }
            title="Archive “Demo Festival”?"
            description="Archived projects are hidden from views but keep their history. You can restore them later."
            confirmLabel="Archive"
            destructive
            onConfirm={async () => {
              await new Promise((resolve) => setTimeout(resolve, 400));
              toast("Archived (demo)", { description: "Nothing was changed." });
            }}
          />

          <Button
            variant="secondary"
            onClick={() => toast.error("Couldn't save", { description: "Demo error toast." })}
          >
            Error toast
          </Button>
        </div>
      </Section>

      <Section id="empty" title="Empty state">
        <EmptyState
          icon={Inbox}
          title="No reservations"
          description="Reserve materials for this task so they're set aside before work starts."
          action={<Button size="sm">Reserve material</Button>}
        />
      </Section>

      <Section id="loading" title="Loading skeleton">
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Section>
    </div>
  );
}
