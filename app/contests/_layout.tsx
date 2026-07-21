import { Redirect, Stack } from 'expo-router';
import { CONTESTS_ENABLED } from '@/config/contests.flags';

export default function ContestsLayout() {
  if (!CONTESTS_ENABLED) {
    return <Redirect href="/(tabs)/map" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    />
  );
}
