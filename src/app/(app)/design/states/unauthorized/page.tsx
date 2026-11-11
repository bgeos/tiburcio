import { unauthorized } from "next/navigation";

/** Phase 2 calls unauthorized() from the Data Access Layer when there is no session. */
export default function UnauthorizedDemoPage() {
  unauthorized();
}
