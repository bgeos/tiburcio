"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function AccountMenuButton({ name, email }: { name: string; email: string }) {
  // The profile page lives inside an organization (it uses the app shell); outside one there's no link.
  const { org } = useParams<{ org?: string }>();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          {/* Initials are decoration; the name comes from the sr-only text. */}
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initials(name, email)}
          </span>
          <span className="sr-only">Account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          {name ? <p className="truncate text-sm font-medium">{name}</p> : null}
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {org ? (
          <DropdownMenuItem asChild>
            <Link href={`/${org}/profile`}>
              <UserRound aria-hidden="true" />
              Your profile
            </Link>
          </DropdownMenuItem>
        ) : null}
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
