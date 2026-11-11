import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { JUPIGENIO_PATH } from "@/lib/navigation";

export const metadata: Metadata = { title: "Home" };

/**
 * Tibúrcio's Home. A placeholder until Phase 2 builds the Command Center from
 * docs/design/homepage.dc.html; for now it links to the modules that exist.
 */
export default function HomePage() {
  return (
    <>
      <PageHeader title="Tibúrcio" description="Olá chefe! The Command Center arrives in Phase 2." />
      <div>
        <Button asChild>
          <Link href={JUPIGENIO_PATH}>
            <FolderKanban aria-hidden="true" /> Open jupigenio
          </Link>
        </Button>
      </div>
    </>
  );
}
