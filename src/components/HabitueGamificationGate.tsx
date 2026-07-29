import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { features } from '@/config/features';
import { useOfferEntitlements } from '@/hooks/useOfferEntitlements';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
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
 * Professionnel accounts never access Boutique Lumo (ADR_007 / ID-GUARDS).
 * When FEATURE_OFFERS is off, Local users bounce to map (never /profile/offers).
 */
export function HabitueGamificationGate({
  children,
  flagOffHref = '/(tabs)/map',
  localHref,
}: Props) {
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href={flagOffHref as any} />;
  }

  const resolvedLocalHref =
    localHref ?? (features.offers ? '/profile/offers' : '/(tabs)/map');

  return (
    <HabitueGamificationGateInner localHref={resolvedLocalHref}>{children}</HabitueGamificationGateInner>
  );
}

function HabitueGamificationGateInner({
  children,
  localHref,
}: {
  children: React.ReactNode;
  localHref: string;
}) {
  const { accountKind } = useAccountIdentity();
  const { hasHabitue, loading } = useOfferEntitlements();

  if (accountKind === 'professionnel') {
    return <Redirect href={'/(tabs)' as any} />;
  }

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
