import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DesignShowcase } from "./design-showcase";

export const metadata: Metadata = { title: "Design system" };

const STATE_LINKS = [
  { href: "/design/states/loading", label: "Loading" },
  { href: "/design/states/error", label: "Error" },
  { href: "/design/states/not-found", label: "Not found (404)" },
  { href: "/design/states/unauthorized", label: "Unauthorized (401)" },
  { href: "/design/states/forbidden", label: "Forbidden (403)" },
];

/**
 * Internal reference page for the component library and app states.
 * Contains only clearly labelled demo data. Review for removal or
 * admin-only access in Phase 9.
 */
export default function DesignPage() {
  return (
    <>
      <PageHeader
        title="Design system"
        description="Internal reference for Tibúrcio's components and page states."
      />
      <section aria-labelledby="states" className="space-y-3">
        <h2 id="states" className="text-lg font-semibold">
          Page states
        </h2>
        <div className="flex flex-wrap gap-2">
          {STATE_LINKS.map((link) => (
            <Button key={link.href} variant="outline" size="sm" asChild>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
      </section>
      <DesignShowcase />
    </>
  );
}
