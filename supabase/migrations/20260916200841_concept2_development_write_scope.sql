-- Existing connections retain read-only scope. A new authorization flow explicitly
-- requests write permission; refresh preserves the original grant.
alter table public.c2_development_auth
  add column token_scope text not null default 'user:read,results:read'
    check (token_scope in ('user:read,results:read','user:read,results:write')),
  add column requested_scope text not null default 'user:read,results:read'
    check (requested_scope in ('user:read,results:read','user:read,results:write')),
  add column operation_scope text
    check (operation_scope in ('user:read,results:read','user:read,results:write'));

-- An operation begun by the old function remains read-only through deployment.
update public.c2_development_auth set operation_scope='user:read,results:read'
  where operation_id is not null;

create or replace function public.c2_development_auth_operation(
  p_user_id uuid, p_action text, p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.c2_development_auth; op uuid;
begin
  insert into public.c2_development_auth(user_id) values(p_user_id) on conflict do nothing;
  select * into r from public.c2_development_auth where user_id=p_user_id for update;
  if p_action = 'status' then
    return jsonb_build_object('connected', r.access_token is not null and not r.needs_reconnect,
      'busy', r.operation_id is not null, 'needs_reconnect', r.needs_reconnect,
      'provider_user_id', r.provider_user_id, 'environment', r.environment,
      'can_publish', r.access_token is not null and not r.needs_reconnect
        and r.token_scope = 'user:read,results:write');
  end if;
  if p_action in ('save', 'reject') then
    if r.operation_id is null or r.operation_id is distinct from (p_values->>'operation_id')::uuid then
      raise exception 'Invalid operation';
    end if;
    if p_action = 'reject' then
      update public.c2_development_auth set access_token=null, refresh_token=null, expires_at=null,
        operation_id=null, operation_started_at=null, operation_scope=null,
        token_scope='user:read,results:read', needs_reconnect=true where user_id=p_user_id;
      return '{}'::jsonb;
    end if;
    if r.operation_scope is null or
      coalesce(p_values->>'token_scope', r.operation_scope) is distinct from r.operation_scope then
      raise exception 'Invalid token scope';
    end if;
    update public.c2_development_auth set access_token=p_values->>'access_token',
      refresh_token=p_values->>'refresh_token', expires_at=(p_values->>'expires_at')::timestamptz,
      provider_user_id=p_values->>'provider_user_id', needs_reconnect=false,
      token_scope=r.operation_scope, operation_id=null, operation_started_at=null,
      operation_scope=null where user_id=p_user_id;
    return '{}'::jsonb;
  end if;
  if r.operation_id is not null then raise exception 'Operation pending; operator recovery required'; end if;
  if p_action = 'begin' then
    update public.c2_development_auth set state_hash=p_values->>'state_hash',
      state_expires_at=now()+interval '10 minutes',
      requested_scope=coalesce(p_values->>'requested_scope','user:read,results:read')
      where user_id=p_user_id;
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
    operation_scope=case when p_action='exchange' then r.requested_scope else r.token_scope end,
    state_hash=null, state_expires_at=null where user_id=p_user_id;
  return jsonb_build_object('operation_id', op, 'refresh_token', r.refresh_token,
    'provider_user_id', r.provider_user_id,
    'token_scope', case when p_action='exchange' then r.requested_scope else r.token_scope end);
end;
$$;
revoke all on function public.c2_development_auth_operation(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.c2_development_auth_operation(uuid,text,jsonb) to service_role;
