import type { Metadata } from "next";
import { FlaskConical, Package, Plus } from "lucide-react";
import { ComingSoonAction } from "@/components/coming-soon-action";
import { EmptyState } from "@/components/empty-state";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Materials" };

export default function MaterialsPage() {
  return (
    <>
      <PageHeader
        title="Materials"
        description="Shared catalogue and stock: what's on hand, reserved, requested and consumed."
        actions={<ComingSoonAction icon={Plus} label="Add material" phase="Phase 5" />}
      />
      <EmptyState
        icon={Package}
        title="No materials yet"
        description="Add materials like bamboo, plywood, rope or fabric once, then request and reserve them for projects and tasks. Every receipt, issue, return and adjustment is recorded."
        availability="The material catalogue and stock movements arrive in Phase 5."
        action={
          <Button variant="outline" asChild>
            <OrgLink href="/projects/prototype/materials">
              <FlaskConical aria-hidden="true" /> Try the prototype (demo data)
            </OrgLink>
          </Button>
        }
      />
    </>
  );
}
