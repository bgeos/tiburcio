import type { Metadata } from "next";
import { Suspense } from "react";
import { MailOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/dal/auth";
import { requireMembership } from "@/lib/dal/organizations";
import { listMembers, listOpenInvitations } from "@/lib/dal/team";
import { ORG_ROLE_LABELS } from "@/lib/domain/roles";
import { invitableRoles } from "@/lib/validation/invitations";
import { InviteForm } from "./invite-form";
import { RevokeInvitationButton } from "./revoke-invitation-button";

export const metadata: Metadata = { title: "Team" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function TeamPage({ params }: PageProps<"/[org]/team">) {
  return (
    <>
      <PageHeader
        title="Team"
        description="Members of this organization and their roles. Access is invitation-only."
      />
      <Suspense fallback={<TeamSkeleton />}>
        <TeamContent params={params} />
      </Suspense>
    </>
  );
}

async function TeamContent({ params }: { params: PageProps<"/[org]/team">["params"] }) {
  const { org: slug } = await params;
  const [user, org] = await Promise.all([requireUser(), requireMembership(slug)]);
  const roles = invitableRoles(org.role);
  const canInvite = roles.length > 0;
  const [members, invitations] = await Promise.all([
    listMembers(org),
    canInvite ? listOpenInvitations(org) : Promise.resolve([]),
  ]);

  return (
    <>
      {canInvite ? (
        <section aria-labelledby="invite-heading" className="space-y-3 rounded-xl border bg-card p-4">
          <h2 id="invite-heading" className="text-lg font-semibold">
            Invite someone
          </h2>
          <InviteForm orgSlug={org.slug} roles={roles} />
        </section>
      ) : null}

      <section aria-labelledby="members-heading" className="space-y-3">
        <h2 id="members-heading" className="text-lg font-semibold">
          Members <span className="text-muted-foreground tabular-nums">({members.length})</span>
        </h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium whitespace-normal">
                    {m.fullName || <span className="text-muted-foreground">—</span>}
                    {m.userId === user.id ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                  </TableCell>
                  <TableCell className="break-all whitespace-normal">{m.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ORG_ROLE_LABELS[m.role]}</Badge>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap sm:table-cell">{dateFormat.format(new Date(m.joinedAt))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {canInvite ? (
        <section aria-labelledby="invitations-heading" className="space-y-3">
          <h2 id="invitations-heading" className="text-lg font-semibold">
            Open invitations <span className="text-muted-foreground tabular-nums">({invitations.length})</span>
          </h2>
          {invitations.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <MailOpen aria-hidden="true" className="size-4" /> No open invitations.
            </p>
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden sm:table-cell">Expires</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium break-all whitespace-normal">{inv.email}</TableCell>
                      <TableCell>{ORG_ROLE_LABELS[inv.role]}</TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">{dateFormat.format(new Date(inv.expiresAt))}</TableCell>
                      <TableCell className="text-right">
                        {roles.includes(inv.role) ? (
                          <RevokeInvitationButton invitationId={inv.id} email={inv.email} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}

function TeamSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading team">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
