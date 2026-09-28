create table public.line_connections (
  owner_id uuid primary key references public.store_settings(owner_id) on delete cascade,
  channel_id text not null,
  channel_secret text not null,
  access_token text not null,
  bot_user_id text not null,
  bot_display_name text not null default '',
  bot_basic_id text not null default '',
  membership_url text,
  login_channel_id text,
  liff_id text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.line_connections enable row level security;
revoke all on public.line_connections from public, anon, authenticated;
grant all on public.line_connections to service_role;

create table public.line_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  line_user_id text not null check (line_user_id ~ '^U[0-9a-f]{32}$'),
  member_id uuid references public.members(id) on delete set null,
  display_name text not null default 'ลูกค้า LINE',
  picture_url text,
  profile_synced_at timestamptz,
  status text not null default 'new' check (status in ('new','open','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  internal_note text not null default '',
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  last_message_preview text not null default '',
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, line_user_id)
);
create index line_conversations_owner_recent_idx on public.line_conversations(owner_id, last_message_at desc nulls last);
create index line_conversations_assigned_idx on public.line_conversations(owner_id, assigned_to, last_message_at desc nulls last);
create index line_conversations_member_idx on public.line_conversations(member_id);
alter table public.line_conversations enable row level security;
revoke all on public.line_conversations from public, anon, authenticated;
grant all on public.line_conversations to service_role;

create table public.line_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  conversation_id uuid not null references public.line_conversations(id) on delete cascade,
  line_message_id text,
  client_request_id uuid,
  direction text not null check (direction in ('incoming','outgoing')),
  kind text not null default 'text' check (kind in ('text','image','sticker','file','other')),
  body text not null default '',
  send_status text not null default 'received' check (send_status in ('received','pending','sent','failed')),
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_id, line_message_id),
  unique (owner_id, client_request_id)
);
create index line_messages_conversation_recent_idx on public.line_messages(conversation_id, created_at desc);
alter table public.line_messages enable row level security;
revoke all on public.line_messages from public, anon, authenticated;
grant all on public.line_messages to service_role;

alter table public.line_member_links
  add column line_display_name text,
  add column line_picture_url text,
  add column profile_synced_at timestamptz;

create function public.line_record_inbound(
  store_owner uuid, subject text, profile_name text, profile_picture text,
  message_key text, message_kind text, message_body text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  conversation uuid;
  inserted_message uuid;
  linked_member uuid;
begin
  if subject !~ '^U[0-9a-f]{32}$' or length(message_body) > 5000 then
    raise exception 'Invalid LINE event';
  end if;
  select member_id into linked_member from public.line_member_links
  where owner_id = store_owner and line_user_id = subject;
  insert into public.line_conversations
    (owner_id, line_user_id, member_id, display_name, picture_url, profile_synced_at)
  values (store_owner, subject, linked_member, coalesce(nullif(profile_name, ''), 'ลูกค้า LINE'),
    profile_picture, case when profile_name is not null then now() else null end)
  on conflict (owner_id, line_user_id) do update set
    member_id = coalesce(excluded.member_id, public.line_conversations.member_id),
    display_name = case when profile_name is not null then excluded.display_name else public.line_conversations.display_name end,
    picture_url = case when profile_name is not null then excluded.picture_url else public.line_conversations.picture_url end,
    profile_synced_at = case when profile_name is not null then now() else public.line_conversations.profile_synced_at end,
    blocked_at = null,
    updated_at = now()
  returning id into conversation;
  insert into public.line_messages(owner_id, conversation_id, line_message_id, direction, kind, body)
  values (store_owner, conversation, message_key, 'incoming', message_kind, message_body)
  on conflict (owner_id, line_message_id) do nothing
  returning id into inserted_message;
  if inserted_message is not null then
    update public.line_conversations set
      unread_count = unread_count + 1,
      status = case when status = 'closed' then 'new' else status end,
      last_message_at = now(), last_message_preview = left(message_body, 180), updated_at = now()
    where id = conversation;
  end if;
  return conversation;
end;
$$;
revoke all on function public.line_record_inbound(uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.line_record_inbound(uuid,text,text,text,text,text,text) to service_role;

create table public.line_quick_replies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index line_quick_replies_owner_idx on public.line_quick_replies(owner_id, created_at);
alter table public.line_quick_replies enable row level security;
revoke all on public.line_quick_replies from public, anon, authenticated;
grant all on public.line_quick_replies to service_role;
