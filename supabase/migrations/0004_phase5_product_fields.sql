-- Phase 5: product fields required by the master specification.
alter table public.products add column if not exists weight numeric(12,3);
alter table public.products add column if not exists length numeric(12,3);
alter table public.products add column if not exists width numeric(12,3);
alter table public.products add column if not exists height numeric(12,3);
alter table public.products add column if not exists hsn_code text;
alter table public.products add column if not exists gst_rate numeric(5,2);
alter table public.products add column if not exists video_url text;
alter table public.products add column if not exists published_at timestamptz;
create index if not exists products_store_updated_idx on public.products(store_id,updated_at desc);
