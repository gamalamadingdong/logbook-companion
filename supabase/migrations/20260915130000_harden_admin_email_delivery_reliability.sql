alter table public.admin_email_deliveries
  drop constraint admin_email_deliveries_status_check,
  drop constraint admin_email_deliveries_attempt_count_check;

alter table public.admin_email_deliveries
  alter column claimed_at drop not null,
  add column claim_token uuid;

update public.admin_email_deliveries
set claim_token = gen_random_uuid()
where status <> 'pending';

alter table public.admin_email_deliveries
  add constraint admin_email_deliveries_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  add constraint admin_email_deliveries_attempt_count_check
    check (attempt_count >= 0),
  add constraint admin_email_deliveries_claim_state_check
    check (
      (status = 'pending' and attempt_count = 0 and claimed_at is null and claim_token is null)
      or
      (status <> 'pending' and attempt_count > 0 and claimed_at is not null and claim_token is not null)
    );

alter table public.admin_email_deliveries
  alter column attempt_count set default 0,
  alter column claimed_at drop default;

create or replace function public.claim_admin_email_delivery(
  p_event_type text,
  p_source_id uuid
)
returns setof public.admin_email_deliveries
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  insert into public.admin_email_deliveries as delivery (
    event_type,
    source_id,
    status,
    attempt_count,
    claimed_at,
    claim_token
  )
  values (
    p_event_type,
    p_source_id,
    'processing',
    1,
    now(),
    gen_random_uuid()
  )
  on conflict (event_type, source_id) do update
  set status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      claimed_at = now(),
      claim_token = gen_random_uuid(),
      sent_at = null,
      last_error = null,
      updated_at = now()
  where delivery.status in ('pending', 'failed')
     or (
       delivery.status = 'processing'
       and delivery.claimed_at < now() - interval '10 minutes'
     )
  returning *;
end;
$$;

drop function public.complete_admin_email_delivery(text, uuid);
drop function public.fail_admin_email_delivery(text, uuid, text);

create function public.complete_admin_email_delivery(
  p_event_type text,
  p_source_id uuid,
  p_claim_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.admin_email_deliveries
  set status = 'sent',
      sent_at = now(),
      last_error = null,
      updated_at = now()
  where event_type = p_event_type
    and source_id = p_source_id
    and status = 'processing'
    and claim_token = p_claim_token;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Admin email delivery claim is stale or missing';
  end if;
end;
$$;

create function public.fail_admin_email_delivery(
  p_event_type text,
  p_source_id uuid,
  p_claim_token uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.admin_email_deliveries
  set status = 'failed',
      sent_at = null,
      last_error = left(p_error, 1000),
      updated_at = now()
  where event_type = p_event_type
    and source_id = p_source_id
    and status = 'processing'
    and claim_token = p_claim_token;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Admin email delivery claim is stale or missing';
  end if;
end;
$$;

revoke all on function public.complete_admin_email_delivery(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.fail_admin_email_delivery(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.complete_admin_email_delivery(text, uuid, uuid) to service_role;
grant execute on function public.fail_admin_email_delivery(text, uuid, uuid, text) to service_role;

create or replace function public.notify_admin_user_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  insert into public.admin_email_deliveries (
    event_type,
    source_id,
    status,
    attempt_count,
    claimed_at,
    claim_token
  ) values (
    'user_signup',
    new.id,
    'pending',
    0,
    null,
    null
  ) on conflict (event_type, source_id) do nothing;

  begin
    select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
    where name = 'admin_notification_webhook_secret';

  if coalesce(webhook_secret, '') = '' then
    raise warning 'Admin signup notification pending: Vault secret is missing';
    return new;
  end if;

  perform net.http_post(
    url := 'https://vmlhcbkyonemmlawnqqr.supabase.co/functions/v1/notify-user-signup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || webhook_secret,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'schema', tg_table_schema,
      'table', tg_table_name,
      'record', jsonb_build_object('id', new.id)
    ),
    timeout_milliseconds := 5000
  );
  exception
    when others then
      raise warning 'Failed to queue pending admin signup notification for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

create or replace function public.notify_admin_user_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  insert into public.admin_email_deliveries (
    event_type,
    source_id,
    status,
    attempt_count,
    claimed_at,
    claim_token
  ) values (
    'user_feedback',
    new.id,
    'pending',
    0,
    null,
    null
  ) on conflict (event_type, source_id) do nothing;

  begin
    select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
    where name = 'admin_notification_webhook_secret';

  if coalesce(webhook_secret, '') = '' then
    raise warning 'Admin feedback notification pending: Vault secret is missing';
    return new;
  end if;

  perform net.http_post(
    url := 'https://vmlhcbkyonemmlawnqqr.supabase.co/functions/v1/notify-feedback',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || webhook_secret,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'schema', tg_table_schema,
      'table', tg_table_name,
      'record', jsonb_build_object('id', new.id)
    ),
    timeout_milliseconds := 5000
  );
  exception
    when others then
      raise warning 'Failed to queue pending admin feedback notification for feedback %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
