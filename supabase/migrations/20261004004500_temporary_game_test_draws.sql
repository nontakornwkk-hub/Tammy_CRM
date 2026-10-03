alter table public.game_plays add column test_batch_id uuid;
create index game_plays_test_batch_idx on public.game_plays(owner_id,member_id,test_batch_id) where test_batch_id is not null;
create function public.play_crm_game_test(p_owner uuid,p_member uuid,p_key text,p_request uuid,p_version integer,p_draw integer,p_batch uuid,p_limit integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.members;w public.game_wallets;g public.crm_games;played public.game_plays;p jsonb;selected jsonb;total numeric:=0;running numeric:=0;expiry timestamptz;grant_id uuid;slots jsonb;
begin
 if auth.role() is distinct from 'service_role' or p_request is null or p_draw not between 0 and 999999999 or p_batch is null or p_limit is null or p_limit not between 1 and 10000 then raise exception 'FORBIDDEN';end if;
 select * into m from public.members where id=p_member and owner_id=p_owner and status='active' for update;if not found then raise exception 'MEMBER_NOT_FOUND';end if;
 select * into played from public.game_plays where owner_id=p_owner and member_id=p_member and request_id=p_request;
 if found then
  if played.game_key<>p_key then raise exception 'REQUEST_CONFLICT';end if;
  select id into grant_id from public.game_grants where play_id=played.id;
  return to_jsonb(played)||jsonb_build_object('grant_id',grant_id);
 end if;
 select p_limit-count(*) into w.balance from public.game_plays where owner_id=p_owner and member_id=p_member and test_batch_id=p_batch;
 if w.balance<1 then raise exception 'NO_TICKETS';end if;
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

 insert into public.game_plays(owner_id,member_id,game_id,game_key,request_id,prize,slots,tickets_before,tickets_after,points_after,test_batch_id) values(p_owner,p_member,g.id,g.game_key,p_request,selected,slots,w.balance,w.balance-1,m.points,p_batch) returning * into played;
 if selected->>'kind'<>'points' then
  insert into public.game_grants(owner_id,member_id,play_id,title,kind,snapshot,expires_at) values(p_owner,p_member,played.id,selected->>'title',selected->>'kind',selected,expiry) returning id into grant_id;
 end if;
 insert into public.audit_logs(owner_id,action,entity_type,entity_id,details) values(p_owner,'game_play','game',played.id::text,jsonb_build_object('member_id',p_member,'game_key',p_key,'prize',selected->>'title'));
 return to_jsonb(played)||jsonb_build_object('grant_id',grant_id);
end $$;
revoke all on function public.play_crm_game_test(uuid,uuid,text,uuid,integer,integer,uuid,integer) from public,anon,authenticated;grant execute on function public.play_crm_game_test(uuid,uuid,text,uuid,integer,integer,uuid,integer) to service_role;
notify pgrst,'reload schema';
