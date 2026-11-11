"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout. It replaces the root
 * layout, so it renders its own <html>/<body> and avoids app providers.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-svh items-center justify-center bg-canvas px-4 font-sans">
        <main role="alert" className="max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Tibúrcio couldn&apos;t load</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error stopped the app from starting. Your data has not been changed.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
