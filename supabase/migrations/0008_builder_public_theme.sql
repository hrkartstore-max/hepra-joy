-- Phase 8 follow-up: allow anonymous storefronts to read the published store theme.
drop policy if exists "store_themes_public_published" on public.store_themes;
create policy "store_themes_public_published" on public.store_themes for select using (
  status='published' and exists(select 1 from public.stores s where s.id=store_themes.store_id and s.status='active')
);