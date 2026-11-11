"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { Membership } from "@/lib/dal/organizations";
import { DEFAULT_SECTION, JUPIGENIO_PATH, orgHref } from "@/lib/navigation";
import { NewOrganizationDialog } from "./new-organization-dialog";

function OrgBadge({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
    >
      {name.trim().charAt(0).toUpperCase() || "J"}
    </span>
  );
}

export function OrgSwitcherMenu({ memberships }: { memberships: Membership[] }) {
  const { org } = useParams<{ org?: string }>();
  // Outside an organization (e.g. /design), show the first one; links still work.
  const current = memberships.find((m) => m.slug === org) ?? memberships[0];
  const [creating, setCreating] = useState(false);

  if (!current) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <Link href={JUPIGENIO_PATH}>
              <OrgBadge name="jupigenio" />
              <span className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">jupigenio</span>
                <span className="text-xs text-muted-foreground">No workspace yet</span>
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const label = (
    <>
      <OrgBadge name={current.name} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left leading-none">
        <span className="truncate font-semibold">{current.name}</span>
        <span className="truncate text-xs text-muted-foreground">Workspace</span>
      </span>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" tooltip={current.name}>
                {label}
                <span className="sr-only">, switch workspace</span>
                <ChevronsUpDown aria-hidden="true" className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
              {memberships.map((m) => (
                <DropdownMenuItem key={m.slug} asChild>
                  <Link href={orgHref(m.slug, DEFAULT_SECTION)} aria-current={m.slug === current.slug ? "page" : undefined}>
                    <OrgBadge name={m.name} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{m.name}</span>
                    </span>
                    {m.slug === current.slug ? <Check aria-hidden="true" /> : null}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreating(true)}>
                <Plus aria-hidden="true" />
                New workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        <NewOrganizationDialog open={creating} onOpenChange={setCreating} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
