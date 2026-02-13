import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.neutral[0],
        },
        headerTintColor: colors.neutral[900],
        headerTitleStyle: {
          fontWeight: '600',
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
