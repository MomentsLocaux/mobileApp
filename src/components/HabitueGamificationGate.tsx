import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { useOfferEntitlements } from '@/hooks/useOfferEntitlements';
import { colors } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  /** Where to send users when gamification flag is off. */
  flagOffHref?: string;
  /** Where to send Local users (no Habitué/Éclaireur). */
  localHref?: string;
};

/**
 * Lumo / boutique / missions / Pass: Habitué+ only (Éclaireur includes Habitué).
 * Local must not access these surfaces even when GAMIFICATION_ENABLED is on.
 */
export function HabitueGamificationGate({
  children,
  flagOffHref = '/(tabs)/map',
  localHref = '/profile/offers',
}: Props) {
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href={flagOffHref as any} />;
  }

  return (
    <HabitueGamificationGateInner localHref={localHref}>{children}</HabitueGamificationGateInner>
  );
}

function HabitueGamificationGateInner({
  children,
  localHref,
}: {
  children: React.ReactNode;
  localHref: string;
}) {
  const { hasHabitue, loading } = useOfferEntitlements();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand.secondary} />
      </View>
    );
  }

  if (!hasHabitue) {
    return <Redirect href={localHref as any} />;
  }

  return <>{children}</>;
}
