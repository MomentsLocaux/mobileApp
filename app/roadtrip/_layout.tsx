import { Redirect, Stack } from 'expo-router';
import { features } from '@/config/features';

export default function RoadtripLayout() {
  if (!features.roadtrip) {
    return <Redirect href="/(tabs)/map" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
