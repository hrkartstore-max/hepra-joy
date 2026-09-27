create or replace function public.create_organization_with_store(
  p_organization_name text,
  p_organization_slug text,
  p_store_name text,
  p_store_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_store uuid;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if length(trim(p_organization_name)) < 2 or length(trim(p_store_name)) < 2 then
    raise exception 'INVALID_NAME';
  end if;

  insert into public.organizations(name, slug, created_by)
  values (trim(p_organization_name), lower(trim(p_organization_slug)), v_user)
  returning id into v_org;

  insert into public.organization_members(organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  insert into public.stores(organization_id, name, slug)
  values (v_org, trim(p_store_name), lower(trim(p_store_slug)))
  returning id into v_store;

  return jsonb_build_object('organization_id', v_org, 'store_id', v_store);
exception
  when unique_violation then
    raise exception 'SLUG_ALREADY_EXISTS';
end;
$$;

revoke all on function public.create_organization_with_store(text,text,text,text) from public;
grant execute on function public.create_organization_with_store(text,text,text,text) to authenticated;
