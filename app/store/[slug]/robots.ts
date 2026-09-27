import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreBaseUrl } from "@/lib/seo";

export default async function robots({ params }: { params: Promise<{ slug: string }> }): Promise<MetadataRoute.Robots> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: store } = await supabase.from("stores").select("id").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!store) return { rules: { userAgent: "*", disallow: "/" } };

  const baseUrl = await getStoreBaseUrl(store.id, slug);
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: baseUrl + "/sitemap.xml",
  };
}
