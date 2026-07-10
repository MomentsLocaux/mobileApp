import { Stack } from 'expo-router';

export default function SettingsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="discovery" />
      <Stack.Screen name="privacy/policy" />
      <Stack.Screen name="privacy/delete" />
      <Stack.Screen name="privacy/export" />
      <Stack.Screen name="legal/cgu" />
      <Stack.Screen name="legal/mentions" />
      <Stack.Screen name="legal/cookies" />
      <Stack.Screen name="account/email" />
      <Stack.Screen name="account/personal" />
      <Stack.Screen name="account/preferences" />
      <Stack.Screen name="security/account" />
      <Stack.Screen name="security/password" />
      <Stack.Screen name="security/sessions" />
    </Stack>
  );
}
