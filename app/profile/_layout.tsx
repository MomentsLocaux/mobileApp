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
        name="edit"
        options={{
          title: 'Modifier le profil',
          headerBackTitle: 'Retour',
        }}
      />
    </Stack>
  );
}
