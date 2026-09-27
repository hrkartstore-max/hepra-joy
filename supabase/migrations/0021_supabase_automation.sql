create table if not exists public.supabase_projects (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 project_id text, project_ref text, organization_id text, project_name text, region text,
 status text not null default 'queued' check(status in ('queued','provisioning','ready','retrying','failed')),
 project_url text, publishable_key text, last_verified_at timestamptz, last_error text,
 attempt_count integer not null default 0, next_retry_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(store_id), unique(project_ref)
);
create table if not exists public.supabase_provisioning_jobs (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 project_id uuid references public.supabase_projects(id) on delete cascade,
 idempotency_key text not null,
 state text not null default 'queued' check(state in ('queued','processing','completed','failed','retrying')),
 step text not null default 'create_project' check(step in ('create_project','wait_ready','migrations','configure_auth','configure_storage','verify')),
 attempt_count integer not null default 0, next_retry_at timestamptz, lock_token text, locked_at timestamptz,
 external_id text, request jsonb not null default '{}'::jsonb, result jsonb not null default '{}'::jsonb, error_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(store_id,idempotency_key)
);
create index if not exists supabase_projects_store_status_idx on public.supabase_projects(store_id,status);
create index if not exists supabase_jobs_state_retry_idx on public.supabase_provisioning_jobs(state,next_retry_at);
alter table public.supabase_projects enable row level security;
alter table public.supabase_provisioning_jobs enable row level security;
create policy "supabase_projects_member_read" on public.supabase_projects for select using(public.is_store_member(store_id));
create policy "supabase_projects_admin_write" on public.supabase_projects for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy "supabase_jobs_member_read" on public.supabase_provisioning_jobs for select using(public.is_store_member(store_id));
create policy "supabase_jobs_admin_write" on public.supabase_provisioning_jobs for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));