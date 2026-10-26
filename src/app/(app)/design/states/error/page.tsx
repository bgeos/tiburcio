import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ErrorTrigger } from "./error-trigger";

export const metadata: Metadata = { title: "Error state demo" };

export default function ErrorDemoPage() {
  return (
    <>
      <PageHeader
        title="Error state"
        description="Throws a rendering error so the section's error boundary is shown."
      />
      <ErrorTrigger />
    </>
  );
}
