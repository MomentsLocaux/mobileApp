-- Push dispatch URL must not be hardcoded to a single Supabase project.
-- Each environment sets app_config.supabase_project_url once (see supabase/ops/app_config/).

create table if not exists public.app_config (
    key        text primary key,
    value      text not null,
    updated_at timestamptz not null default now()
);

comment on table public.app_config is
    'Per-project runtime config (one Supabase project = one set of rows). Not exposed to mobile clients.';

alter table public.app_config enable row level security;

-- No policies: only security definer functions and service_role (bypasses RLS) may read/write.

create or replace function public.get_app_config(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select value from public.app_config where key = p_key limit 1;
$$;

revoke all on function public.get_app_config(text) from public, anon, authenticated;
grant execute on function public.get_app_config(text) to service_role;

create or replace function public.resolve_push_dispatch_url()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_base text;
begin
    v_base := public.get_app_config('supabase_project_url');
    if v_base is null or btrim(v_base) = '' then
        v_base := nullif(btrim(current_setting('app.supabase_project_url', true)), '');
    end if;
    if v_base is null then
        return null;
    end if;
    return rtrim(v_base, '/') || '/functions/v1/push-dispatch';
end;
$$;

revoke all on function public.resolve_push_dispatch_url() from public, anon, authenticated;
grant execute on function public.resolve_push_dispatch_url() to service_role;

create or replace function public.notify_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_secret text;
    v_url    text;
begin
    v_url := public.resolve_push_dispatch_url();
    if v_url is null then
        raise warning 'push dispatch skipped: app_config.supabase_project_url is not set';
        return new;
    end if;

    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'push_dispatch_secret'
    limit 1;

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
