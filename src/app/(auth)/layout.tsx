import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-canvas px-4 py-12">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-md font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          J
        </span>
        Tibúrcio
      </Link>
      <main id="main" className="w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}
