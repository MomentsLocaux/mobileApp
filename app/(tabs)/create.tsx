import { Redirect } from 'expo-router';
import { features } from '@/config/features';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';

/** Tab stub — only enter create flow when FEATURE_EVENT_CREATE is on (ADR_007). */
export default function CreateTabRedirect() {
  const { canCreateNow, canCreate } = useAccountIdentity();

  if (!features.eventCreate) {
    return <Redirect href="/(tabs)/map" />;
  }

  if (canCreateNow) {
    return <Redirect href="/events/create/step-1" />;
  }

  // Discover-only or discover mode → bounce to profile (switch / explain).
  return <Redirect href={canCreate ? '/(tabs)/profile' : '/(tabs)/map'} />;
}
