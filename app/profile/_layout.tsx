import { Stack } from 'expo-router';
import { colors } from '@/components/ui/v2';

export default function ProfileLayout() {
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
        name="offers"
        options={{
          title: 'Offres & abonnements',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          title: 'Modifier le profil',
          headerBackTitle: 'Retour',
        }}
      />
      <Stack.Screen
        name="my-events"
        options={{
          title: 'Mes évènements',
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
      <Stack.Screen
        name="journey"
        options={{
          title: 'Mon parcours',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
