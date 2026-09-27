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

function getSessionId() {
  const key = "hepra_analytics_session";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

export default function AnalyticsTracker(props: Props) {
  useEffect(() => {
    void fetch("/api/v1/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        store_slug: props.storeSlug,
        session_id: getSessionId(),
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
