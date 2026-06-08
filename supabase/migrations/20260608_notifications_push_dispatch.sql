-- Lot 2 — Notifications: delivery wiring (DB -> Edge Function -> Expo).
--
--   1. Enable pg_net (outbound HTTP from Postgres).
--   2. Store a shared dispatch secret in Vault (idempotent).
--   3. RPC current_push_dispatch_secret() readable only by service_role, used by
--      the Edge Function to authenticate the incoming webhook.
--   4. AFTER INSERT trigger on public.notifications that POSTs the row to the
--      push-dispatch Edge Function with the shared secret.

-- 1) pg_net ------------------------------------------------------------------
create extension if not exists pg_net;

-- 2) Shared secret in Vault (random, created once) ---------------------------
do $$
begin
    if not exists (select 1 from vault.secrets where name = 'push_dispatch_secret') then
        perform vault.create_secret(
            encode(gen_random_bytes(32), 'hex'),
            'push_dispatch_secret',
            'Shared secret authenticating the notifications -> push-dispatch webhook.'
        );
    end if;
end$$;

-- 3) Secret accessor for the Edge Function (service_role only) ---------------
create or replace function public.current_push_dispatch_secret()
returns text
language sql
security definer
set search_path = public
as $$
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'push_dispatch_secret'
    limit 1;
$$;

revoke all on function public.current_push_dispatch_secret() from public, anon, authenticated;
grant execute on function public.current_push_dispatch_secret() to service_role;

-- 4) Trigger: fan a freshly inserted notification to the Edge Function -------
create or replace function public.notify_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_secret text;
    v_url    text := 'https://prymkgkafaovhzopslea.supabase.co/functions/v1/push-dispatch';
begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'push_dispatch_secret'
    limit 1;

    -- Fire-and-forget; pg_net queues the request so the INSERT is not blocked.
    perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-signature', coalesce(v_secret, '')
        ),
        body := jsonb_build_object('record', to_jsonb(new))
    );

    return new;
end;
$$;

drop trigger if exists trg_notifications_push_dispatch on public.notifications;
create trigger trg_notifications_push_dispatch
    after insert on public.notifications
    for each row execute function public.notify_push_dispatch();
