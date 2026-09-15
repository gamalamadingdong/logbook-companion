create table public.admin_email_deliveries (
  event_type text not null check (event_type in ('user_signup', 'user_feedback')),
  source_id uuid not null,
  status text not null check (status in ('processing', 'sent', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_type, source_id),
  check ((status = 'sent') = (sent_at is not null))
);

alter table public.admin_email_deliveries enable row level security;
revoke all on public.admin_email_deliveries from anon, authenticated;
grant select, insert, update on public.admin_email_deliveries to service_role;

create function public.claim_admin_email_delivery(
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
    attempt_count
  )
  values (
    p_event_type,
    p_source_id,
    'processing',
    1
  )
  on conflict (event_type, source_id) do update
  set status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      claimed_at = now(),
      sent_at = null,
      last_error = null,
      updated_at = now()
  where delivery.status = 'failed'
     or (
       delivery.status = 'processing'
       and delivery.claimed_at < now() - interval '10 minutes'
     )
  returning *;
end;
$$;

create function public.complete_admin_email_delivery(
  p_event_type text,
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.admin_email_deliveries
  set status = 'sent',
      sent_at = now(),
      last_error = null,
      updated_at = now()
  where event_type = p_event_type
    and source_id = p_source_id
    and status = 'processing';
end;
$$;

create function public.fail_admin_email_delivery(
  p_event_type text,
  p_source_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.admin_email_deliveries
  set status = 'failed',
      sent_at = null,
      last_error = left(p_error, 1000),
      updated_at = now()
  where event_type = p_event_type
    and source_id = p_source_id
    and status = 'processing';
end;
$$;

revoke all on function public.claim_admin_email_delivery(text, uuid) from public, anon, authenticated;
revoke all on function public.complete_admin_email_delivery(text, uuid) from public, anon, authenticated;
revoke all on function public.fail_admin_email_delivery(text, uuid, text) from public, anon, authenticated;

grant execute on function public.claim_admin_email_delivery(text, uuid) to service_role;
grant execute on function public.complete_admin_email_delivery(text, uuid) to service_role;
grant execute on function public.fail_admin_email_delivery(text, uuid, text) to service_role;

create extension if not exists pg_net with schema extensions;

create function public.notify_admin_user_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret
  into webhook_secret
  from vault.decrypted_secrets
  where name = 'admin_notification_webhook_secret';

  if coalesce(webhook_secret, '') = '' then
    raise warning 'Skipping admin signup notification: Vault secret is missing';
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

  return new;
exception
  when others then
    raise warning 'Failed to queue admin signup notification for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

create function public.notify_admin_user_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret
  into webhook_secret
  from vault.decrypted_secrets
  where name = 'admin_notification_webhook_secret';

  if coalesce(webhook_secret, '') = '' then
    raise warning 'Skipping admin feedback notification: Vault secret is missing';
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

  return new;
exception
  when others then
    raise warning 'Failed to queue admin feedback notification for feedback %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.notify_admin_user_signup() from public, anon, authenticated;
revoke all on function public.notify_admin_user_feedback() from public, anon, authenticated;

create trigger notify_admin_user_signup_after_insert
after insert on auth.users
for each row execute function public.notify_admin_user_signup();

create trigger notify_admin_user_feedback_after_insert
after insert on public.user_feedback
for each row execute function public.notify_admin_user_feedback();
