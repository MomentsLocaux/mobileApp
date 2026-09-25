import { Stack } from 'expo-router';
import { stackPushOptions } from '@/constants/navigation';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...stackPushOptions }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="callback" />
    </Stack>
  );
}
