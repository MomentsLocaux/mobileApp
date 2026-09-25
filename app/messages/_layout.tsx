import { Stack } from 'expo-router';
import { stackPushOptions } from '@/constants/navigation';

export default function MessagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, ...stackPushOptions }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
