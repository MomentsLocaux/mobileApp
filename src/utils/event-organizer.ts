import { isCommunitySuggestedEvent } from './suggestion-history';

const PLATFORM_ORGANIZER_NAME = 'Moments Locaux';

type OrganizerEvent = {
  creator_id?: string | null;
  submission_source?: string | null;
  creator?: { display_name?: string | null; avatar_url?: string | null } | null;
};

function isUnnamedOrPlatformCreator(creator?: { display_name?: string | null } | null): boolean {
  const name = creator?.display_name?.trim();
  if (!name) return true;
  return name.toLowerCase() === PLATFORM_ORGANIZER_NAME.toLowerCase();
}

/** Public fiche: community suggestions are published as Moments Locaux, not the suggester. */
export function isPlatformOrganizerEvent(event?: OrganizerEvent | null): boolean {
  if (!event) return true;
  if (isCommunitySuggestedEvent(event.submission_source)) return true;
  return isUnnamedOrPlatformCreator(event.creator);
}

/**
 * Organizer privileges (edit/delete chrome, photo exemption).
 * The suggester stays `creator_id` for Mes suggestions / RLS, but is not the organizer.
 */
export function isEventOrganizerOwner(
  userId?: string | null,
  event?: Pick<OrganizerEvent, 'creator_id' | 'submission_source'> | null,
): boolean {
  if (!userId || !event?.creator_id) return false;
  if (isCommunitySuggestedEvent(event.submission_source)) return false;
  return userId === event.creator_id;
}

export function publicOrganizerName(event?: OrganizerEvent | null): string {
  if (isPlatformOrganizerEvent(event)) return PLATFORM_ORGANIZER_NAME;
  return event?.creator?.display_name?.trim() || PLATFORM_ORGANIZER_NAME;
}

export function publicOrganizerMeta(event?: OrganizerEvent | null): string | null {
  if (isCommunitySuggestedEvent(event?.submission_source)) return 'Proposé par un membre';
  if (isUnnamedOrPlatformCreator(event?.creator)) return 'Agenda public';
  return null;
}

/** Never expose the suggester avatar on a community-suggested fiche. */
export function shouldUseCreatorOrganizerAvatar(event?: OrganizerEvent | null): boolean {
  if (!event?.creator?.avatar_url) return false;
  if (isCommunitySuggestedEvent(event.submission_source)) return false;
  return true;
}
