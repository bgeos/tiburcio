"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { Membership } from "@/lib/dal/organizations";
import { ORG_ROLE_LABELS } from "@/lib/domain/roles";
import { DEFAULT_SECTION, orgHref } from "@/lib/navigation";

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

  if (!current) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <Link href="/no-organization">
              <OrgBadge name="JupiGenio" />
              <span className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">JupiGenio</span>
                <span className="text-xs text-muted-foreground">No organization</span>
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
        <span className="truncate text-xs text-muted-foreground">{ORG_ROLE_LABELS[current.role]}</span>
      </span>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {memberships.length === 1 ? (
          <SidebarMenuButton size="lg" asChild tooltip={current.name}>
            <Link href={orgHref(current.slug, DEFAULT_SECTION)}>{label}</Link>
          </SidebarMenuButton>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" tooltip={current.name}>
                {label}
                <span className="sr-only">, switch organization</span>
                <ChevronsUpDown aria-hidden="true" className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Organizations</DropdownMenuLabel>
              {memberships.map((m) => (
                <DropdownMenuItem key={m.slug} asChild>
                  <Link href={orgHref(m.slug, DEFAULT_SECTION)} aria-current={m.slug === current.slug ? "page" : undefined}>
                    <OrgBadge name={m.name} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{m.name}</span>
                      <span className="text-xs text-muted-foreground">{ORG_ROLE_LABELS[m.role]}</span>
                    </span>
                    {m.slug === current.slug ? <Check aria-hidden="true" /> : null}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
