import HomeScreen from '../../src/screens/home/HomeScreen';
import DiffuseurHomeScreen from '../../src/screens/diffuseur/DiffuseurHomeScreen';
import CreatorHubScreen from '../../src/screens/creator/CreatorHubScreen';
import { features } from '@/config/features';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';

export default function TabsHome() {
  const { accountKind, activeMode, canCreate } = useAccountIdentity();

  if (features.diffuseur && accountKind === 'professionnel') {
    return <DiffuseurHomeScreen />;
  }

  if (features.eventCreate && canCreate && activeMode === 'create') {
    return <CreatorHubScreen />;
  }

  return <HomeScreen />;
}
