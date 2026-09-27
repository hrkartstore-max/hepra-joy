import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AnalyticsSummary = {
  revenue: number;
  orders: number;
  aov: number;
  conversion_rate: number;
  funnel: {
    page_views: number;
    product_views: number;
    searches: number;
    add_to_cart: number;
    checkouts: number;
    purchases: number;
  };
  top_products: Array<{ name: string; units: number; revenue: number }>;
  top_categories: Array<{ name: string; units: number; revenue: number }>;
};

const emptySummary: AnalyticsSummary = {
  revenue: 0,
  orders: 0,
  aov: 0,
  conversion_rate: 0,
  funnel: {
    page_views: 0,
    product_views: 0,
    searches: 0,
    add_to_cart: 0,
    checkouts: 0,
    purchases: 0,
  },
  top_products: [],
  top_categories: [],
};

export async function getAnalyticsSummary(storeId: string, days = 30): Promise<AnalyticsSummary> {
  const supabase = await createSupabaseServerClient();
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase.rpc("get_analytics_summary", {
    p_store_id: storeId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? emptySummary) as AnalyticsSummary;
}
