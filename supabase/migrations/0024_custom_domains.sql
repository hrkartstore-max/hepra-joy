alter table public.domains
  add column if not exists vercel_project_id text,
  add column if not exists provider_verified boolean not null default false,
  add column if not exists dns_status text not null default 'unknown' check(dns_status in ('unknown','configured','misconfigured','pending')),
  add column if not exists ssl_status text not null default 'unknown' check(ssl_status in ('unknown','pending','issued','error')),
  add column if not exists redirect_target text,
  add column if not exists redirect_status_code integer,
  add column if not exists last_provider_response jsonb not null default '{}'::jsonb;
create index if not exists domains_vercel_project_idx on public.domains(vercel_project_id);
create index if not exists domains_provider_status_idx on public.domains(provider_verified,status);

create table if not exists public.domain_sync_jobs (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 domain_id uuid not null references public.domains(id) on delete cascade,
 state text not null default 'queued' check(state in ('queued','processing','completed','failed','retrying')),
 idempotency_key text not null,
 attempt_count integer not null default 0,
 next_retry_at timestamptz,
 lock_token text,
 locked_at timestamptz,
 error_code text,
 result jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(store_id,idempotency_key)
);
create index if not exists domain_sync_jobs_state_retry_idx on public.domain_sync_jobs(state,next_retry_at);
alter table public.domain_sync_jobs enable row level security;
create policy "domain_sync_jobs_member_read" on public.domain_sync_jobs for select using(public.is_store_member(store_id));
create policy "domain_sync_jobs_admin_write" on public.domain_sync_jobs for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));