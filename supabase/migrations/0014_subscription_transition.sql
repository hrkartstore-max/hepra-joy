-- Phase 11 follow-up: server-side subscription lifecycle transition and entitlement checks.
create or replace function public.subscription_transition(p_subscription_id uuid,p_to_status text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s record;
begin
 if p_to_status not in ('TRIAL','ACTIVE','PAST_DUE','PAUSED','CANCELLED','EXPIRED') then raise exception 'INVALID_STATUS'; end if;
 select * into s from subscriptions where id=p_subscription_id for update;
 if s.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
 if not public.is_org_admin(s.organization_id) then raise exception 'FORBIDDEN'; end if;
 update subscriptions set status=p_to_status,updated_at=now(),cancelled_at=case when p_to_status='CANCELLED' then coalesce(cancelled_at,now()) else cancelled_at end where id=p_subscription_id;
 insert into subscription_events(subscription_id,event_type,from_status,to_status,payload) values(p_subscription_id,'STATUS_CHANGED',s.status,p_to_status,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('id',p_subscription_id,'from_status',s.status,'status',p_to_status);
end;$$;
revoke all on function public.subscription_transition(uuid,text,text) from public;
grant execute on function public.subscription_transition(uuid,text,text) to authenticated;
