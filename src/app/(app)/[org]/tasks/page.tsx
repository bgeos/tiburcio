import type { Metadata } from "next";
import { ListChecks, Plus } from "lucide-react";
import { ComingSoonAction } from "@/components/coming-soon-action";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="Tasks"
        description="Everything assigned to you and your teams, across all projects."
        actions={<ComingSoonAction icon={Plus} label="New task" phase="Phase 3" />}
      />
      <EmptyState
        icon={ListChecks}
        title="No tasks yet"
        description="Tasks belong to a project and can have subtasks, owners, assignees, dates, priority and progress. You'll be able to switch between table and Kanban views."
        availability="Tasks arrive in Phase 3; dependencies and the Gantt view in Phase 4."
      />
    </>
  );
}
