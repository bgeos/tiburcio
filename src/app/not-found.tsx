import type { Metadata } from "next";
import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusScreen
      icon={MapPinOff}
      code="404"
      title="Page not found"
      description="This page doesn't exist, or it was moved or archived."
      actions={
        <Button asChild>
          <Link href="/">Go to overview</Link>
        </Button>
      }
    />
  );
}
