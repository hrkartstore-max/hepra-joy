"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export async function createOrganization(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const organizationName = String(formData.get("organizationName") || "").trim();
  const storeName = String(formData.get("storeName") || "").trim();
  if (!organizationName || !storeName) redirect("/onboarding?error=missing");

  const orgSlug = slugify(organizationName) || `org-${user.id.slice(0, 8)}`;
  const storeSlug = slugify(storeName) || `store-${user.id.slice(0, 8)}`;

  const { data, error } = await supabase.rpc("create_organization_with_store", {
    p_organization_name: organizationName,
    p_organization_slug: orgSlug,
    p_store_name: storeName,
    p_store_slug: storeSlug,
  });

  if (error || !data?.store_id) {
    redirect("/onboarding?error=creation_failed");
  }

  redirect("/dashboard");
}
