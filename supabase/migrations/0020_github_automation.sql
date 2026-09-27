create table if not exists public.github_connections (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 installation_id bigint not null,
 account_login text not null,
 account_type text not null default 'Organization' check(account_type in ('Organization','User')),
 status text not null default 'pending' check(status in ('pending','connected','error','revoked')),
 permissions jsonb not null default '{}'::jsonb,
 external_account_id bigint,
 verified_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(store_id),
 unique(installation_id)
);
create table if not exists public.github_repositories (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 connection_id uuid not null references public.github_connections(id) on delete cascade,
 repository_id bigint not null,
 full_name text not null,
 default_branch text not null default 'main',
 private boolean not null default true,
 html_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(store_id),
 unique(repository_id)
);
create table if not exists public.github_operations (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 operation_type text not null check(operation_type in ('connect','verify','create_repository','generate_project','commit')),
 idempotency_key text not null,
 status text not null default 'queued' check(status in ('queued','processing','completed','failed')),
 external_id text,
 request jsonb not null default '{}'::jsonb,
 response jsonb not null default '{}'::jsonb,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(store_id,idempotency_key)
);
create index if not exists github_connections_store_status_idx on public.github_connections(store_id,status);
create index if not exists github_operations_store_status_idx on public.github_operations(store_id,status);
alter table public.github_connections enable row level security;
alter table public.github_repositories enable row level security;
alter table public.github_operations enable row level security;
create policy "github_connections_member_read" on public.github_connections for select using(public.is_store_member(store_id));
create policy "github_connections_admin_write" on public.github_connections for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy "github_repositories_member_read" on public.github_repositories for select using(public.is_store_member(store_id));
create policy "github_repositories_admin_write" on public.github_repositories for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy "github_operations_member_read" on public.github_operations for select using(public.is_store_member(store_id));
create policy "github_operations_admin_write" on public.github_operations for all using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
