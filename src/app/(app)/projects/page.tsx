import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, FolderKanban, Plus } from "lucide-react";
import { ComingSoonAction } from "@/components/coming-soon-action";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Festivals, events and builds, with as many nested subprojects as you need."
        actions={<ComingSoonAction icon={Plus} label="New project" phase="Phase 3" />}
      />
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="A project can be a whole festival or one area of it. Each subproject — stage structure, shade sail, DJ area, sewing — gets its own owner, team, schedule, materials and costs."
        availability="Creating projects arrives in Phase 3, after sign-in and organizations (Phase 2)."
        action={
          <Button variant="outline" asChild>
            <Link href="/projects/prototype">
              <FlaskConical aria-hidden="true" /> Try the prototype (demo data)
            </Link>
          </Button>
        }
      />
    </>
  );
}
