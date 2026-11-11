import type { Metadata } from "next";
import { Suspense } from "react";
import { Bell, ChevronLeft, ChevronRight, EyeOff, Flag, ListTodo, Package, type LucideIcon } from "lucide-react";
import { DueNote } from "@/components/due-note";
import { EmptyState } from "@/components/empty-state";
import { MaterialStatusBadge } from "@/components/material-status-badge";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubprojectDot } from "@/components/subproject-color";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIn } from "@/lib/dates";
import { listOrganizationMaterials, type MaterialRow } from "@/lib/dal/materials";
import { listMilestones } from "@/lib/dal/milestones";
import { listMyTasks } from "@/lib/dal/my-tasks";
import { requireMembership } from "@/lib/dal/organizations";
import { listLinkableTasks } from "@/lib/dal/task-links";
import {
  CALENDAR_KINDS,
  CALENDAR_KIND_LABELS,
  CALENDAR_VIEWS,
  datedOn,
  dayOf,
  isIsoDate,
  itemsOn,
  monthWeeks,
  parseKinds,
  periodLabel,
  sameMonth,
  shiftPeriod,
  toggleKind,
  weekDays,
  type CalendarKind,
  type CalendarView,
} from "@/lib/domain/calendar";
import { isMaterialLate } from "@/lib/domain/materials";
import type { Milestone } from "@/lib/domain/milestones";
import { MY_TASK_TAG_LABELS, isMyTaskOverdue, type MyTask } from "@/lib/domain/my-tasks";
import { EXTERNAL_NO_PROJECTS, canViewProjects } from "@/lib/domain/projects";
import type { IsoDate } from "@/lib/domain/schedule";
import type { LinkedTask } from "@/lib/domain/task-links";
import { cn } from "@/lib/utils";
import { ProjectFilter } from "./project-filter";

export const metadata: Metadata = { title: "Calendar" };

type Props = PageProps<"/[org]/calendar">;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** Items shown in a month cell (besides milestones) before "N more". */
const CELL_LIMIT = 3;

/** Each kind's mark, never colour alone (D-034). Tasks keep their subproject's dot. */
const KIND_ICONS: Record<Exclude<CalendarKind, "tasks">, LucideIcon> = { materials: Package, mine: ListTodo, milestones: Flag };

/** Everything on one day besides milestones. */
type Entry =
  | { kind: "tasks"; key: string; task: LinkedTask }
  | { kind: "materials"; key: string; material: MaterialRow }
  | { kind: "mine"; key: string; task: MyTask };

type DayData = { milestones: Milestone[]; entries: Entry[] };

