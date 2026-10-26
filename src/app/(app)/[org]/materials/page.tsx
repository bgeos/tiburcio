import type { Metadata } from "next";
import { Suspense } from "react";
import { EyeOff, Package } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listOrganizationMaterials } from "@/lib/dal/materials";
import { requireMembership } from "@/lib/dal/organizations";
import { EXTERNAL_NO_PROJECTS, canViewProjects } from "@/lib/domain/projects";
import { MaterialsTable } from "./materials-table";

export const metadata: Metadata = { title: "Materials" };

/** Every material listed in every subproject (D-019). Stock tracking is Phase 5. */
export default function MaterialsPage({ params }: PageProps<"/[org]/materials">) {
  return (
    <>
      <PageHeader
        title="Materials"
        description="Everything your subprojects need, in one list. Add or update materials in a subproject's Materials tab and they appear here."
      />
      <Suspense fallback={<Skeleton className="h-72 w-full" aria-label="Loading materials" />}>
        <MaterialsContent params={params} />
      </Suspense>
    </>
  );
}

async function MaterialsContent({ params }: { params: PageProps<"/[org]/materials">["params"] }) {
  const { org: slug } = await params;
  const org = await requireMembership(slug);
  if (!canViewProjects(org.role)) {
    return <EmptyState icon={EyeOff} title="No materials to show" description={EXTERNAL_NO_PROJECTS} />;
  }
  const rows = await listOrganizationMaterials(org);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No materials yet"
        description="Materials are listed per subproject: open a project, then a subproject, then its Materials tab."
        action={
          <Button variant="outline" asChild>
            <OrgLink href="/projects">Go to projects</OrgLink>
          </Button>
        }
      />
    );
  }
  return <MaterialsTable rows={rows} orgSlug={org.slug} />;
}
