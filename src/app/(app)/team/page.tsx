import type { Metadata } from "next";
import { UserPlus, Users } from "lucide-react";
import { ComingSoonAction } from "@/components/coming-soon-action";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <PageHeader
        title="Team"
        description="Organization members, their roles, and external collaborators."
        actions={<ComingSoonAction icon={UserPlus} label="Invite member" phase="Phase 2" />}
      />
      <EmptyState
        icon={Users}
        title="No team members yet"
        description="Access is invite-only. Admins and production managers invite people by email with a role: admin, production manager, member or external collaborator."
        availability="Sign-in, organizations and invitations arrive in Phase 2."
      />
    </>
  );
}
