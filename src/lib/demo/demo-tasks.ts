import type { Priority, StatusCategory } from "@/lib/domain/status";

/**
 * DEMO DATA — fictional, for the design-system page only.
 * Never import this into real pages, metrics or reports.
 */
export type DemoTask = {
  id: string;
  title: string;
  project: string;
  owner: string;
  status: StatusCategory;
  priority: Priority;
  due: string | null; // ISO date
  progress: number | null;
};

export const DEMO_TASKS: DemoTask[] = [
  {
    id: "demo-1",
    title: "Cut plywood for DJ booth front",
    project: "Demo Festival › DJ Area",
    owner: "Ana Ribeiro",
    status: "in_progress",
    priority: "high",
    due: "2027-01-12",
    progress: 40,
  },
  {
    id: "demo-2",
    title: "Bamboo arch templates",
    project: "Demo Festival › Bamboo Structure",
    owner: "Caio Mendes",
    status: "done",
    priority: "medium",
    due: "2027-01-05",
    progress: 100,
  },
  {
    id: "demo-3",
    title: "Install shade sail anchors",
    project: "Demo Festival › Shade Sail",
    owner: "Lia Prado",
    status: "blocked",
    priority: "urgent",
    due: "2027-01-15",
    progress: 10,
  },
  {
    id: "demo-4",
    title: "Sew stage curtain panels",
    project: "Demo Festival › Sewing",
    owner: "Rita Souza",
    status: "todo",
    priority: "low",
    due: null,
    progress: null,
  },
  {
    id: "demo-5",
    title: "Order stage scaffolding",
    project: "Demo Festival › Stage Structure",
    owner: "Otávio Lima",
    status: "cancelled",
    priority: "medium",
    due: "2026-12-20",
    progress: null,
  },
];
