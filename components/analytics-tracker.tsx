"use client";

import { useEffect } from "react";

type Props = {
  storeSlug: string;
  eventType: "page_view" | "product_view" | "search" | "add_to_cart" | "checkout";
  productId?: string;
  variantId?: string;
  query?: string;
  path?: string;
};

export default function AnalyticsTracker(props: Props) {
  useEffect(() => {
    void fetch("/api/v1/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        store_slug: props.storeSlug,
        event_type: props.eventType,
        product_id: props.productId,
        variant_id: props.variantId,
        search_query: props.query,
        path: props.path ?? window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [props.storeSlug, props.eventType, props.productId, props.variantId, props.query, props.path]);

  return null;
}
