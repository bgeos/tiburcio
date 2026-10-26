import type { Metadata } from "next";
import { AllMaterials } from "./all-materials";

export const metadata: Metadata = { title: "All materials prototype" };

/** Prototype: materials from every subproject in one filterable table (D-019). */
export default function PrototypeMaterialsPage() {
  return <AllMaterials />;
}
