"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, type AccentColor, type ThemeMode } from "@/lib/domain/appearance";

/** Show the app in this theme colour now, and remember it for the next first paint (see app/layout.tsx). */
export function applyAccent(accent: AccentColor) {
  const root = document.documentElement;
  if (accent === DEFAULT_ACCENT) delete root.dataset.accent;
  else root.dataset.accent = accent;
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Storage blocked (private window): the colour still applies on this page.
  }
}

/**
 * True while the profile form is open: it previews choices and restores the saved look
 * itself. The shell may finish loading after a choice was made; it must not undo it.
 */
let previewing = false;

export function setPreviewing(on: boolean) {
  previewing = on;
}

/**
 * The profile is the source of truth for appearance (D-027). When this device's copy
 * differs (first visit, or changed on another device), bring it in line.
 */
export function PreferencesSync({ accentColor, themeMode }: { accentColor: AccentColor; themeMode: ThemeMode }) {
  const { theme, setTheme } = useTheme();
  // Apply each saved mode once: after that the top bar switch changes both itself.
  const appliedMode = useRef<ThemeMode | null>(null);
  useEffect(() => {
    if (!previewing) applyAccent(accentColor);
  }, [accentColor]);
  useEffect(() => {
    if (previewing || appliedMode.current === themeMode) return;
    appliedMode.current = themeMode;
    if (theme !== themeMode) setTheme(themeMode);
  }, [theme, themeMode, setTheme]);
  return null;
}
