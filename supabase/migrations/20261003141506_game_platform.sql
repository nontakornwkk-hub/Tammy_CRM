-- Shared purchase wallet and history. Private probability configuration is service-only.
create table public.game_programs(owner_id uuid primary key references public.store_settings(owner_id) on delete cascade, purchase_threshold numeric(12,2) not null check(purchase_threshold between 1 and 1000000), earning_enabled boolean not null default false);
create table public.crm_games(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.store_settings(owner_id) on delete cascade,game_key text not null,engine text not null,name text not null,difficulty text not null default 'easy',enabled boolean not null default false,version integer not null default 1,prizes jsonb not null,unique(owner_id,game_key));
create table public.game_wallets(owner_id uuid not null references public.store_settings(owner_id) on delete cascade,member_id uuid primary key references public.members(id) on delete cascade,balance integer not null default 0,carry numeric(12,2) not null default 0 check(carry>=0),spent integer not null default 0 check(spent>=0),updated_at timestamptz not null default now());
create table public.game_purchase_credits(id bigint generated always as identity primary key,owner_id uuid not null,member_id uuid not null references public.members(id) on delete cascade,source_id uuid not null unique,amount numeric(12,2) not null check(amount>=0),threshold numeric(12,2) not null check(threshold>0),granted integer not null check(granted>=0),created_at timestamptz not null default now());
create index game_purchase_member_idx on public.game_purchase_credits(member_id,id);
create table public.game_manual_tickets(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.store_settings(owner_id) on delete cascade,member_id uuid not null references public.members(id) on delete cascade,request_id uuid not null,amount integer not null check(amount between 1 and 10000),actor_id uuid not null,note text not null default '',created_at timestamptz not null default now(),unique(owner_id,request_id));
create index game_manual_tickets_member_idx on public.game_manual_tickets(owner_id,member_id);
create table public.game_plays(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.store_settings(owner_id) on delete cascade,member_id uuid not null references public.members(id) on delete cascade,game_id uuid not null references public.crm_games(id),game_key text not null,request_id uuid not null,prize jsonb not null,slots jsonb not null,tickets_before integer not null,tickets_after integer not null,points_after integer not null,created_at timestamptz not null default now(),unique(owner_id,member_id,request_id));
create index game_plays_member_idx on public.game_plays(owner_id,member_id,created_at desc,id);
create table public.game_grants(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.store_settings(owner_id) on delete cascade,member_id uuid not null references public.members(id) on delete cascade,play_id uuid not null unique references public.game_plays(id) on delete cascade,title text not null,kind text not null check(kind in ('coupon','item')),snapshot jsonb not null,qr_token uuid not null unique default gen_random_uuid(),status text not null default 'available' check(status in ('available','used')),expires_at timestamptz not null,created_at timestamptz not null default now(),used_at timestamptz,used_by uuid);
create index game_grants_member_idx on public.game_grants(owner_id,member_id,created_at desc);
do $$ declare t text; begin foreach t in array array['game_programs','crm_games','game_wallets','game_purchase_credits','game_plays','game_grants','game_manual_tickets'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on public.%I to service_role',t);end loop;end $$;
grant usage,select on sequence public.game_purchase_credits_id_seq to service_role;

create function public.save_crm_game(p_owner uuid,p_actor uuid,p_setup jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.crm_games; v_prizes jsonb:=p_setup#>'{game,prizes}'; n integer; total integer; p jsonb;
begin
 if auth.role() is distinct from 'service_role' or p_actor is distinct from p_owner or not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null) then raise exception 'FORBIDDEN';end if;
 if p_setup#>>'{game,engine}'<>'wheel' or p_setup#>>'{game,key}' !~ '^[a-z][a-z0-9-]{2,49}$' or jsonb_typeof(v_prizes)<>'array' or jsonb_array_length(v_prizes) not between 2 and 16 or (p_setup#>>'{program,purchaseThreshold}')::numeric not between 1 and 1000000 then raise exception 'INVALID_CONFIG';end if;
 select sum(round((v->>'weight')::numeric*100)) into total from jsonb_array_elements(v_prizes) v where (v->>'active')::boolean;
 if total is null or total<=0 then raise exception 'INVALID_ODDS';end if;
 for p in select value from jsonb_array_elements(v_prizes) loop
  if p->>'kind' not in ('points','coupon','item') or length(coalesce(p->>'title','')) not between 1 and 100 or (p->>'weight')::numeric not between 0 and 100000 or (p->>'stock' is not null and (p->>'stock')::int<0) or (p->>'kind'='points' and (p->>'points')::int not between 1 and 100000) then raise exception 'INVALID_CONFIG';end if;
 end loop;
 select count(distinct v->>'id') into n from jsonb_array_elements(v_prizes) v;if n<>jsonb_array_length(v_prizes) then raise exception 'INVALID_CONFIG';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':game-config',0));
 select * into g from public.crm_games where owner_id=p_owner and game_key=p_setup#>>'{game,key}' for update;
 if coalesce(g.version,0)<>(p_setup#>>'{game,version}')::int then raise exception 'CONFIG_CHANGED';end if;
 insert into public.game_programs values(p_owner,(p_setup#>>'{program,purchaseThreshold}')::numeric,(p_setup#>>'{program,earningEnabled}')::boolean) on conflict(owner_id) do nothing;
 if g.id is null then
  insert into public.crm_games(owner_id,game_key,engine,name,difficulty,enabled,prizes) values(p_owner,p_setup#>>'{game,key}',p_setup#>>'{game,engine}',p_setup#>>'{game,name}',p_setup#>>'{game,difficulty}',(p_setup#>>'{game,enabled}')::boolean,v_prizes) returning * into g;
 else
  update public.crm_games set name=p_setup#>>'{game,name}',enabled=(p_setup#>>'{game,enabled}')::boolean,prizes=v_prizes,version=version+1 where id=g.id returning * into g;
 end if;
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,entity_id,details) values(p_owner,p_actor,'game_config_saved','game',g.id::text,jsonb_build_object('version',g.version));
 return jsonb_build_object('id',g.id,'version',g.version);
end $$;
revoke all on function public.save_crm_game(uuid,uuid,jsonb) from public,anon,authenticated;grant execute on function public.save_crm_game(uuid,uuid,jsonb) to service_role;

create schema if not exists private;
create function private.track_game_purchase() returns trigger language plpgsql security definer set search_path='' as $$
declare src public.points_transactions; program public.game_programs; w public.game_wallets; credit public.game_purchase_credits; v_amount numeric; carry_value numeric:=0; grants integer:=0; awarded integer;
begin
 if TG_OP='DELETE' then src:=old;else src:=new;end if;
 perform 1 from public.members where id=src.member_id and owner_id=src.owner_id for update;if not found then return null;end if;
 select * into credit from public.game_purchase_credits where source_id=src.id;
 v_amount:=case when TG_OP<>'DELETE' and src.transaction_type='earn' and src.rank_bonus_level is null then greatest(src.sale_amount,0) else 0 end;
 if exists(select 1 from public.transaction_reversals where source_kind='points' and source_id=src.id and cancelled) then v_amount:=0;end if;
 if credit.id is null then
  select * into program from public.game_programs where owner_id=src.owner_id;
  if v_amount<=0 or program.owner_id is null or not program.earning_enabled or TG_OP<>'INSERT' then return null;end if;
  insert into public.game_wallets(owner_id,member_id) values(src.owner_id,src.member_id) on conflict do nothing;
  select * into w from public.game_wallets where member_id=src.member_id for update;
  awarded:=floor((w.carry+v_amount)/program.purchase_threshold);
  insert into public.game_purchase_credits(owner_id,member_id,source_id,amount,threshold,granted) values(src.owner_id,src.member_id,src.id,v_amount,program.purchase_threshold,awarded);
  update public.game_wallets set balance=balance+awarded,carry=w.carry+v_amount-awarded*program.purchase_threshold,updated_at=now() where member_id=src.member_id;
 elsif credit.amount<>v_amount then
  select * into w from public.game_wallets where member_id=src.member_id for update;
  update public.game_purchase_credits set amount=v_amount where id=credit.id;
  -- Replay earning at each original threshold, including carry across purchases.
  -- Spent tickets remain spent; a reversed purchase may create debt until repaid.
  for credit in select * from public.game_purchase_credits where member_id=src.member_id order by id loop
   awarded:=floor((carry_value+credit.amount)/credit.threshold);carry_value:=carry_value+credit.amount-awarded*credit.threshold;grants:=grants+awarded;
   update public.game_purchase_credits set granted=awarded where id=credit.id;
  end loop;
  update public.game_wallets set balance=grants+coalesce((select sum(amount) from public.game_manual_tickets where owner_id=src.owner_id and member_id=src.member_id),0)-w.spent,carry=carry_value,updated_at=now() where member_id=src.member_id;
 end if;
 return null;
end $$;
revoke all on function private.track_game_purchase() from public,anon,authenticated;
create trigger game_purchase_credit after insert or update of sale_amount,transaction_type,rank_bonus_level or delete on public.points_transactions for each row execute function private.track_game_purchase();

-- Cancellation preserves the original bill. Replay earning when its journal flips.
create function private.reverse_game_purchase() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.source_kind='points' and new.cancelled then
  update public.points_transactions set sale_amount=sale_amount where id=new.source_id and owner_id=new.owner_id;
 end if;
 return null;
end $$;
revoke all on function private.reverse_game_purchase() from public,anon,authenticated;
create trigger game_purchase_reversal after insert or update of cancelled on public.transaction_reversals for each row execute function private.reverse_game_purchase();

create function public.play_crm_game(p_owner uuid,p_member uuid,p_key text,p_request uuid,p_version integer,p_draw integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.members;w public.game_wallets;g public.crm_games;played public.game_plays;p jsonb;selected jsonb;total numeric:=0;running numeric:=0;expiry timestamptz;grant_id uuid;slots jsonb;
begin
 if auth.role() is distinct from 'service_role' or p_request is null or p_draw not between 0 and 999999999 then raise exception 'FORBIDDEN';end if;
 select * into m from public.members where id=p_member and owner_id=p_owner and status='active' for update;if not found then raise exception 'MEMBER_NOT_FOUND';end if;
 select * into played from public.game_plays where owner_id=p_owner and member_id=p_member and request_id=p_request;
 if found then
  if played.game_key<>p_key then raise exception 'REQUEST_CONFLICT';end if;
  select id into grant_id from public.game_grants where play_id=played.id;
  return to_jsonb(played)||jsonb_build_object('grant_id',grant_id);
 end if;
 select * into w from public.game_wallets where member_id=p_member and owner_id=p_owner for update;
 if not found or w.balance<1 then raise exception 'NO_TICKETS';end if;
 select * into g from public.crm_games where owner_id=p_owner and game_key=p_key for update;
 if not found or not g.enabled or g.engine<>'wheel' then raise exception 'GAME_UNAVAILABLE';end if;
 if g.version<>p_version then raise exception 'CONFIG_CHANGED';end if;
 select jsonb_agg(v-'weight'-'stock'-'active' order by ord),sum((v->>'weight')::numeric) into slots,total from jsonb_array_elements(g.prizes) with ordinality a(v,ord) where (v->>'active')::boolean and (v->>'weight')::numeric>0 and (v->>'stock' is null or (v->>'stock')::integer>0) and (v->>'kind'='points' or v->>'expiryMode'='hours' or (v->>'expiresAt')::timestamptz>now());
 if total is null or total<=0 then raise exception 'PRIZES_EXHAUSTED';end if;
 for p in select value from jsonb_array_elements(g.prizes) loop
  if not (p->>'active')::boolean or (p->>'weight')::numeric<=0 or (p->>'stock' is not null and (p->>'stock')::integer<=0) or (p->>'kind'<>'points' and p->>'expiryMode'='fixed' and (p->>'expiresAt')::timestamptz<=now()) then continue;end if;
  running:=running+(p->>'weight')::numeric;
  if p_draw::numeric/1000000000*total<running then selected:=p;exit;end if;
 end loop;
 if selected is null then raise exception 'PRIZES_EXHAUSTED';end if;
 if selected->>'stock' is not null then
  update public.crm_games set version=version+1,prizes=(select jsonb_agg(case when v->>'id'=selected->>'id' then jsonb_set(v,'{stock}',to_jsonb((v->>'stock')::int-1)) else v end order by ord) from jsonb_array_elements(g.prizes) with ordinality a(v,ord)) where id=g.id;
 end if;
 selected:=selected-'weight'-'stock'-'active';
 if selected->>'kind'='points' then
  update public.members set points=points+(selected->>'points')::int,updated_at=now() where id=m.id returning * into m;
  insert into public.points_transactions(owner_id,member_id,sale_amount,points_delta,transaction_type,note) values(p_owner,p_member,0,(selected->>'points')::int,'adjustment','รางวัลเกม: '||g.name);
 else
  expiry:=case when selected->>'expiryMode'='hours' then now()+make_interval(hours=>(selected->>'expiryHours')::int) else (selected->>'expiresAt')::timestamptz end;
 end if;
 update public.game_wallets set balance=balance-1,spent=spent+1,updated_at=now() where member_id=m.id;
 insert into public.game_plays(owner_id,member_id,game_id,game_key,request_id,prize,slots,tickets_before,tickets_after,points_after) values(p_owner,p_member,g.id,g.game_key,p_request,selected,slots,w.balance,w.balance-1,m.points) returning * into played;
 if selected->>'kind'<>'points' then
  insert into public.game_grants(owner_id,member_id,play_id,title,kind,snapshot,expires_at) values(p_owner,p_member,played.id,selected->>'title',selected->>'kind',selected,expiry) returning id into grant_id;
 end if;
 insert into public.audit_logs(owner_id,action,entity_type,entity_id,details) values(p_owner,'game_play','game',played.id::text,jsonb_build_object('member_id',p_member,'game_key',p_key,'prize',selected->>'title'));
 return to_jsonb(played)||jsonb_build_object('grant_id',grant_id);
end $$;
revoke all on function public.play_crm_game(uuid,uuid,text,uuid,integer,integer) from public,anon,authenticated;grant execute on function public.play_crm_game(uuid,uuid,text,uuid,integer,integer) to service_role;

create function public.redeem_game_grant(p_owner uuid,p_actor uuid,p_token uuid,p_sale numeric default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.game_grants; discount numeric;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null) or not(p_actor=p_owner or exists(select 1 from public.team_accounts where user_id=p_actor and owner_id=p_owner and active and approved_at is not null)) then raise exception 'FORBIDDEN';end if;
 select * into g from public.game_grants where owner_id=p_owner and qr_token=p_token for update;
 if not found then raise exception 'GRANT_NOT_FOUND';end if;
 if g.status<>'available' then raise exception 'ALREADY_USED';end if;
 if g.expires_at<=now() then raise exception 'GRANT_EXPIRED';end if;
 if not exists(select 1 from public.members where id=g.member_id and owner_id=p_owner and status='active') then raise exception 'MEMBER_NOT_FOUND';end if;
 if g.kind='coupon' then
  if p_sale is null or p_sale<=0 or p_sale>10000000 or p_sale<(g.snapshot->>'minSpend')::numeric then raise exception 'MIN_SPEND';end if;
  discount:=least(p_sale,case when g.snapshot->>'discountType'='percent' then round(p_sale*(g.snapshot->>'discountValue')::numeric/100,2) else (g.snapshot->>'discountValue')::numeric end);
  if g.snapshot->>'maxDiscount' is not null then discount:=least(discount,(g.snapshot->>'maxDiscount')::numeric);end if;
 end if;
 update public.game_grants set status='used',used_at=now(),used_by=p_actor where id=g.id;
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,entity_id,details) values(p_owner,p_actor,'game_grant_redeemed','game',g.id::text,jsonb_build_object('member_id',g.member_id,'title',g.title,'sale_amount',p_sale,'discount',discount));
 return jsonb_build_object('id',g.id,'title',g.title,'member_id',g.member_id,'kind',g.kind,'discount',discount);
end $$;
revoke all on function public.redeem_game_grant(uuid,uuid,uuid,numeric) from public,anon,authenticated;grant execute on function public.redeem_game_grant(uuid,uuid,uuid,numeric) to service_role;



create function public.toggle_crm_game(p_owner uuid,p_actor uuid,p_key text,p_version integer,p_enabled boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.crm_games;
begin
 if auth.role() is distinct from 'service_role' or p_actor is distinct from p_owner or not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null) then raise exception 'FORBIDDEN';end if;
 select * into g from public.crm_games where owner_id=p_owner and game_key=p_key for update;
 if not found then raise exception 'GAME_UNAVAILABLE';end if;
 if g.version<>p_version then raise exception 'CONFIG_CHANGED';end if;
 if p_enabled is null then raise exception 'INVALID_CONFIG';end if;
 update public.crm_games set enabled=p_enabled,version=version+1 where id=g.id returning * into g;
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,entity_id,details) values(p_owner,p_actor,'game_status_changed','game',g.id::text,jsonb_build_object('enabled',g.enabled,'version',g.version));
 return jsonb_build_object('game_key',g.game_key,'enabled',g.enabled,'version',g.version);
end $$;
revoke all on function public.toggle_crm_game(uuid,uuid,text,integer,boolean) from public,anon,authenticated;grant execute on function public.toggle_crm_game(uuid,uuid,text,integer,boolean) to service_role;


create function public.save_game_program(p_owner uuid,p_actor uuid,p_threshold numeric,p_enabled boolean,p_expected_threshold numeric,p_expected_enabled boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_program public.game_programs;
begin
 if auth.role() is distinct from 'service_role' or p_actor is distinct from p_owner or not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null) then raise exception 'FORBIDDEN';end if;
 if p_threshold is null or p_threshold not between 1 and 1000000 or round(p_threshold,2)<>p_threshold or p_enabled is null then raise exception 'INVALID_CONFIG';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':game-config',0));
 select * into current_program from public.game_programs where owner_id=p_owner for update;
 if coalesce(current_program.purchase_threshold,500) is distinct from p_expected_threshold or coalesce(current_program.earning_enabled,false) is distinct from p_expected_enabled then raise exception 'CONFIG_CHANGED';end if;
 insert into public.game_programs values(p_owner,p_threshold,p_enabled) on conflict(owner_id) do update set purchase_threshold=excluded.purchase_threshold,earning_enabled=excluded.earning_enabled;
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,entity_id,details) values(p_owner,p_actor,'game_program_saved','game',p_owner::text,jsonb_build_object('purchase_threshold',p_threshold,'earning_enabled',p_enabled));
 return jsonb_build_object('purchaseThreshold',p_threshold,'earningEnabled',p_enabled);
