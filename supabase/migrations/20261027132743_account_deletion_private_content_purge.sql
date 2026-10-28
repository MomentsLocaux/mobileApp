-- Follow-up MVP-P0-006 / SCRUM-277.
-- Append-only. Do NOT apply without human validation (AGENTS.md).
--
-- process_account_deletion inserts account_deletion_requests. This trigger runs
-- in that same transaction and clears private content added after SCRUM-277.
-- Direct-message participation is kept: the inbox lists a thread only when both
-- participants still exist. The deleted account cannot sign in (Auth soft delete).
-- Message text written by that account is replaced. The other person's messages stay.

create or replace function public.purge_private_content_on_deletion_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if to_regclass('public.direct_messages') is not null then
    update public.direct_messages
    set body = 'Message supprimé'
    where sender_id = new.user_id;
  end if;

  if to_regclass('public.event_correction_proposals') is not null then
    -- DELETE only. An UPDATE would fire validate_event_correction_proposal
    -- and can abort the whole account deletion.
    delete from public.event_correction_proposals
    where proposer_id = new.user_id;
  end if;

  if to_regclass('public.notification_digest_queue') is not null then
    delete from public.notification_digest_queue
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purge_private_content_on_deletion on public.account_deletion_requests;
create trigger trg_purge_private_content_on_deletion
  after insert on public.account_deletion_requests
  for each row
  execute function public.purge_private_content_on_deletion_request();

revoke all on function public.purge_private_content_on_deletion_request() from public, anon, authenticated;
grant execute on function public.purge_private_content_on_deletion_request() to service_role;

comment on function public.purge_private_content_on_deletion_request() is
  'MVP-P0-006 follow-up. On account_deletion_requests insert: anonymise direct messages sent by the user, delete correction proposals they authored, and delete their notification digest queue. Does not remove conversation participation or reviewer ids.';
