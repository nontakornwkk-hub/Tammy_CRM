-- Keep the purchase threshold configurable per rank; each completed threshold earns one base point.
update public.store_settings
set points_earned = 1,
    extra = jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(extra, '{}'::jsonb), '{silver_points_earned}', '1'::jsonb, true),
        '{gold_points_earned}', '1'::jsonb, true),
      '{platinum_points_earned}', '1'::jsonb, true)
where points_earned <> 1
   or coalesce(extra->>'silver_points_earned', '1') <> '1'
   or coalesce(extra->>'gold_points_earned', '1') <> '1'
   or coalesce(extra->>'platinum_points_earned', '1') <> '1';

do $$
declare
  definition text;
  start_at integer;
  end_at integer;
begin
  definition := pg_get_functiondef('public.award_points(uuid,numeric,integer,text)'::regprocedure);
  start_at := strpos(definition, '  base_earned := case m.level');
  end_at := start_at + strpos(substr(definition, start_at), '  select exists (') - 1;
  if start_at = 0 or end_at <= start_at then
    raise exception 'Unexpected award_points implementation';
  end if;
  definition := left(definition, start_at - 1) || $rate$
  if rate < 1 then raise exception 'Invalid points settings'; end if;
  base_points := floor(sale / rate)::integer;
$rate$ || substr(definition, end_at);
  execute definition;
end $$;
