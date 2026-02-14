import { Stack } from 'expo-router';
import { colors } from '@/components/ui/v2';

export default function EventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontWeight: '700',
          color: colors.textPrimary,
        },
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
        name="create"
        options={{
          title: 'Créer un événement',
          headerBackTitle: 'Annuler',
        }}
      />
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
      <Stack.Screen
        name="ui-preview"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
