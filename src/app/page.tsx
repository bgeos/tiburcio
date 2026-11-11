import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMyMemberships, homePath } from "@/lib/dal/organizations";

/**
 * `/` picks the organization: the first one (by name) the person belongs to.
 * `/?section=projects` lands on that section (used by links outside an
 * organization, e.g. on /design). No membership → the "ask for an invitation"
 * page. Signed-out visitors never get here: the proxy sends them to /login.
 *
 * A page rather than a Route Handler, so client-side navigations (Links,
 * Server Action redirects) can follow the redirect too.
 */
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={null}>
      <PickOrganization searchParams={searchParams} />
    </Suspense>
  );
}

// Always redirects; the return type just lets it be used as a component.
async function PickOrganization({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}): Promise<React.ReactNode> {
  const [memberships, { section }] = await Promise.all([getMyMemberships(), searchParams]);
  redirect(homePath(memberships, section));
}
