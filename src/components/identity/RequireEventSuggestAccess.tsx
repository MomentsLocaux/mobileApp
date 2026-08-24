import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { features } from '@/config/features';
import { useAuth } from '@/hooks';
import { colors } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
};

/** Gate poster capture flow: flag + authenticated user. */
export function RequireEventSuggestAccess({ children }: Props) {
  const { user, isLoading } = useAuth();

  if (!features.eventSuggest) {
    return <Redirect href="/(tabs)/map" />;
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand.secondary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  return <>{children}</>;
}
