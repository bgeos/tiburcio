import type { Metadata } from "next";
import { FolderPlus, PieChart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Overview" };

/**
 * Metrics are intentionally empty (null → "—") until real data exists.
 * Each will be calculated from persisted records as documented in
 * docs/DATA_MODEL.md (Phase 3 for projects/tasks, Phase 5 materials, Phase 6 costs).
 */
export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Progress, schedule risks, materials and costs across your productions."
      />

      <section aria-labelledby="key-figures" className="space-y-3">
        <h2 id="key-figures" className="sr-only">
          Key figures
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Active projects" value={null} hint="No projects yet" />
          <StatTile label="Open tasks" value={null} hint="No tasks yet" />
          <StatTile label="Overdue tasks" value={null} hint="No tasks yet" />
          <StatTile label="Materials short" value={null} hint="No materials yet" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by status</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={PieChart}
              title="No tasks to chart"
              description="Once tasks exist, this chart shows how many are to do, in progress, blocked and done."
              className="border-dashed bg-transparent py-8"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get started</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={FolderPlus}
              title="Create your first production"
              description="Start with a festival or event, then add areas such as Main Stage, DJ Area or Bamboo Structure as subprojects with their own owners."
              availability="Projects can be created once sign-in (Phase 2) and projects (Phase 3) are built."
              className="border-dashed bg-transparent py-8"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
