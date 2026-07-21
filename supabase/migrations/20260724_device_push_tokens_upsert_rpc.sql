-- Allow the signed-in user to register/refresh their Expo push token even when
-- the same device token was previously owned by another account (account switch).
-- Plain upsert fails RLS UPDATE USING when the existing row belongs to someone else.

create or replace function public.upsert_my_device_push_token(
  p_token text,
  p_platform text,
  p_device_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'token required';
  end if;

  if p_platform is null or p_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid platform';
  end if;

  insert into public.device_push_tokens as t (
    user_id,
    token,
    platform,
    device_name,
    last_seen_at
  )
  values (
    v_uid,
    trim(p_token),
    p_platform,
    nullif(trim(coalesce(p_device_name, '')), ''),
    now()
  )
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        device_name = excluded.device_name,
        last_seen_at = now();
end;
$$;

revoke all on function public.upsert_my_device_push_token(text, text, text) from public;
grant execute on function public.upsert_my_device_push_token(text, text, text) to authenticated;

comment on function public.upsert_my_device_push_token(text, text, text) is
  'Registers or reclaims the current device Expo push token for auth.uid().';