export default function CalendarPage({ params, searchParams }: Props) {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Tasks on the days they run, materials on the day they're needed, your own tasks and the milestones, across projects."
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
  const shown = parseKinds(query.show);
  const [allTasks, allMaterials, allMine, allMilestones] = await Promise.all([
    listLinkableTasks(org),
    listOrganizationMaterials(org),
    listMyTasks(org),
    listMilestones(org),
  ]);
  const datedMaterials = allMaterials.filter((m) => m.neededBy);
  const datedMine = allMine.filter((t) => t.dueDate);

  const projects = [
    ...new Map([
      ...allTasks.map((t) => [t.projectId, t.projectName] as const),
      ...datedMaterials.map((m) => [m.projectId, m.project] as const),
    ]).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const projectId = typeof query.project === "string" && projects.some(([id]) => id === query.project) ? query.project : "";
  // The project filter applies to project work; your own tasks and the milestones belong to no project.
  const tasks = shown.includes("tasks") ? allTasks.filter((t) => !projectId || t.projectId === projectId) : [];
  const materials = shown.includes("materials") ? datedMaterials.filter((m) => !projectId || m.projectId === projectId) : [];
  const mine = shown.includes("mine") ? datedMine : [];
  const milestones = shown.includes("milestones") ? allMilestones : [];

  const dayData = (day: IsoDate): DayData => {
    const on = itemsOn(day, tasks, milestones);
    return {
      milestones: on.milestones,
      entries: [
        ...on.tasks.map((task): Entry => ({ kind: "tasks", key: `t-${task.id}`, task })),
        ...datedOn(day, materials, (m) => m.neededBy).map((material): Entry => ({ kind: "materials", key: `m-${material.id}`, material })),
        ...datedOn(day, mine, (t) => t.dueDate).map((task): Entry => ({ kind: "mine", key: `y-${task.id}`, task })),
      ],
    };
  };

  const currentShow = shown.length === CALENDAR_KINDS.length ? null : shown.length ? shown.join(",") : "none";
  const href = (next: { view?: CalendarView; date?: IsoDate; project?: string; show?: string | null }) => {
    const p = new URLSearchParams();
    p.set("view", next.view ?? view);
    p.set("date", next.date ?? date);
    const project = next.project ?? projectId;
    if (project) p.set("project", project);
    const show = next.show === undefined ? currentShow : next.show;
    if (show) p.set("show", show);
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

      {/* The legend is also the switch: each kind can be hidden. */}
      <nav aria-label="Show on the calendar" className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-sm text-muted-foreground">Show:</span>
        {CALENDAR_KINDS.map((kind) => {
          const on = shown.includes(kind);
          return (
            <Button key={kind} size="sm" variant={on ? "secondary" : "ghost"} asChild>
              <OrgLink href={href({ show: toggleKind(shown, kind) })} className={cn(!on && "text-muted-foreground line-through")}>
                <KindIcon kind={kind} />
                <span className="sr-only">{on ? "Hide " : "Show "}</span>
                {CALENDAR_KIND_LABELS[kind]}
              </OrgLink>
            </Button>
          );
        })}
      </nav>

      {allTasks.length === 0 && datedMaterials.length === 0 && datedMine.length === 0 && allMilestones.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nothing planned yet"
          description="Tasks appear here once subprojects have them, materials and your own tasks once they have a date, and milestones once they're added on the Projects page."
        />
      ) : view === "month" ? (
        <>
          <MonthGrid days={days} date={date} today={today} dayData={dayData} weekHref={(d) => href({ view: "week", date: d })} />
          {/* Phones: the month as a list of the days that have something. */}
          <DayList className="sm:hidden" days={days.filter((d) => sameMonth(d, date))} today={today} dayData={dayData} skipEmpty />
        </>
      ) : (
        <DayList days={days} today={today} dayData={dayData} />
      )}
    </>
  );
}

/** The kind's mark: the legend, chips and rows all use the same one. */
function KindIcon({ kind, className }: { kind: CalendarKind; className?: string }) {
  if (kind === "tasks") return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full bg-current", className)} />;
  const Icon = KIND_ICONS[kind];
  return <Icon aria-hidden="true" className={cn("size-3 shrink-0", className)} />;
}

const CHIP = "flex min-w-0 items-center gap-1 rounded px-1 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";

