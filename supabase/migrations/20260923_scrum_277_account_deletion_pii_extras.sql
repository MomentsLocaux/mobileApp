-- SCRUM-277 — extra PII purge after account deletion.
-- Append-only. Do NOT apply without human validation (AGENTS.md).
--
-- Decision: keep Auth **soft delete** (`auth.admin.deleteUser(id, true)` in
-- `delete-account`). ON DELETE CASCADE does not fire on a soft-deleted Auth
-- user, so these tables must be purged explicitly.

create or replace function public.purge_account_pii_extras(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'user id required' using errcode = '42501';
  end if;

  if to_regclass('public.user_preferences') is not null then
    execute 'delete from public.user_preferences where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.device_push_tokens') is not null then
    execute 'delete from public.device_push_tokens where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.lumia_chat_usage') is not null then
    execute 'delete from public.lumia_chat_usage where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.event_cover_generate_usage') is not null then
    execute 'delete from public.event_cover_generate_usage where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.event_poster_analyze_usage') is not null then
    execute 'delete from public.event_poster_analyze_usage where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.event_suggest_usage') is not null then
    execute 'delete from public.event_suggest_usage where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.account_export_requests') is not null then
    execute 'delete from public.account_export_requests where user_id = $1' using p_user_id;
  end if;
end;
$$;

revoke all on function public.purge_account_pii_extras(uuid) from public;
grant execute on function public.purge_account_pii_extras(uuid) to service_role;

comment on function public.purge_account_pii_extras(uuid) is
  'SCRUM-277 extras: prefs, push tokens, IA usage counters, account exports. Called from delete-account; not a substitute for process_account_deletion.';
