"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { workspacePath } from "@/lib/navigation";

/** Prefix a path inside a workspace: "/projects" → "/jupigenio/jupi/projects". */
export function useOrgPath(path: `/${string}`): string {
  const { org } = useParams<{ org?: string }>();
  return org ? workspacePath(org, path) : path;
}

/** A `Link` to a path inside the current organization (D-016). */
export function OrgLink({
  href,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: `/${string}` }) {
  return <Link href={useOrgPath(href)} {...props} />;
}
