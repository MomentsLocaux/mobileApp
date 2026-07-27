import HomeScreen from '../../src/screens/home/HomeScreen';
import DiffuseurHomeScreen from '../../src/screens/diffuseur/DiffuseurHomeScreen';
import CreatorHubScreen from '../../src/screens/creator/CreatorHubScreen';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';

export default function TabsHome() {
  const { accountKind, activeMode, canCreate } = useAccountIdentity();

  if (accountKind === 'professionnel') {
    return <DiffuseurHomeScreen />;
  }

  if (canCreate && activeMode === 'create') {
    return <CreatorHubScreen />;
  }

  return <HomeScreen />;
}
