import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { useI18n } from '@/contexts/I18nProvider';
import { t } from '@/i18n/translations';

export default function ProfileLayout() {
  const { locale } = useI18n();
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
          title: t('profile', 'editProfile', locale),
          headerBackTitle: t('common', 'back', locale),
        }}
      />
    </Stack>
  );
}
