-- Additive, development-only credential store. No legacy data is read or copied.
create table public.c2_development_auth (
  user_id uuid primary key references auth.users(id) on delete cascade,
  environment text not null default 'development' check (environment = 'development'),
  state_hash text,
  state_expires_at timestamptz,
  operation_id uuid,
  operation_started_at timestamptz,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  provider_user_id text unique, -- one LC owner per development provider account

  needs_reconnect boolean not null default false
);
alter table public.c2_development_auth enable row level security;
revoke all on public.c2_development_auth from public, anon, authenticated;
grant all on public.c2_development_auth to service_role;

-- Service-only atomic state consumption + durable per-account mutex. No expiring
-- lease: an ambiguous provider timeout must never dispatch a second refresh.
create function public.c2_development_auth_operation(
  p_user_id uuid, p_action text, p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.c2_development_auth; op uuid;
begin
  insert into public.c2_development_auth(user_id) values(p_user_id) on conflict do nothing;
  select * into r from public.c2_development_auth where user_id=p_user_id for update;
  if p_action = 'status' then
    return jsonb_build_object('connected', r.access_token is not null and not r.needs_reconnect,
      'busy', r.operation_id is not null, 'needs_reconnect', r.needs_reconnect,
      'provider_user_id', r.provider_user_id, 'environment', r.environment);
  end if;
  if p_action in ('save', 'reject') then
    if r.operation_id is null or r.operation_id is distinct from (p_values->>'operation_id')::uuid then
      raise exception 'Invalid operation';
    end if;
    if p_action = 'reject' then
      update public.c2_development_auth set access_token=null, refresh_token=null, expires_at=null,
        operation_id=null, operation_started_at=null, needs_reconnect=true where user_id=p_user_id;
      return '{}'::jsonb;
    end if;
    update public.c2_development_auth set access_token=p_values->>'access_token',
      refresh_token=p_values->>'refresh_token', expires_at=(p_values->>'expires_at')::timestamptz,
      provider_user_id=p_values->>'provider_user_id', needs_reconnect=false,
      operation_id=null, operation_started_at=null where user_id=p_user_id;
    return '{}'::jsonb;
  end if;
  if r.operation_id is not null then raise exception 'Operation pending; operator recovery required'; end if;
  if p_action = 'begin' then
    update public.c2_development_auth set state_hash=p_values->>'state_hash',
      state_expires_at=now()+interval '10 minutes' where user_id=p_user_id;
    return '{}'::jsonb;
  elsif p_action = 'exchange' then
    if r.state_hash is null or r.state_hash is distinct from p_values->>'state_hash' or r.state_expires_at <= now() then
      raise exception 'Invalid or expired state';
    end if;
  elsif p_action = 'refresh' then
    if r.needs_reconnect or r.refresh_token is null then raise exception 'Reconnect required'; end if;
    if r.expires_at > now()+interval '5 minutes' then return '{"fresh":true}'::jsonb; end if;
  else
    raise exception 'Unknown action';
  end if;
  op := gen_random_uuid();
  update public.c2_development_auth set operation_id=op, operation_started_at=now(),
    state_hash=null, state_expires_at=null where user_id=p_user_id;
  return jsonb_build_object('operation_id', op, 'refresh_token', r.refresh_token,
    'provider_user_id', r.provider_user_id);
end;
$$;
revoke all on function public.c2_development_auth_operation(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.c2_development_auth_operation(uuid,text,jsonb) to service_role;
