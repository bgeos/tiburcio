"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { TextField } from "@/components/form/text-field";
import { applyAccent } from "@/components/shell/preferences-sync";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  ACCENT_COLORS,
  ACCENT_LABELS,
  THEME_MODES,
  THEME_MODE_LABELS,
  type AccentColor,
  type ThemeMode,
} from "@/lib/domain/appearance";
import { updateProfile, type ProfileFormState } from "@/lib/profile/actions";
import { cn } from "@/lib/utils";

const MODE_ICONS: Record<ThemeMode, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

const OPTION =
  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

/** Choices preview immediately; leaving without saving puts the saved look back. */
export function ProfileForm({
  email,
  fullName,
  accentColor,
  themeMode,
}: {
  email: string;
  fullName: string;
  accentColor: AccentColor;
  themeMode: ThemeMode;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, { status: "idle" } as ProfileFormState);
  const [accent, setAccent] = useState(accentColor);
  const [mode, setMode] = useState(themeMode);
  const { setTheme } = useTheme();

  // What to restore if the person leaves without saving.
  const saved = useRef({ accent: accentColor, mode: themeMode });
  const lastSaved = useRef(0);
  useEffect(() => {
    if (state.status === "saved" && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      saved.current = { accent, mode };
      toast.success("Profile saved");
    }
  }, [state, accent, mode]);
  // next-themes gives a new setTheme whenever the theme changes: keep the latest in a ref
  // so the restore below runs only when the page is left, not on every preview.
  const setThemeRef = useRef(setTheme);
  useEffect(() => {
    setThemeRef.current = setTheme;
  }, [setTheme]);
  useEffect(
    () => () => {
      applyAccent(saved.current.accent);
      setThemeRef.current(saved.current.mode);
    },
    [],
  );

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : {};

  return (
    <form action={formAction} noValidate className="max-w-xl space-y-6 rounded-xl border bg-card p-4 sm:p-6">
      <FieldGroup>
        <TextField
          name="fullName"
          label="Name"
          required
          maxLength={120}
          autoComplete="name"
          defaultValue={values.fullName ?? fullName}
          errors={fieldErrors.fullName}
          description={`Signed in as ${email}.`}
        />
      </FieldGroup>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Theme colour</legend>
        <p className="text-sm text-muted-foreground">Buttons, links and highlights. Red is kept for overlap warnings.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACCENT_COLORS.map((color) => (
            <label key={color} className={cn(OPTION, accent === color && "border-primary bg-accent font-medium")}>
              <input
                type="radio"
                name="accentColor"
                value={color}
                checked={accent === color}
                onChange={() => {
                  setAccent(color);
                  applyAccent(color);
                }}
                className="sr-only"
              />
              <span data-accent={color} aria-hidden="true" className="accent-swatch grid size-6 shrink-0 place-items-center rounded-full">
                {accent === color ? <Check className="size-4 text-primary-foreground" /> : null}
              </span>
              {ACCENT_LABELS[color]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Light or dark</legend>
        <p className="text-sm text-muted-foreground">“Device” follows your phone or computer setting.</p>
        <div className="grid grid-cols-3 gap-2">
          {THEME_MODES.map((m) => {
            const Icon = MODE_ICONS[m];
            return (
              <label key={m} className={cn(OPTION, "justify-center gap-2", mode === m && "border-primary bg-accent font-medium")}>
                <input
                  type="radio"
                  name="themeMode"
                  value={m}
                  checked={mode === m}
                  onChange={() => {
                    setMode(m);
                    setTheme(m);
                  }}
                  className="sr-only"
                />
                <Icon aria-hidden="true" className="size-4" />
                {THEME_MODE_LABELS[m]}
              </label>
            );
          })}
        </div>
      </fieldset>

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
