-- Keep the established award flow and make only the rank-rate calculation independent.
do $$
declare
  definition text;
  start_at integer;
  end_at integer;
begin
  definition := pg_get_functiondef('public.award_points(uuid,numeric,integer,text)'::regprocedure);
  start_at := strpos(definition, '  rate := case m.level');
  end_at := strpos(definition, '  select exists (');
  if start_at = 0 or end_at <= start_at then
    raise exception 'Unexpected award_points implementation';
  end if;
  definition := left(definition, start_at - 1) || $rate$
  rate := case m.level
    when 'Silver' then coalesce((policy->>'silver_baht_per_point')::integer, base_rate)
    when 'Gold' then coalesce((policy->>'gold_baht_per_point')::integer, 45)
    when 'Platinum' then coalesce((policy->>'platinum_baht_per_point')::integer, 40)
    else base_rate end;
  base_earned := case m.level
    when 'Silver' then coalesce((policy->>'silver_points_earned')::integer, base_earned)
    when 'Gold' then coalesce((policy->>'gold_points_earned')::integer, 1)
    when 'Platinum' then coalesce((policy->>'platinum_points_earned')::integer, 1)
    else base_earned end;
  if rate < 1 or base_earned < 1 then raise exception 'Invalid points settings'; end if;
  base_points := floor(sale / rate)::integer * base_earned;
$rate$ || substr(definition, end_at);
  execute definition;
end $$;