function EntryChip({ entry, date, today }: { entry: Entry; date: IsoDate; today: IsoDate }) {
  if (entry.kind === "tasks") {
    const task = entry.task;
    return (
      <OrgLink
        href={`/projects/${task.projectId}/${task.subprojectId}`}
        className={cn(CHIP, task.status === "done" && "text-muted-foreground line-through")}
        title={`Task: ${task.name} · ${task.projectName} › ${task.subprojectName}`}
      >
        <SubprojectDot color={task.color} className="size-2" />
        <span className="truncate">{task.name}</span>
        <span className="sr-only">
          , task, {task.projectName} › {task.subprojectName}, {task.range ? dayOf(task.range, date) : ""}
        </span>
      </OrgLink>
    );
  }
  if (entry.kind === "materials") {
    const m = entry.material;
    const late = isMaterialLate(m, today);
    return (
      <OrgLink
        href={`/projects/${m.projectId}/${m.subprojectId}?tab=materials`}
        className={cn(CHIP, "border border-dashed", m.status === "on_site" && "text-muted-foreground line-through", late && "border-warning")}
        title={`Material needed: ${m.description} · ${m.project} › ${m.subproject}`}
      >
        <KindIcon kind="materials" className={late ? "text-warning" : "text-muted-foreground"} />
        <span className="truncate">{m.description}</span>
        <span className="sr-only">
          , material needed by this day, {m.project} › {m.subproject}
          {late ? ", late" : ""}
        </span>
      </OrgLink>
    );
  }
  const t = entry.task;
  const late = isMyTaskOverdue(t, today);
  const Icon = t.tag === "reminder" ? Bell : ListTodo;
  return (
    <OrgLink
      href="/tasks"
      className={cn(CHIP, "italic", t.status === "done" && "text-muted-foreground line-through")}
      title={`My task (${MY_TASK_TAG_LABELS[t.tag]}): ${t.name}`}
    >
      <Icon aria-hidden="true" className={cn("size-3 shrink-0", late ? "text-warning" : "text-muted-foreground")} />
      <span className="truncate">{t.name}</span>
      <span className="sr-only">
        , my {MY_TASK_TAG_LABELS[t.tag].toLowerCase()}
        {late ? ", overdue" : ""}
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
  dayData,
  weekHref,
}: {
  days: IsoDate[];
  date: IsoDate;
  today: IsoDate;
  dayData: (day: IsoDate) => DayData;
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
          const { milestones, entries } = dayData(day);
          const extra = entries.length - CELL_LIMIT;
          const inMonth = sameMonth(day, date);
          return (
            <li key={day} className={cn("min-h-28 min-w-0 space-y-0.5 border-r border-b p-1 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/40")}>
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
              {milestones.map((m) => (
                <MilestoneChip key={m.id} milestone={m} />
              ))}
              {entries.slice(0, CELL_LIMIT).map((e) => (
                <EntryChip key={e.key} entry={e} date={day} today={today} />
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

const ROW_LINK = "font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none";

function EntryRow({ entry, day, today }: { entry: Entry; day: IsoDate; today: IsoDate }) {
  if (entry.kind === "tasks") {
    const t = entry.task;
    return (
      <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
        <SubprojectDot color={t.color} />
        <OrgLink href={`/projects/${t.projectId}/${t.subprojectId}`} className={ROW_LINK}>
          {t.name}
        </OrgLink>
        <span className="text-muted-foreground">
          Task · {t.projectName} › {t.subprojectName} · {t.range ? dayOf(t.range, day) : ""}
        </span>
        <StatusBadge category={t.status} className="ml-auto" />
      </li>
    );
  }
  if (entry.kind === "materials") {
    const m = entry.material;
    return (
      <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
        <KindIcon kind="materials" className="size-3.5 text-muted-foreground" />
        <OrgLink href={`/projects/${m.projectId}/${m.subprojectId}?tab=materials`} className={ROW_LINK}>
          {m.description}
        </OrgLink>
        <span className="text-muted-foreground">
          Material needed · {m.project} › {m.subproject}
        </span>
        {isMaterialLate(m, today) ? <DueNote date={m.neededBy} late label="Needed by" /> : null}
        <span className="ml-auto">
          <MaterialStatusBadge status={m.status} />
        </span>
      </li>
    );
  }
  const t = entry.task;
  const Icon = t.tag === "reminder" ? Bell : ListTodo;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <OrgLink href="/tasks" className={cn(ROW_LINK, "italic")}>
        {t.name}
      </OrgLink>
      <span className="text-muted-foreground">My task · {MY_TASK_TAG_LABELS[t.tag]}</span>
      {isMyTaskOverdue(t, today) ? <DueNote date={t.dueDate} late /> : null}
      <StatusBadge category={t.status} className="ml-auto" />
    </li>
  );
}

function DayList({
  days,
  today,
  dayData,
  skipEmpty = false,
  className,
}: {
  days: IsoDate[];
  today: IsoDate;
  dayData: (day: IsoDate) => DayData;
  skipEmpty?: boolean;
  className?: string;
}) {
  const shown = days.map((day) => ({ day, ...dayData(day) })).filter((d) => !skipEmpty || d.entries.length || d.milestones.length);
  if (shown.length === 0) return <p className={cn("text-sm text-muted-foreground", className)}>Nothing planned in this period.</p>;
  return (
    <ol aria-label="Days" className={cn("space-y-3", className)}>
      {shown.map(({ day, entries, milestones }) => {
        const d = new Date(`${day}T00:00:00Z`);
        return (
          <li key={day} className="rounded-xl border bg-card p-3">
            <h3 className={cn("text-sm font-semibold", day === today && "text-primary")}>
              {WEEKDAY_NAMES[(d.getUTCDay() + 6) % 7]} {d.getUTCDate()} {d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}
              {day === today ? " · Today" : ""}
            </h3>
            {entries.length === 0 && milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing planned.</p>
            ) : (
              <ul className="mt-1 divide-y">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 py-1.5 text-sm font-medium">
                    <Flag aria-hidden="true" className="size-3.5 shrink-0" /> {m.name}
                    <span className="text-muted-foreground font-normal">milestone</span>
                  </li>
                ))}
                {entries.map((e) => (
                  <EntryRow key={e.key} entry={e} day={day} today={today} />
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
