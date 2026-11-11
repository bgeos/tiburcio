import type { Metadata } from "next";
import { Suspense } from "react";
import { EyeOff, FolderKanban, Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMembership } from "@/lib/dal/organizations";
import { listProjects, type ProjectSummary } from "@/lib/dal/projects";
import {
  EXTERNAL_NO_PROJECTS,
  PROJECT_STATUS_CATEGORY,
  PROJECT_STATUS_LABELS,
  canEditProjects,
  canViewProjects,
} from "@/lib/domain/projects";
import { ArchiveProjectButton, RestoreProjectButton } from "./archive-project-button";
import { MilestonesSection } from "./milestones-section";
import { ProjectFormDialog } from "./project-form-dialog";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage({ params, searchParams }: PageProps<"/jupigenio/[org]/projects">) {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Festivals, events and builds. Each project is split into subprojects with their own owner, cronograma, materials and crew."
        actions={
          <Suspense fallback={null}>
            <HeaderActions params={params} />
          </Suspense>
        }
      />
      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function HeaderActions({ params }: { params: PageProps<"/jupigenio/[org]/projects">["params"] }) {
  const { org: slug } = await params;
  const org = await requireMembership(slug);
  return canEditProjects(org.role) ? (
    <ProjectFormDialog
      orgSlug={org.slug}
      trigger={
        <Button>
          <Plus aria-hidden="true" /> New project
        </Button>
      }
    />
  ) : null;
}

async function ProjectsContent({
  params,
  searchParams,
}: {
  params: PageProps<"/jupigenio/[org]/projects">["params"];
  searchParams: PageProps<"/jupigenio/[org]/projects">["searchParams"];
}) {
  const [{ org: slug }, { view }] = await Promise.all([params, searchParams]);
  const org = await requireMembership(slug);
  if (!canViewProjects(org.role)) {
    return <EmptyState icon={EyeOff} title="No projects to show" description={EXTERNAL_NO_PROJECTS} />;
  }
  const canEdit = canEditProjects(org.role);
  const projects = await listProjects(org);
  const showArchived = view === "archived";
  const active = projects.filter((p) => !p.archivedAt);
  const archived = projects.filter((p) => p.archivedAt);
  const shown = showArchived ? archived : active;

  return (
    <>
      <nav aria-label="Project lists" className="flex gap-2">
        <Button size="sm" variant={showArchived ? "ghost" : "secondary"} asChild>
          <OrgLink href="/projects" aria-current={showArchived ? undefined : "page"}>
            Current ({active.length})
          </OrgLink>
        </Button>
        <Button size="sm" variant={showArchived ? "secondary" : "ghost"} asChild>
          <OrgLink href="/projects?view=archived" aria-current={showArchived ? "page" : undefined}>
            Archived ({archived.length})
          </OrgLink>
        </Button>
      </nav>

      {shown.length === 0 ? (
        showArchived ? (
          <EmptyState icon={FolderKanban} title="No archived projects" description="Archived projects appear here and can be restored." />
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description={
              canEdit
                ? "Create your first project, for example a festival or one stage of it. Then add its subprojects: Structure, Shade Sail, DJ Booth…"
                : "Projects appear here once an admin or production manager creates them."
            }
            action={
              canEdit ? (
                <ProjectFormDialog
                  orgSlug={org.slug}
                  trigger={
                    <Button>
                      <Plus aria-hidden="true" /> New project
                    </Button>
                  }
                />
              ) : undefined
            }
          />
        )
      ) : (
        <ul aria-label={showArchived ? "Archived projects" : "Projects"} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} orgSlug={org.slug} canEdit={canEdit} />
            </li>
          ))}
        </ul>
      )}

      {showArchived ? null : <MilestonesSection org={org} />}
    </>
  );
}

function ProjectCard({ project, orgSlug, canEdit }: { project: ProjectSummary; orgSlug: string; canEdit: boolean }) {
  return (
    <Card className="h-full gap-3">
      <CardHeader className="gap-2">
        <CardTitle>
          <h2 className="text-base font-semibold">
            <OrgLink
              href={`/projects/${project.id}`}
              className="text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {project.name}
            </OrgLink>
          </h2>
        </CardTitle>
        <StatusBadge category={PROJECT_STATUS_CATEGORY[project.status]} label={PROJECT_STATUS_LABELS[project.status]} />
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm">
        {project.description ? (
          <p className="line-clamp-3 text-muted-foreground">{project.description}</p>
        ) : null}
        <p>
          {project.subprojectCount === 0
            ? "No subprojects yet"
            : `${project.subprojectCount} ${project.subprojectCount === 1 ? "subproject" : "subprojects"}`}
        </p>
      </CardContent>
      {canEdit ? (
        <CardFooter className="gap-1">
          {project.archivedAt ? (
            <RestoreProjectButton orgSlug={orgSlug} projectId={project.id} name={project.name} />
          ) : (
            <>
              <ProjectFormDialog
                orgSlug={orgSlug}
                project={project}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil aria-hidden="true" /> Edit<span className="sr-only"> {project.name}</span>
                  </Button>
                }
              />
              <ArchiveProjectButton orgSlug={orgSlug} projectId={project.id} name={project.name} />
            </>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading projects">
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
