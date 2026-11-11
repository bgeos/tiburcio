import { Flag } from "lucide-react";
import { todayIn } from "@/lib/dates";
import { listMilestones } from "@/lib/dal/milestones";
import type { Membership } from "@/lib/dal/organizations";
import { canEditProjects } from "@/lib/domain/projects";
import { daysBetween } from "@/lib/domain/schedule";
import { formatDate, pluralDays } from "@/lib/format";
import { DeleteMilestoneButton, EditMilestoneButton, NewMilestoneButton } from "./milestone-controls";

/** The organization's key dates, shown in every project (D-030). Editors add, change and delete them. */
export async function MilestonesSection({ org }: { org: Membership }) {
  const milestones = await listMilestones(org);
  const canEdit = canEditProjects(org.role);
  const today = todayIn(org.timezone);

  return (
    <section aria-labelledby="milestones-heading" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="milestones-heading" className="flex items-center gap-2 text-lg font-semibold">
            <Flag aria-hidden="true" className="size-4" /> Milestones
          </h2>
          <p className="text-sm text-muted-foreground">
            Key dates for every project, like “Festival opens”. Link a task to one in its Links to check it’s done in time.
          </p>
        </div>
        {canEdit ? <NewMilestoneButton orgSlug={org.slug} /> : null}
      </div>
      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit ? "No milestones yet." : "No milestones yet. Admins and production managers add them."}
        </p>
      ) : (
        <ul aria-label="Milestones" className="divide-y">
          {milestones.map((m) => {
            const days = daysBetween(today, m.date);
            return (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-16 shrink-0 text-sm font-medium tabular-nums">{formatDate(m.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{m.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {days === 0 ? "Today" : days > 0 ? `In ${pluralDays(days)}` : `${pluralDays(-days)} ago`}
                  </span>
                </span>
                {canEdit ? (
                  <span className="flex shrink-0 gap-1">
                    <EditMilestoneButton orgSlug={org.slug} milestone={m} />
                    <DeleteMilestoneButton orgSlug={org.slug} milestone={m} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
