import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function ProfileLayout() {
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
        name="edit"
        options={{
          title: 'Modifier le profil',
          headerBackTitle: 'Retour',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="my-suggestions"
        options={{
          title: 'Mes suggestions',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="my-events"
        options={{
          title: 'Mes événements',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="invite"
        options={{
          title: 'Inviter des amis',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
