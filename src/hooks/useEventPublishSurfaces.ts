import { features } from '@/config/features';
import { useAuth } from '@/hooks';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';

/**
 * Unified "+" contribute entry (organizer create vs community suggest).
 *
 * | eventCreate | eventSuggest | canCreateNow | FAB + behavior              |
 * |-------------|--------------|--------------|-----------------------------|
 * | off         | off          | —            | hidden                      |
 * | off         | on           | —            | method sheet (suggest)      |
 * | on          | off          | yes          | direct organizer form       |
 * | on          | on           | yes          | intent sheet → method       |
 * | on          | on           | no           | method sheet (suggest only) |
 */
export function useEventPublishSurfaces() {
  const { isAuthenticated } = useAuth();
  const { canCreateNow, canCreate } = useAccountIdentity();

  const eventCreate = features.eventCreate;
  const eventSuggest = features.eventSuggest;

  const canOrganize = eventCreate && canCreateNow;
  const showCenterTabAction = eventSuggest || canOrganize;
  const needsIntentChooser = canOrganize && eventSuggest;

  const showOrganizerCreateDrawer = eventCreate && canCreate;
  const showPosterSuggestDrawer = eventSuggest;
  const showMyEvents = (eventCreate && (canCreate || canCreateNow)) || eventSuggest;
  const showPosterSuggestOnCreateHub = canOrganize && eventSuggest;

  const canAccessEventForm =
    (eventCreate && canCreateNow) || (eventSuggest && isAuthenticated);

  return {
    eventCreate,
    eventSuggest,
    canOrganize,
    needsIntentChooser,
    showCenterTabAction,
    showOrganizerCreateDrawer,
    showPosterSuggestDrawer,
    showMyEvents,
    showPosterSuggestOnCreateHub,
    canAccessEventForm,
    routes: {
      posterSuggest: '/events/suggest-from-poster' as const,
      organizerCreate: '/events/create' as const,
      eventFormStepper: '/events/create' as const,
      myEvents: '/profile/my-events' as const,
    },
  };
}
