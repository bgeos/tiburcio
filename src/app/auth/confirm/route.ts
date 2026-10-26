import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/** Email links we accept: invitations (P2-08), password recovery, email change. */
const ACCEPTED_TYPES: EmailOtpType[] = ["invite", "recovery", "email_change", "email"];

/**
 * Landing point for links in auth emails:
 * /auth/confirm?token_hash=…&type=invite&next=/somewhere
 * Verifies the one-time token, which sets the session cookie, then redirects.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (tokenHash && type && ACCEPTED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(safeNextPath(params.get("next")));
  }

  redirect(`${LOGIN_PATH}?error=link`);
}
