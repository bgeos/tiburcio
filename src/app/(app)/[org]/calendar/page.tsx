import type { Metadata } from "next";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, EyeOff, Flag } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubprojectDot } from "@/components/subproject-color";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIn } from "@/lib/dates";
import { listMilestones } from "@/lib/dal/milestones";
import { requireMembership } from "@/lib/dal/organizations";
import { listLinkableTasks } from "@/lib/dal/task-links";
import {
  CALENDAR_VIEWS,
  dayOf,
  isIsoDate,
  itemsOn,
  monthWeeks,
  periodLabel,
  sameMonth,
  shiftPeriod,
  weekDays,
  type CalendarView,
} from "@/lib/domain/calendar";
import type { Milestone } from "@/lib/domain/milestones";
import { EXTERNAL_NO_PROJECTS, canViewProjects } from "@/lib/domain/projects";
import type { IsoDate } from "@/lib/domain/schedule";
import type { LinkedTask } from "@/lib/domain/task-links";
import { cn } from "@/lib/utils";
import { ProjectFilter } from "./project-filter";

export const metadata: Metadata = { title: "Calendar" };

type Props = PageProps<"/[org]/calendar">;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** Tasks shown in a month cell before "N more". */
const CELL_LIMIT = 3;

export default function CalendarPage({ params, searchParams }: Props) {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Every task on the days it runs, and the milestones, across projects. Dates come from each subproject's cronograma."
      />
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CalendarContent({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const [{ org: slug }, query] = await Promise.all([params, searchParams]);
  const org = await requireMembership(slug);
  if (!canViewProjects(org.role)) {
    return <EmptyState icon={EyeOff} title="Nothing to show yet" description={EXTERNAL_NO_PROJECTS} />;
  }
  const today = todayIn(org.timezone);
  const view: CalendarView = CALENDAR_VIEWS.find((v) => v === query.view) ?? "month";
  const date: IsoDate = isIsoDate(query.date) ? query.date : today;
  const [allTasks, milestones] = await Promise.all([listLinkableTasks(org), listMilestones(org)]);

  const projects = [...new Map(allTasks.map((t) => [t.projectId, t.projectName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const projectId = typeof query.project === "string" && projects.some(([id]) => id === query.project) ? query.project : "";
  const tasks = projectId ? allTasks.filter((t) => t.projectId === projectId) : allTasks;

  const href = (next: { view?: CalendarView; date?: IsoDate; project?: string }) => {
    const p = new URLSearchParams();
    p.set("view", next.view ?? view);
    p.set("date", next.date ?? date);
    const project = next.project ?? projectId;
    if (project) p.set("project", project);
    return `/calendar?${p.toString()}` as const;
  };
  const days = view === "month" ? monthWeeks(date).flat() : weekDays(date);
  const unit = view === "month" ? "month" : "week";

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Calendar view" className="flex gap-1">
          {CALENDAR_VIEWS.map((v) => (
            <Button key={v} size="sm" variant={v === view ? "secondary" : "ghost"} asChild>
              <OrgLink href={href({ view: v })} aria-current={v === view ? "page" : undefined}>
                {v === "month" ? "Month" : "Week"}
              </OrgLink>
            </Button>
          ))}
        </nav>
        <nav aria-label="Dates" className="flex items-center gap-1">
          <Button size="icon-sm" variant="outline" asChild>
            <OrgLink href={href({ date: shiftPeriod(date, view, -1) })} aria-label={`Previous ${unit}`}>
              <ChevronLeft aria-hidden="true" />
            </OrgLink>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <OrgLink href={href({ date: today })}>Today</OrgLink>
          </Button>
          <Button size="icon-sm" variant="outline" asChild>
            <OrgLink href={href({ date: shiftPeriod(date, view, 1) })} aria-label={`Next ${unit}`}>
              <ChevronRight aria-hidden="true" />
            </OrgLink>
          </Button>
        </nav>
        <h2 className="text-lg font-semibold" aria-live="polite">
          {periodLabel(date, view)}
        </h2>
        <div className="sm:ml-auto">
          <ProjectFilter
            value={projectId || "all"}
            options={[
              { value: "all", label: "All projects", href: `/${org.slug}${href({ project: "" })}` },
              ...projects.map(([id, name]) => ({ value: id, label: name, href: `/${org.slug}${href({ project: id })}` })),
            ]}
          />
        </div>
      </div>

      {allTasks.length === 0 && milestones.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nothing planned yet"
          description="Tasks appear here once subprojects have them, and milestones once they're added on the Projects page."
        />
      ) : view === "month" ? (
        <>
          <MonthGrid days={days} date={date} today={today} tasks={tasks} milestones={milestones} weekHref={(d) => href({ view: "week", date: d })} />
          {/* Phones: the month as a list of the days that have something. */}
          <DayList
            className="sm:hidden"
            days={days.filter((d) => sameMonth(d, date))}
            today={today}
            tasks={tasks}
            milestones={milestones}
            skipEmpty
          />
        </>
      ) : (
        <DayList days={days} today={today} tasks={tasks} milestones={milestones} />
      )}
    </>
  );
}

function TaskChip({ task, date }: { task: LinkedTask; date: IsoDate }) {
  return (
    <OrgLink
      href={`/projects/${task.projectId}/${task.subprojectId}`}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded px-1 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
        task.status === "done" && "text-muted-foreground line-through",
      )}
      title={`${task.name} · ${task.projectName} › ${task.subprojectName}`}
    >
      <SubprojectDot color={task.color} className="size-2" />
      <span className="truncate">{task.name}</span>
      <span className="sr-only">
        , {task.projectName} › {task.subprojectName}, {task.range ? dayOf(task.range, date) : ""}
      </span>
    </OrgLink>
  );
}

function MilestoneChip({ milestone }: { milestone: Milestone }) {
  return (
    <p className="flex min-w-0 items-center gap-1 rounded bg-foreground/10 px-1 text-xs font-medium">
      <Flag aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{milestone.name}</span>
      <span className="sr-only">(milestone)</span>
    </p>
  );
}

function MonthGrid({
  days,
  date,
  today,
  tasks,
  milestones,
  weekHref,
}: {
  days: IsoDate[];
  date: IsoDate;
  today: IsoDate;
  tasks: LinkedTask[];
  milestones: Milestone[];
  weekHref: (date: IsoDate) => `/${string}`;
}) {
  return (
    <div className="hidden rounded-xl border bg-card sm:block">
      <div className="grid grid-cols-7 border-b text-xs font-medium text-muted-foreground" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5">
            {d}
          </div>
        ))}
      </div>
      <ol aria-label={periodLabel(date, "month")} className="grid grid-cols-7">
        {days.map((day) => {
          const items = itemsOn(day, tasks, milestones);
          const extra = items.tasks.length - CELL_LIMIT;
          const inMonth = sameMonth(day, date);
          return (
            <li key={day} className={cn("min-h-28 space-y-0.5 border-r border-b p-1 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/40")}>
              <h3
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                  inMonth ? "font-medium" : "text-muted-foreground",
                  day === today && "bg-primary text-primary-foreground",
                )}
              >
                <span className="sr-only">{WEEKDAY_NAMES[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} </span>
                {Number(day.slice(8))}
                <span className="sr-only">
                  {" "}
                  {new Date(`${day}T00:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" })}
                  {day === today ? " (today)" : ""}
                </span>
              </h3>
              {items.milestones.map((m) => (
                <MilestoneChip key={m.id} milestone={m} />
              ))}
              {items.tasks.slice(0, CELL_LIMIT).map((t) => (
                <TaskChip key={t.id} task={t} date={day} />
              ))}
              {extra > 0 ? (
                <OrgLink href={weekHref(day)} className="block px-1 text-xs text-primary underline underline-offset-2">
                  {extra} more<span className="sr-only"> on this day, in the week view</span>
                </OrgLink>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DayList({
  days,
  today,
  tasks,
  milestones,
  skipEmpty = false,
  className,
}: {
  days: IsoDate[];
  today: IsoDate;
  tasks: LinkedTask[];
  milestones: Milestone[];
  skipEmpty?: boolean;
  className?: string;
}) {
  const shown = days.map((day) => ({ day, ...itemsOn(day, tasks, milestones) })).filter((d) => !skipEmpty || d.tasks.length || d.milestones.length);
  if (shown.length === 0) return <p className={cn("text-sm text-muted-foreground", className)}>Nothing planned in this period.</p>;
  return (
    <ol aria-label="Days" className={cn("space-y-3", className)}>
      {shown.map(({ day, tasks: dayTasks, milestones: dayMilestones }) => {
        const d = new Date(`${day}T00:00:00Z`);
        return (
          <li key={day} className="rounded-xl border bg-card p-3">
            <h3 className={cn("text-sm font-semibold", day === today && "text-primary")}>
              {WEEKDAY_NAMES[(d.getUTCDay() + 6) % 7]} {d.getUTCDate()} {d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}
              {day === today ? " · Today" : ""}
            </h3>
            {dayTasks.length === 0 && dayMilestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing planned.</p>
            ) : (
              <ul className="mt-1 divide-y">
                {dayMilestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 py-1.5 text-sm font-medium">
                    <Flag aria-hidden="true" className="size-3.5 shrink-0" /> {m.name}
                    <span className="text-muted-foreground font-normal">milestone</span>
                  </li>
                ))}
                {dayTasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
                    <SubprojectDot color={t.color} />
                    <OrgLink
                      href={`/projects/${t.projectId}/${t.subprojectId}`}
                      className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {t.name}
                    </OrgLink>
                    <span className="text-muted-foreground">
                      {t.projectName} › {t.subprojectName} · {t.range ? dayOf(t.range, day) : ""}
                    </span>
                    <StatusBadge category={t.status} className="ml-auto" />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading calendar">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
