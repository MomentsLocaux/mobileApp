import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { stackModalOptions, stackPushOptions } from '@/constants/navigation';

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
        ...stackPushOptions,
      }}
    >
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
          ...stackModalOptions,
        }}
      />
      <Stack.Screen
        name="echoes"
        options={{
          headerShown: false,
          ...stackModalOptions,
        }}
      />
      {/* Nested folder app/events/create — declare the group, not create/step-* */}
      <Stack.Screen
        name="create"
        options={{
          headerShown: false,
          ...stackModalOptions,
        }}
      />
      <Stack.Screen
        name="suggest-from-poster/index"
        options={{
          title: 'Depuis une affiche',
          ...stackModalOptions,
        }}
      />
    </Stack>
  );
}
