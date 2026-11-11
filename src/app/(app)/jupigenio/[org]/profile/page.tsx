import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NewOrganizationButton } from "@/components/shell/new-organization-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal/auth";
import { getMyMemberships } from "@/lib/dal/organizations";
import { DEFAULT_SECTION, orgHref } from "@/lib/navigation";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your profile" };

/** The signed-in person's own name and appearance (D-027). Same in every organization. */
export default function ProfilePage({ params }: PageProps<"/jupigenio/[org]/profile">) {
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Your name, and how Tibúrcio looks for you on every device."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-xl" aria-label="Loading your profile" />}>
        <ProfileContent />
      </Suspense>
      <Suspense fallback={<Skeleton className="mt-10 h-40 w-full max-w-xl" aria-label="Loading your organizations" />}>
        <Organizations params={params} />
      </Suspense>
    </>
  );
}

async function ProfileContent() {
  const user = await requireUser();
  return <ProfileForm email={user.email} fullName={user.fullName} accentColor={user.accentColor} themeMode={user.themeMode} />;
}

/** Every workspace, to switch between them or start a new one (D-004). */
async function Organizations({ params }: { params: PageProps<"/jupigenio/[org]/profile">["params"] }) {
  const [{ org }, memberships] = await Promise.all([params, getMyMemberships()]);
  return (
    <section aria-labelledby="organizations-heading" className="mt-10 max-w-xl space-y-4">
      <div>
        <h2 id="organizations-heading" className="text-lg font-semibold">
          Your workspaces
        </h2>
        <p className="text-sm text-muted-foreground">
          One per job, e.g. a festival, each with its own projects and calendar. You can also switch from the name at the top of the sidebar.
        </p>
      </div>
      <ul className="divide-y rounded-lg border">
        {memberships.map((m) => (
          <li key={m.slug} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.name}</p>
            </div>
            {m.slug === org ? (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Check aria-hidden="true" className="size-4" /> Current
              </span>
            ) : (
              <Link href={orgHref(m.slug, DEFAULT_SECTION)} className="text-sm font-medium underline underline-offset-4">
                Open<span className="sr-only"> {m.name}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
      <NewOrganizationButton>
        <Plus aria-hidden="true" /> New workspace
      </NewOrganizationButton>
    </section>
  );
}
