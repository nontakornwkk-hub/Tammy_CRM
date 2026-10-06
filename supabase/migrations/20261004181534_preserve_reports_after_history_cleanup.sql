-- Keep compact report totals, never a second copy of transaction details.
create table private.report_history_daily (
 owner_id uuid not null references auth.users(id) on delete cascade,
 member_id uuid not null references public.members(id) on delete cascade,
 report_day date not null,
 sale_amount numeric not null default 0,
 points_given bigint not null default 0,
 last_earned_at timestamptz not null,
 primary key(owner_id,member_id,report_day)
);
alter table private.report_history_daily enable row level security;
revoke all on private.report_history_daily from public,anon,authenticated;

create function private.preserve_cleanup_report() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.transaction_type='earn' and current_setting('tammy.history_cleanup',true)=old.owner_id::text then
  insert into private.report_history_daily(owner_id,member_id,report_day,sale_amount,points_given,last_earned_at)
  values(old.owner_id,old.member_id,(old.created_at at time zone 'Asia/Bangkok')::date,coalesce(old.sale_amount,0),greatest(old.points_delta,0),old.created_at)
  on conflict(owner_id,member_id,report_day) do update set
   sale_amount=report_history_daily.sale_amount+excluded.sale_amount,
   points_given=report_history_daily.points_given+excluded.points_given,
   last_earned_at=greatest(report_history_daily.last_earned_at,excluded.last_earned_at);
 end if;
 return old;
end $$;
revoke all on function private.preserve_cleanup_report() from public,anon,authenticated;
create trigger preserve_cleanup_report before delete on public.points_transactions
 for each row execute function private.preserve_cleanup_report();

create function public.crm_report_summary_rows(p_owner_id uuid,p_offset integer default 0,p_limit integer default 1000)
returns table(id text,member_id uuid,sale_amount numeric,points_delta numeric,created_at timestamptz,transaction_type text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.crm_team_can(p_owner_id,'reports') then raise exception 'FORBIDDEN';end if;
 return query
 with daily as (
  select t.member_id,(t.created_at at time zone 'Asia/Bangkok')::date as report_day,
   sum(t.sale_amount) as sales,sum(greatest(t.points_delta,0))::numeric as points,max(t.created_at) as last_at
  from public.points_transactions t where t.owner_id=p_owner_id and t.transaction_type='earn'
  group by t.member_id,(t.created_at at time zone 'Asia/Bangkok')::date
  union all
  select a.member_id,a.report_day,a.sale_amount,a.points_given::numeric,a.last_earned_at
  from private.report_history_daily a where a.owner_id=p_owner_id
 ), totals as (
  select d.member_id,d.report_day,sum(d.sales) as sales,sum(d.points) as points,max(d.last_at) as last_at
  from daily d group by d.member_id,d.report_day
 )
 select t.member_id::text||':'||t.report_day::text,t.member_id,t.sales,t.points,t.last_at,'earn'::text
 from totals t order by t.member_id,t.report_day
 offset greatest(p_offset,0) limit greatest(1,least(p_limit,1000));
end $$;
revoke all on function public.crm_report_summary_rows(uuid,integer,integer) from public,anon;
grant execute on function public.crm_report_summary_rows(uuid,integer,integer) to authenticated,service_role;
