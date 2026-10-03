create function private.crm_verified_actor(p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $function$
 select exists(select 1 from auth.users u where u.id=p_actor and u.email_confirmed_at is not null)
$function$;
revoke all on function private.crm_verified_actor(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.crm_verified_actor(uuid) to service_role;
do $migration$
declare f record;definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('reverse_crm_transaction','save_crm_game','redeem_game_grant','toggle_crm_game','save_game_program','give_game_tickets') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null)','private.crm_verified_actor(p_actor)');
  definition:=replace(definition,'exists(select 1 from auth.users where id=p_actor_id and email_confirmed_at is not null)','private.crm_verified_actor(p_actor_id)');
  execute definition;
 end loop;
end $migration$;
notify pgrst,'reload schema';
