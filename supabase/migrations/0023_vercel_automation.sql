create table if not exists public.vercel_projects (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 vercel_project_id text,
 project_name text,
 git_repo text,
 framework text default 'nextjs',
 status text not null default 'queued' check(status in ('queued','building','ready','failed')),
 production_url text,
 last_deployment_id text,
 last_deployment_url text,
 last_error text,
 last_verified_at timestamptz,
 attempt_count integer not null default 0,
 next_retry_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(store_id), unique(vercel_project_id)
);
create table if not exists public.deployments (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 vercel_project_id text,
 provider_deployment_id text,
 state text not null default 'queued' check(state in ('queued','building','ready','failed')),
 target text not null default 'production' check(target in ('production','preview')),
 url text,
 commit_sha text,
 branch text,
 error_code text,
 error_message text,
 started_at timestamptz,
 ready_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(provider_deployment_id)
);
create table if not exists public.deployment_logs (
 id uuid primary key default gen_random_uuid(),
 deployment_id uuid not null references public.deployments(id) on delete cascade,
 level text not null default 'info' check(level in ('info','warning','error')),
 message text not null,
 created_at timestamptz not null default now()
);
create index if not exists vercel_projects_store_status_idx on public.vercel_projects(store_id,status);
create index if not exists deployments_store_created_idx on public.deployments(store_id,created_at desc);
create index if not exists deployment_logs_deployment_idx on public.deployment_logs(deployment_id,created_at);
alter table public.vercel_projects enable row level security;
alter table public.deployments enable row level security;
alter table public.deployment_logs enable row level security;
create policy "vercel_projects_member_read" on public.vercel_projects for select using(public.is_store_member(store_id));
create policy "vercel_projects_admin_write" on public.vercel_projects for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy "deployments_member_read" on public.deployments for select using(public.is_store_member(store_id));
create policy "deployments_admin_write" on public.deployments for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy "deployment_logs_member_read" on public.deployment_logs for select using(exists(select 1 from public.deployments d where d.id=deployment_id and public.is_store_member(d.store_id)));
create policy "deployment_logs_admin_write" on public.deployment_logs for all using(exists(select 1 from public.deployments d where d.id=deployment_id and public.is_store_admin(d.store_id))) with check(exists(select 1 from public.deployments d where d.id=deployment_id and public.is_store_admin(d.store_id)));