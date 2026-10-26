import { forbidden } from "next/navigation";

/** Phase 2+ calls forbidden() when a signed-in user lacks the required role. */
export default function ForbiddenDemoPage() {
  forbidden();
}
