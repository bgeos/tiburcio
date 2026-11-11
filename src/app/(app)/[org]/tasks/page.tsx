import type { Metadata } from "next";
import { Suspense } from "react";
import { ListTodo } from "lucide-react";
import { DueNote } from "@/components/due-note";
import { EmptyState } from "@/components/empty-state";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIn } from "@/lib/dates";
import { listMyTasks } from "@/lib/dal/my-tasks";
import { requireMembership } from "@/lib/dal/organizations";
import { MY_TASK_TAGS, isMyTaskOverdue, type MyTask, type MyTaskTag } from "@/lib/domain/my-tasks";
import type { IsoDate } from "@/lib/domain/schedule";
import { DeleteMyTaskButton, EditMyTaskButton, MyTaskStatusSelect, MyTaskTagBadge, NewMyTaskButton } from "./my-task-controls";

export const metadata: Metadata = { title: "My tasks" };

const FILTERS: { tag: MyTaskTag | null; label: string; href: `/${string}` }[] = [
  { tag: null, label: "All", href: "/tasks" },
  { tag: "todo", label: "To do", href: "/tasks?tag=todo" },
  { tag: "reminder", label: "Reminders", href: "/tasks?tag=reminder" },
];

export default function MyTasksPage({ params, searchParams }: PageProps<"/[org]/tasks">) {
  return (
    <>
      <PageHeader
        title="My tasks"
        description="Your own to-dos and reminders. Only you can see them."
        actions={
          <Suspense fallback={null}>
            <HeaderActions params={params} />
          </Suspense>
        }
      />
      <Suspense fallback={<MyTasksSkeleton />}>
        <MyTasksContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function HeaderActions({ params }: { params: PageProps<"/[org]/tasks">["params"] }) {
  const { org: slug } = await params;
  const org = await requireMembership(slug);
  return <NewMyTaskButton orgSlug={org.slug} />;
}

async function MyTasksContent({
  params,
  searchParams,
}: {
  params: PageProps<"/[org]/tasks">["params"];
  searchParams: PageProps<"/[org]/tasks">["searchParams"];
}) {
  const [{ org: slug }, { tag: tagParam }] = await Promise.all([params, searchParams]);
  const org = await requireMembership(slug);
  const tasks = await listMyTasks(org);
  const tag = (MY_TASK_TAGS as readonly unknown[]).includes(tagParam) ? (tagParam as MyTaskTag) : null;

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description="Write down what you need to do or remember, e.g. “Call the bamboo supplier”. Tag it as a to do or a reminder, and give it a date to see it on the calendar."
        action={<NewMyTaskButton orgSlug={org.slug} />}
      />
    );
  }

  const shown = tag ? tasks.filter((t) => t.tag === tag) : tasks;
  const open = shown.filter((t) => t.status !== "done");
  const done = shown.filter((t) => t.status === "done");
  const today = todayIn(org.timezone);
  const count = (filter: MyTaskTag | null) => tasks.filter((t) => t.status !== "done" && (!filter || t.tag === filter)).length;

  return (
    <>
      <nav aria-label="Filter my tasks" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.label} size="sm" variant={f.tag === tag ? "secondary" : "ghost"} asChild>
            <OrgLink href={f.href} aria-current={f.tag === tag ? "page" : undefined}>
              {f.label} ({count(f.tag)})
            </OrgLink>
          </Button>
        ))}
      </nav>

      <section aria-labelledby="open-heading" className="space-y-3">
        <h2 id="open-heading" className="text-lg font-semibold">
          Open
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing open here. Well done.</p>
        ) : (
          <MyTaskList label="Open tasks" tasks={open} orgSlug={org.slug} today={today} />
        )}
      </section>

      {done.length ? (
        <section aria-labelledby="done-heading" className="space-y-3">
          <h2 id="done-heading" className="text-lg font-semibold">
            Done ({done.length})
          </h2>
          <MyTaskList label="Done tasks" tasks={done} orgSlug={org.slug} today={today} />
        </section>
      ) : null}
    </>
  );
}

function MyTaskList({ label, tasks, orgSlug, today }: { label: string; tasks: MyTask[]; orgSlug: string; today: IsoDate }) {
  return (
    <ul aria-label={label} className="divide-y rounded-xl border bg-card">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={task.status === "done" ? "font-medium text-muted-foreground line-through" : "font-medium"}>{task.name}</h3>
              <MyTaskTagBadge tag={task.tag} />
              <DueNote date={task.dueDate} late={isMyTaskOverdue(task, today)} />
            </div>
            {task.description ? <p className="text-sm whitespace-pre-line text-muted-foreground">{task.description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MyTaskStatusSelect orgSlug={orgSlug} task={task} />
            <EditMyTaskButton orgSlug={orgSlug} task={task} />
            <DeleteMyTaskButton orgSlug={orgSlug} task={task} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MyTasksSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
