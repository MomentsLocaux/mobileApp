import { Stack } from 'expo-router';
import { FeatureGate } from '@/components/FeatureGate';

export default function EventCreateLayout() {
  return (
    <FeatureGate flag="eventCreate">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="step-1" />
        <Stack.Screen name="step-2" />
        <Stack.Screen name="step-3" />
        <Stack.Screen name="preview" />
      </Stack>
    </FeatureGate>
  );
}
