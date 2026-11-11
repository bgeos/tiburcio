"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getMyMemberships } from "@/lib/dal/organizations";
import { CAN_CREATE_ORGANIZATION } from "@/lib/domain/organizations";
import { DEFAULT_SECTION, orgHref } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { organizationSchema } from "@/lib/validation/organizations";

export type OrganizationFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> };

const NOT_ALLOWED = "Only admins and production managers can create organizations.";

/**
 * Start a new organization (e.g. a second festival) and open it (D-033). The creator
 * becomes its admin and its only member; others join by invitation. The database
 * function checks the role again, so this check only gives a clearer message.
 */
export async function createOrganization(_previous: OrganizationFormState, formData: FormData): Promise<OrganizationFormState> {
  const parsed = parseForm(organizationSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  const memberships = await getMyMemberships();
  if (!memberships.some((m) => (CAN_CREATE_ORGANIZATION as readonly string[]).includes(m.role))) {
    return { status: "error", message: NOT_ALLOWED, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_my_organization", { org_name: parsed.data.name, org_slug: parsed.data.slug });
  if (error?.code === "23505") {
    return { status: "invalid", fieldErrors: { slug: ["This address is taken. Choose another."] }, values };
  }
  if (error?.code === "42501") return { status: "error", message: NOT_ALLOWED, values };
  if (error) return { status: "error", message: "Couldn't create the organization. Try again.", values };

  // The sidebar sits in a shared layout that a redirect alone keeps: refresh it too.
  refresh();
  redirect(orgHref(parsed.data.slug, DEFAULT_SECTION));
}
