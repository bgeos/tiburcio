"use client";

import { X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { revokeInvitation } from "@/lib/invitations/actions";

export function RevokeInvitationButton({ invitationId, email }: { invitationId: string; email: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost">
          <X aria-hidden="true" /> Revoke<span className="sr-only"> invitation for {email}</span>
        </Button>
      }
      title={`Revoke the invitation for ${email}?`}
      description="The link stops working straight away. You can send a new invitation afterwards."
      confirmLabel="Revoke"
      destructive
      onConfirm={() => revokeInvitation(invitationId)}
    />
  );
}
