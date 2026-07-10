import { Redirect, Stack } from 'expo-router';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';

export default function DiscoveryLayout() {
  if (!DISCOVERY_ENABLED) {
    return <Redirect href="/(tabs)/map" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="my-radius" />
      <Stack.Screen name="break-the-loop" />
    </Stack>
  );
}
