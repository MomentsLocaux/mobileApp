import { features } from '@/config/features';
import { useAuth } from '@/hooks';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';

/**
 * Unified contribute FAB (organizer create vs community suggest vs bug report).
 *
 * | eventCreate | eventSuggest | canCreateNow | FAB + behavior              |
 * |-------------|--------------|--------------|-----------------------------|
 * | off         | off          | —            | bug report only (if authed) |
 * | off         | on           | —            | method sheet (suggest)      |
 * | on          | off          | yes          | method sheet (create+bug)   |
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
  const showMyEvents = eventCreate && (canCreate || canCreateNow);
  const showMySuggestions = isAuthenticated;
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
    showMySuggestions,
    showPosterSuggestOnCreateHub,
    canAccessEventForm,
    routes: {
      posterSuggest: '/events/suggest-from-poster' as const,
      organizerCreate: '/events/create' as const,
      eventFormStepper: '/events/create' as const,
      myEvents: '/profile/my-events' as const,
      mySuggestions: '/profile/my-suggestions' as const,
    },
  };
}
