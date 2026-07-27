import { Redirect } from 'expo-router';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';

/** Legacy /creator/dashboard → Diffuseur home (pro) or map (autres). */
export default function CreatorDashboardRedirect() {
  const { accountKind } = useAccountIdentity();
  if (accountKind === 'professionnel') {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/(tabs)/map" />;
}
