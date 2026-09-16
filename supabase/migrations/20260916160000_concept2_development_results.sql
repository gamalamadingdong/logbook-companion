-- Development snapshots only: deliberately disconnected from workout_logs and analytics.
create table public.c2_development_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_user_id text not null,
  result_id bigint not null check (result_id > 0),
  environment text not null default 'development' check (environment = 'development'),
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  imported_at timestamptz not null default now(),
  primary key (user_id, provider_user_id, result_id)
);
alter table public.c2_development_results enable row level security;
revoke all on public.c2_development_results from public, anon, authenticated;
grant all on public.c2_development_results to service_role;

-- Uses the auth row's existing mutex, preventing reconnect/refresh during reads.
-- GET failures may release this claim; rotating OAuth failures must not.
create function public.c2_development_sync_operation(
  p_user_id uuid, p_action text, p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.c2_development_auth; op uuid; item jsonb; n integer := 0; page_number integer;
begin
  select * into r from public.c2_development_auth where user_id = p_user_id for update;
  if not found then raise exception 'Development connection required'; end if;
  if p_action = 'list' then
    page_number := coalesce((p_values->>'page')::integer, 1);
    if page_number < 1 or page_number > 100000 then raise exception 'Invalid page'; end if;
    return jsonb_build_object('environment', 'development', 'results', coalesce((
      select jsonb_agg(x.summary order by x.result_id desc) from (
        select summary, result_id from public.c2_development_results
        where user_id = p_user_id and provider_user_id = r.provider_user_id
        order by result_id desc limit 25 offset (page_number-1)*25
      ) x), '[]'::jsonb), 'total', (
        select count(*) from public.c2_development_results
        where user_id = p_user_id and provider_user_id = r.provider_user_id));
  elsif p_action = 'claim' then
    if r.operation_id is not null then raise exception 'Operation pending'; end if;
    if r.needs_reconnect or r.access_token is null or r.provider_user_id is null
      or r.expires_at is null or r.expires_at <= now()+interval '30 seconds' then
      raise exception 'Check / refresh connection first';
    end if;
    op := gen_random_uuid();
    update public.c2_development_auth set operation_id = op, operation_started_at = now()
      where user_id = p_user_id;
    return jsonb_build_object('operation_id', op, 'access_token', r.access_token);
  elsif p_action in ('save', 'release', 'unauthorized') then
    if r.operation_id is null or r.operation_id is distinct from (p_values->>'operation_id')::uuid then
      raise exception 'Invalid operation';
    end if;
    if p_action = 'save' then
      if jsonb_typeof(p_values->'results') is distinct from 'array'
        or jsonb_array_length(p_values->'results') > 25 then raise exception 'Invalid results'; end if;
      for item in select value from jsonb_array_elements(p_values->'results') loop
        insert into public.c2_development_results(user_id, provider_user_id, result_id, summary)
          values(p_user_id, r.provider_user_id, (item->>'id')::bigint, item)
          on conflict (user_id, provider_user_id, result_id) do update
          set summary = excluded.summary, imported_at = now();
        n := n+1;
      end loop;
    end if;
    -- A GET 401 permits a later serialized refresh, not a blind retry.
    update public.c2_development_auth set operation_id = null, operation_started_at = null,
      expires_at = case when p_action = 'unauthorized' then now() else expires_at end
      where user_id = p_user_id;
    return jsonb_build_object('environment', 'development', 'imported', n);
  end if;
  raise exception 'Unknown action';
end;
$$;
revoke all on function public.c2_development_sync_operation(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.c2_development_sync_operation(uuid,text,jsonb) to service_role;
