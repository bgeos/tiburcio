"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // Phase 9: report to error monitoring instead of the console.
    console.error(error);
  }, [error]);

  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : undefined;

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border bg-card px-6 py-12 text-center"
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-status-blocked-soft text-status-blocked">
        <TriangleAlert aria-hidden="true" className="size-5" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          This section couldn&apos;t be displayed. Your data has not been changed.
          Try again, or go back to the overview.
        </p>
        {digest ? (
          <p className="pt-1 font-mono text-xs text-muted-foreground">Reference: {digest}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to Home</Link>
        </Button>
      </div>
    </div>
  );
}
