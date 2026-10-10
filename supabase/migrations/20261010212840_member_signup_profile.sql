-- Register optional profile fields in the same transaction as membership.
create function public.register_line_member_profile(line_subject text,first text,last text,member_gender text,birthday date,mobile text,profile jsonb)
returns public.members language plpgsql security invoker set search_path='' as $$
declare shop_owner uuid; linked_member public.members; email_value text:=nullif(lower(trim(profile->>'email')),''); dogs integer; cats integer;
begin
 if line_subject is null or first is null or last is null or member_gender is null or mobile is null
  or line_subject !~ '^U[0-9a-f]{32}$' or length(trim(first)) not between 1 and 80 or length(trim(last)) not between 1 and 80
  or member_gender not in ('male','female','other','prefer_not_to_say')
  or birthday>current_date or birthday<date '1900-01-01' or mobile !~ '^0[0-9]{9}$'
  or profile is null or jsonb_typeof(profile)<>'object'
  or email_value is not null and (length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  or coalesce(profile->>'dogCount','0') !~ '^[0-9]{1,3}$' or coalesce(profile->>'catCount','0') !~ '^[0-9]{1,3}$'
 then raise exception 'INVALID_REGISTRATION';end if;
 dogs:=coalesce((profile->>'dogCount')::integer,0);cats:=coalesce((profile->>'catCount')::integer,0);
 select owner_id into shop_owner from public.public_shop_profiles where slug='tammy';
 if shop_owner is null then raise exception 'SHOP_NOT_CONFIGURED';end if;
 select * into linked_member from public.members where owner_id=shop_owner and line_user_id=line_subject;
 if found then return linked_member;end if;
 if exists(select 1 from public.members where owner_id=shop_owner and phone=mobile) then raise exception 'PHONE_ALREADY_REGISTERED';end if;
 insert into public.members(owner_id,member_code,name,first_name,last_name,gender,birth_date,phone,email,dog_count,cat_count,level,points,spending,status,newsletter_opt_in,notes,tags,line_user_id,line_linked_at)
 values(shop_owner,'TM'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),trim(first)||' '||trim(last),trim(first),trim(last),member_gender,birthday,mobile,email_value,dogs,cats,'Member',0,0,'active',false,'',array['สมัครผ่าน LINE'],line_subject,now()) returning * into linked_member;
 return linked_member;
end $$;
revoke all on function public.register_line_member_profile(text,text,text,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.register_line_member_profile(text,text,text,text,date,text,jsonb) to service_role;
