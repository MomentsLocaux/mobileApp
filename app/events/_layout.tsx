import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function EventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.brand.primary,
        },
        headerTintColor: colors.brand.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.brand.background },
      }}
    >
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
          presentation: 'modal',
          gestureEnabled: true,
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="echoes"
        options={{
          headerShown: false,
          presentation: 'modal',
          gestureEnabled: true,
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="create/index"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      {/* Legacy step routes - deprecated in favor of create/index */}
      <Stack.Screen
        name="create/step-1"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create/step-2"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create/preview"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
