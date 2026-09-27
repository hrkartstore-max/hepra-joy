import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getStoreBaseUrl(storeId: string, slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: primary } = await supabase
    .from("domains")
    .select("domain")
    .eq("store_id", storeId)
    .eq("is_primary", true)
    .in("status", ["verified", "active"])
    .maybeSingle();

  if (primary?.domain) return "https://" + primary.domain;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) return site.replace(/\/$/, "") + "/store/" + slug;
  return "/store/" + slug;
}

export function buildStoreMetadata(input: {
  baseUrl: string;
  name: string;
  description?: string | null;
  image?: string | null;
  path?: string;
}): Metadata {
  const url = input.baseUrl + (input.path || "");
  return {
    title: input.name,
    description: input.description || undefined,
    alternates: { canonical: url },
    openGraph: {
      title: input.name,
      description: input.description || undefined,
      url,
      type: "website",
      images: input.image ? [{ url: input.image, alt: input.name }] : undefined,
    },
    twitter: {
      card: input.image ? "summary_large_image" : "summary",
      title: input.name,
      description: input.description || undefined,
      images: input.image ? [input.image] : undefined,
    },
  };
}
