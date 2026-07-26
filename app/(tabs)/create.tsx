import { Redirect } from 'expo-router';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';

/** Tab stub — only enter create flow when create surfaces are allowed (ADR_007). */
export default function CreateTabRedirect() {
  const { canCreateNow, canCreate } = useAccountIdentity();

  if (canCreateNow) {
    return <Redirect href="/events/create/step-1" />;
  }

  // Discover-only or discover mode → bounce to profile (switch / explain).
  return <Redirect href={canCreate ? '/(tabs)/profile' : '/(tabs)/map'} />;
}
