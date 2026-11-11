"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Show every project, or one. Each choice is a calendar address, so the filter survives a reload. */
export function ProjectFilter({ value, options }: { value: string; options: { value: string; label: string; href: string }[] }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="calendar-project" className="shrink-0">
        Project
      </Label>
      <Select value={value} onValueChange={(next) => router.push(options.find((o) => o.value === next)?.href ?? options[0].href)}>
        <SelectTrigger id="calendar-project" size="sm" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
