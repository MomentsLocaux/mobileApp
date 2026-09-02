import { Redirect } from 'expo-router';
import { features } from '@/config/features';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { useEventPublishSurfaces } from '@/hooks/useEventPublishSurfaces';

/**
 * Tab stub for deep links to /(tabs)/create.
 * Prefer the contribution FAB + EventContributeSheet; this only handles direct navigation.
 */
export default function CreateTabRedirect() {
  const { canCreateNow, canCreate } = useAccountIdentity();
  const { routes, canOrganize } = useEventPublishSurfaces();

  if (!features.eventCreate && !features.eventSuggest) {
    return <Redirect href="/(tabs)/map" />;
  }

  if (features.eventSuggest && !canOrganize) {
    return <Redirect href={`${routes.posterSuggest}?source=community_suggest` as any} />;
  }

  if (canCreateNow) {
    return <Redirect href={routes.eventFormStepper} />;
  }

  return <Redirect href={canCreate ? '/(tabs)/profile' : '/(tabs)/map'} />;
}
