alter table public.members
  add column dog_count integer not null default 0 check (dog_count between 0 and 999),
  add column cat_count integer not null default 0 check (cat_count between 0 and 999);

-- Start with pets already recorded by this member's shop.
update public.members m
set dog_count = least(p.dogs, 999), cat_count = least(p.cats, 999)
from (
  select owner_id, member_id,
    count(*) filter (where species = 'dog')::integer as dogs,
    count(*) filter (where species = 'cat')::integer as cats
  from public.pets group by owner_id, member_id
) p
where m.id = p.member_id and m.owner_id = p.owner_id;