end $$;
revoke all on function public.save_game_program(uuid,uuid,numeric,boolean,numeric,boolean) from public,anon,authenticated;grant execute on function public.save_game_program(uuid,uuid,numeric,boolean,numeric,boolean) to service_role;

create function public.give_game_tickets(p_owner uuid,p_actor uuid,p_member uuid,p_request uuid,p_amount integer,p_note text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.game_manual_tickets;w public.game_wallets;
begin
 if auth.role() is distinct from 'service_role' or p_actor is distinct from p_owner or not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null) then raise exception 'FORBIDDEN';end if;
 if p_request is null or p_amount is null or p_amount not between 1 and 10000 or length(coalesce(p_note,''))>200 then raise exception 'INVALID_CONFIG';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':game-ticket:'||p_request::text,0));
 perform 1 from public.members where id=p_member and owner_id=p_owner and status='active' for update;if not found then raise exception 'MEMBER_NOT_FOUND';end if;
 select * into existing from public.game_manual_tickets where owner_id=p_owner and request_id=p_request;
 if found then
  if existing.member_id<>p_member or existing.amount<>p_amount or existing.actor_id<>p_actor or existing.note<>coalesce(p_note,'') then raise exception 'REQUEST_CONFLICT';end if;
  select * into w from public.game_wallets where owner_id=p_owner and member_id=p_member;
  return jsonb_build_object('id',existing.id,'balance',w.balance,'amount',existing.amount);
 end if;
 insert into public.game_wallets(owner_id,member_id) values(p_owner,p_member) on conflict do nothing;
 select * into w from public.game_wallets where member_id=p_member and owner_id=p_owner for update;
 if not found then raise exception 'MEMBER_NOT_FOUND';end if;
 insert into public.game_manual_tickets(owner_id,member_id,request_id,amount,actor_id,note) values(p_owner,p_member,p_request,p_amount,p_actor,coalesce(p_note,'')) returning * into existing;
 update public.game_wallets set balance=balance+p_amount,updated_at=now() where member_id=p_member and owner_id=p_owner returning * into w;
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,entity_id,details) values(p_owner,p_actor,'game_tickets_given','game',existing.id::text,jsonb_build_object('member_id',p_member,'amount',p_amount,'note',p_note));
 return jsonb_build_object('id',existing.id,'balance',w.balance,'amount',p_amount);
end $$;
revoke all on function public.give_game_tickets(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated;grant execute on function public.give_game_tickets(uuid,uuid,uuid,uuid,integer,text) to service_role;
