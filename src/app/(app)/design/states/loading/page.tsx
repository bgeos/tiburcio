import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Loading state demo" };

/** Waits ~1.5 s at request time so the segment's loading.tsx is visible. */
export default async function LoadingDemoPage() {
  await connection();
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return (
    <>
      <PageHeader
        title="Loaded"
        description="You just saw the loading skeleton while this page waited 1.5 seconds."
      />
      <Button variant="outline" asChild className="w-fit">
        <Link href="/design">Back to design system</Link>
      </Button>
    </>
  );
}
