-- Preserve earned rewards while removing play history.
alter table public.game_grants alter column play_id drop not null;
alter table public.game_grants drop constraint game_grants_play_id_fkey;
alter table public.game_grants add constraint game_grants_play_id_fkey foreign key(play_id) references public.game_plays(id) on delete set null;
create table private.game_history_receipts(
 owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
 member_id uuid not null references public.members(id) on delete cascade,
 request_id uuid not null, primary key(owner_id,member_id,request_id)
);
alter table private.game_history_receipts enable row level security;
revoke all on private.game_history_receipts from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert on private.game_history_receipts to service_role;
create function public.clear_game_history(p_owner uuid,p_actor uuid,p_year integer,p_cutoff timestamptz,p_count integer,p_fingerprint text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ids uuid[]; actual_count integer; fingerprint text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN';end if;
 if p_actor is distinct from p_owner or not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null) then raise exception 'FORBIDDEN';end if;
 if p_cutoff is null or p_cutoff>now() or p_count<1 or p_fingerprint is null or (p_year is not null and p_year not between 2020 and extract(year from now() at time zone 'Asia/Bangkok')::int) then raise exception 'INVALID_CONFIG';end if;
 -- Use the member lock order also used by game plays.
 perform id from public.members where owner_id=p_owner order by id for update;
 select array_agg(id order by id),count(*)::int,md5(string_agg(id::text,',' order by id)) into ids,actual_count,fingerprint
 from public.game_plays where owner_id=p_owner and created_at<p_cutoff
 and (p_year is null or (created_at>=make_timestamptz(p_year,1,1,0,0,0,'Asia/Bangkok') and created_at<make_timestamptz(p_year+1,1,1,0,0,0,'Asia/Bangkok')));
 if actual_count<>p_count or fingerprint is distinct from p_fingerprint then raise exception 'ARCHIVE_CHANGED';end if;
 insert into private.game_history_receipts(owner_id,member_id,request_id)
 select owner_id,member_id,request_id from public.game_plays where id=any(ids) on conflict do nothing;
 delete from public.game_plays where owner_id=p_owner and id=any(ids);
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,details) values(p_owner,p_actor,'clear_game_history','game_plays',jsonb_build_object('year',p_year,'cutoff',p_cutoff,'count',actual_count,'fingerprint',fingerprint));
 return jsonb_build_object('deleted',actual_count);
end $$;
revoke all on function public.clear_game_history(uuid,uuid,integer,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.clear_game_history(uuid,uuid,integer,timestamptz,integer,text) to service_role;

-- Preserve any newer game logic already installed; add the replay guard only.
do $migration$
declare definition text; needle text := 'select * into played from public.game_plays where owner_id=p_owner and member_id=p_member and request_id=p_request;';
begin
 definition:=pg_get_functiondef('public.play_crm_game(uuid,uuid,text,uuid,integer,integer)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'Unsupported play_crm_game definition';end if;
 definition:=replace(definition,needle,'if exists(select 1 from private.game_history_receipts where owner_id=p_owner and member_id=p_member and request_id=p_request) then raise exception ''HISTORY_CLEARED'';end if; '||needle);
 execute definition;
end $migration$;
