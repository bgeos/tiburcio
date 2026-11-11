import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMembership } from "@/lib/dal/organizations";

/**
 * Everything under /<org>/… (D-016). The gate checks membership before any page
 * renders: non-members get the 404 page. This is a friendly early check; the data
 * itself is still protected by RLS.
 */
export default function OrganizationLayout({ children, params }: LayoutProps<"/[org]">) {
  return (
    <Suspense fallback={<OrganizationSkeleton />}>
      <MembershipGate params={params}>{children}</MembershipGate>
    </Suspense>
  );
}

async function MembershipGate({
  params,
  children,
}: {
  params: LayoutProps<"/[org]">["params"];
  children: React.ReactNode;
}) {
  const { org } = await params;
  await requireMembership(org);
  return <>{children}</>;
}

function OrganizationSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
