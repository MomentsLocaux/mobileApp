import { Stack } from 'expo-router';
import { FeatureGate } from '@/components/FeatureGate';

export default function EventCreateLayout() {
  return (
    <FeatureGate flag="eventCreate">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureGate>
  );
}
