import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function EventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.brand.page,
        },
        headerTintColor: colors.brand.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.brand.page },
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
      {/* Nested folder app/events/create — declare the group, not create/step-* */}
      <Stack.Screen
        name="create"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
