import type { Metadata } from "next";
import { Suspense } from "react";
import { EyeOff, Package } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listOrganizationMaterials, listSubprojectChoices } from "@/lib/dal/materials";
import { requireMembership } from "@/lib/dal/organizations";
import { todayIn } from "@/lib/dates";
import { EXTERNAL_NO_PROJECTS, canEditProjects, canViewProjects } from "@/lib/domain/projects";
import { AddMaterialDialog } from "./add-material-dialog";
import { MaterialsTable } from "./materials-table";

export const metadata: Metadata = { title: "Materials" };

/** Every material listed in every subproject (D-019); admins and production managers add them here too. */
export default function MaterialsPage({ params }: PageProps<"/[org]/materials">) {
  return (
    <>
      <PageHeader
        title="Materials"
        description="Everything your subprojects need, in one list. Add materials here or in a subproject's Materials tab."
        actions={
          <Suspense fallback={null}>
            <HeaderActions params={params} />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-72 w-full" aria-label="Loading materials" />}>
        <MaterialsContent params={params} />
      </Suspense>
    </>
  );
}

async function HeaderActions({ params }: { params: PageProps<"/[org]/materials">["params"] }) {
  const { org: slug } = await params;
  const org = await requireMembership(slug);
  if (!canEditProjects(org.role)) return null;
  const choices = await listSubprojectChoices(org);
  return choices.length ? <AddMaterialDialog orgSlug={org.slug} choices={choices} /> : null;
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
        description={
          canEditProjects(org.role)
            ? "Add one with “Add material”, choosing the subproject that needs it. A project needs a subproject first."
            : "Materials appear here once an admin or production manager lists them."
        }
        action={
          <Button variant="outline" asChild>
            <OrgLink href="/projects">Go to projects</OrgLink>
          </Button>
        }
      />
    );
  }
  return <MaterialsTable rows={rows} orgSlug={org.slug} today={todayIn(org.timezone)} />;
}
