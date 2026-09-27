import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreBaseUrl } from "@/lib/seo";

export default async function sitemap({ params }: { params: Promise<{ slug: string }> }): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: store } = await supabase.from("stores").select("id").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!store) return [];

  const baseUrl = await getStoreBaseUrl(store.id, slug);
  const [{ data: products }, { data: categories }, { data: pages }] = await Promise.all([
    supabase.from("products").select("slug,updated_at").eq("store_id", store.id).eq("status", "active"),
    supabase.from("categories").select("slug,updated_at").eq("store_id", store.id).eq("visible", true),
    supabase.from("pages").select("slug,updated_at").eq("store_id", store.id).eq("status", "published"),
  ]);

  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: baseUrl + "/products", changeFrequency: "daily", priority: 0.9 },
    ...(categories ?? []).map(category => ({ url: baseUrl + "/categories/" + category.slug, lastModified: category.updated_at, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...(products ?? []).map(product => ({ url: baseUrl + "/products/" + product.slug, lastModified: product.updated_at, changeFrequency: "daily" as const, priority: 0.8 })),
    ...(pages ?? []).filter(page => page.slug !== "home").map(page => ({ url: baseUrl + "/pages/" + page.slug, lastModified: page.updated_at, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
