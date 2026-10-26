import type { Metadata } from "next";
import { Building2, ListTodo, SlidersHorizontal, UserCog } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  {
    icon: Building2,
    title: "Organization",
    description: "Name, default currency and timezone.",
    phase: "Phase 2",
  },
  {
    icon: UserCog,
    title: "Your profile",
    description: "Name, timezone and language. Theme is available now in the top bar.",
    phase: "Phase 2",
  },
  {
    icon: ListTodo,
    title: "Statuses and priorities",
    description: "Rename and recolour statuses for projects and tasks.",
    phase: "Phase 7",
  },
  {
    icon: SlidersHorizontal,
    title: "Custom fields and templates",
    description: "Add your own fields and reusable project structures.",
    phase: "Phase 7",
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure your organization without touching code or the database."
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.title}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <section.icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="space-y-1">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                    <p className="text-xs text-muted-foreground">
                      Available in {section.phase}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
