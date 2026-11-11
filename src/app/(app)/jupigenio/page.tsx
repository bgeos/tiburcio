import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NewOrganizationButton } from "@/components/shell/new-organization-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyMemberships, homePath } from "@/lib/dal/organizations";

export const metadata: Metadata = { title: "jupigenio" };

/**
 * `/jupigenio` picks the workspace: the first one (by name). `?section=projects` lands
 * on that section (used by links outside a workspace, e.g. on /design). With no
 * workspace yet, it offers to start one (D-004).
 *
 * A page rather than a Route Handler, so client-side navigations (Links,
 * Server Action redirects) can follow the redirect too.
 */
export default function JupigenioPage({ searchParams }: PageProps<"/jupigenio">) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <PickWorkspace searchParams={searchParams} />
    </Suspense>
  );
}

async function PickWorkspace({ searchParams }: { searchParams: PageProps<"/jupigenio">["searchParams"] }) {
  const [memberships, { section }] = await Promise.all([getMyMemberships(), searchParams]);
  const path = homePath(memberships, section);
  if (path) redirect(path);

  return (
    <EmptyState
      icon={FolderKanban}
      title="No workspace yet"
      description="A workspace holds one job, such as a festival, with its own projects, cronograma and calendar, kept apart from your personal projects."
      action={
        <NewOrganizationButton>
          <Plus aria-hidden="true" /> New workspace
        </NewOrganizationButton>
      }
    />
  );
}
