import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NewOrganizationButton } from "@/components/shell/new-organization-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal/auth";
import { getMyMemberships } from "@/lib/dal/organizations";
import { CAN_CREATE_ORGANIZATION } from "@/lib/domain/organizations";
import { ORG_ROLE_LABELS } from "@/lib/domain/roles";
import { DEFAULT_SECTION, orgHref } from "@/lib/navigation";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your profile" };

/** The signed-in person's own name and appearance (D-027). Same in every organization. */
export default function ProfilePage({ params }: PageProps<"/[org]/profile">) {
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Your name as others see it, and how JupiGenio looks for you on every device."
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

/** Every organization the person is in, to switch between them; admins and PMs can start one (D-033). */
async function Organizations({ params }: { params: PageProps<"/[org]/profile">["params"] }) {
  const [{ org }, memberships] = await Promise.all([params, getMyMemberships()]);
  const canCreate = memberships.some((m) => (CAN_CREATE_ORGANIZATION as readonly string[]).includes(m.role));
  return (
    <section aria-labelledby="organizations-heading" className="mt-10 max-w-xl space-y-4">
      <div>
        <h2 id="organizations-heading" className="text-lg font-semibold">
          Your organizations
        </h2>
        <p className="text-sm text-muted-foreground">
          Each one has its own projects, team and calendar. You can also switch from the name at the top of the sidebar.
        </p>
      </div>
      <ul className="divide-y rounded-lg border">
        {memberships.map((m) => (
          <li key={m.slug} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.name}</p>
              <p className="text-sm text-muted-foreground">{ORG_ROLE_LABELS[m.role]}</p>
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
      {canCreate ? (
        <NewOrganizationButton>
          <Plus aria-hidden="true" /> New organization
        </NewOrganizationButton>
      ) : null}
    </section>
  );
}
