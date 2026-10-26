import type { Metadata } from "next";
import { PrototypeApp } from "./prototype-app";

export const metadata: Metadata = { title: "Main Stage prototype" };

/**
 * Clickable mock-up of the subproject workspace (D-019): cronograma,
 * materials, people, history and the daily check-in. Fictional demo data,
 * client-side only, nothing is stored. Replaced by the real screens in Phase 3.
 */
export default function PrototypePage() {
  return <PrototypeApp />;
}
