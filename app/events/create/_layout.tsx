import { Stack } from 'expo-router';
import { EventFormLayoutGate } from '@/components/identity/EventFormLayoutGate';

export default function EventCreateLayout() {
  return (
    <EventFormLayoutGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="step-1" />
        <Stack.Screen name="step-2" />
        <Stack.Screen name="step-3" />
        <Stack.Screen name="preview" />
      </Stack>
    </EventFormLayoutGate>
  );
}
