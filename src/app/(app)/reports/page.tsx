import type { Metadata } from "next";
import { BarChart3, Download } from "lucide-react";
import { ComingSoonAction } from "@/components/coming-soon-action";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Budgets versus actual costs, schedule and material reports, and exports."
        actions={<ComingSoonAction icon={Download} label="Export CSV" phase="Phase 6" />}
      />
      <EmptyState
        icon={BarChart3}
        title="Nothing to report yet"
        description="Reports are calculated from your real projects, tasks, stock movements and costs — never from sample numbers. Each figure will show how it was calculated."
        availability="Budgets, charts and CSV exports arrive in Phase 6."
      />
    </>
  );
}
