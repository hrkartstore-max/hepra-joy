-- Phase 11: subscriptions and billing lifecycle.
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  event_id text,
  event_type text not null,
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(subscription_id,event_id)
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft' check(status in ('draft','open','paid','void','uncollectible')),
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'INR',
  period_start timestamptz,
  period_end timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,invoice_number)
);
create index if not exists subscriptions_org_status_idx on public.subscriptions(organization_id,status);
create index if not exists subscription_events_subscription_date_idx on public.subscription_events(subscription_id,created_at desc);
create index if not exists invoices_org_date_idx on public.invoices(organization_id,created_at desc);
alter table public.subscription_events enable row level security;
alter table public.invoices enable row level security;
create policy "subscription_events_org_member" on public.subscription_events for select using (exists(select 1 from public.subscriptions s where s.id=subscription_id and public.is_org_member(s.organization_id)));
create policy "subscription_events_org_admin" on public.subscription_events for all using (exists(select 1 from public.subscriptions s where s.id=subscription_id and public.is_org_admin(s.organization_id))) with check (exists(select 1 from public.subscriptions s where s.id=subscription_id and public.is_org_admin(s.organization_id)));
create policy "invoices_org_member" on public.invoices for select using (public.is_org_member(organization_id));
create policy "invoices_org_admin" on public.invoices for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
alter table public.subscriptions add column if not exists grace_period_ends_at timestamptz;
alter table public.subscriptions add column if not exists cancelled_at timestamptz;
alter table public.subscriptions add column if not exists plan_price numeric(14,2) not null default 0;
alter table public.subscriptions add column if not exists currency text not null default 'INR';
alter table public.subscriptions add column if not exists entitlements jsonb not null default '{}'::jsonb;
