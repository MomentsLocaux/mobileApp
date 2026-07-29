import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { features } from '@/config/features';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { colors } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  /** Allow edit flow when user has can_create but is in discover mode. */
  allowIfCanCreate?: boolean;
};

/**
 * ID-GUARDS — block create deep-links when create surfaces are not allowed.
 */
export function RequireCreateAccess({ children, allowIfCanCreate = false }: Props) {
  const { canCreateNow, canCreate, accountKind } = useAccountIdentity();

  if (!features.eventCreate) {
    return <Redirect href="/(tabs)/map" />;
  }

  if (accountKind === 'professionnel') {
    return <>{children}</>;
  }

  const allowed = canCreateNow || (allowIfCanCreate && canCreate);
  if (!allowed) {
    return <Redirect href={canCreate ? '/(tabs)/profile' : '/(tabs)/map'} />;
  }

  return <>{children}</>;
}

export function RequireCreateAccessLoading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.brand.secondary} />
    </View>
  );
}
