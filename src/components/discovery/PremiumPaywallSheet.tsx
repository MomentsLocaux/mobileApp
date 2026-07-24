import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Crown, Sparkles, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { PREMIUM_PLANS } from '@/services/subscription.service';
import { ActivityLogService } from '@/services/activity-log.service';

export type PremiumPaywallSource = 'my_radius' | 'right_now' | 'discovery_home' | 'subscription';

type Props = {
  visible: boolean;
  source?: PremiumPaywallSource;
  onClose: () => void;
};

const SOURCE_COPY: Record<PremiumPaywallSource, string> = {
  my_radius: 'Débloquez la carte de votre zone et des suggestions plus adaptées à vos sorties.',
  right_now: 'Recevez des idées de moments à rejoindre tout de suite, près de vous.',
  discovery_home: 'Passez Éclaireur pour découvrir autrement — Habitué inclus.',
  subscription: 'Passez Éclaireur pour la profondeur Discovery (Habitué inclus).',
};

export function PremiumPaywallSheet({ visible, source = 'discovery_home', onClose }: Props) {
  React.useEffect(() => {
    if (!visible) return;
    ActivityLogService.log('premium_paywall_view', { source }).catch(() => undefined);
  }, [visible, source]);

  const handlePurchase = (plan: 'monthly' | 'annual') => {
    Toast.show({
      type: 'info',
      text1: 'Achats in-app bientôt disponibles',
      text2: `Offre ${PREMIUM_PLANS[plan].label} — intégration App Store / Play Store en cours.`,
    });
  };

  const handleRestore = () => {
    Toast.show({
      type: 'info',
      text1: 'Restauration des achats',
      text2: 'Cette option sera disponible avec l’intégration des stores.',
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Fermer">
            <X size={20} color={colors.brand.textSecondary} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Crown size={24} color={colors.brand.secondary} />
          </View>
          <Text style={styles.title}>Éclaireur</Text>
          <Text style={styles.subtitle}>{SOURCE_COPY[source]}</Text>

          <View style={styles.benefits}>
            <Benefit text="Idées de moments à rejoindre tout de suite" />
            <Benefit text="Carte de votre zone (où vous sortez)" />
            <Benefit text="Recommandations calées sur vos sorties" />
            <Benefit text="Idées hors habitudes + bilans de découverte" />
            <Benefit text="Inclut Habitué (check-in, Lumo, Pass…)" />
          </View>

          <View style={styles.plans}>
            <PlanCard
              title={PREMIUM_PLANS.monthly.label}
              price={PREMIUM_PLANS.monthly.priceLabel}
              period={PREMIUM_PLANS.monthly.periodLabel}
              onPress={() => handlePurchase('monthly')}
            />
            <PlanCard
              title={PREMIUM_PLANS.annual.label}
              price={PREMIUM_PLANS.annual.priceLabel}
              period={PREMIUM_PLANS.annual.periodLabel}
              highlighted
              onPress={() => handlePurchase('annual')}
            />
          </View>

          <Button title="Continuer gratuitement" variant="outline" onPress={onClose} fullWidth />
          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreText}>Restaurer mes achats</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <Sparkles size={14} color={colors.brand.secondary} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function PlanCard({
  title,
  price,
  period,
  highlighted,
  onPress,
}: {
  title: string;
  price: string;
  period: string;
  highlighted?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.planCard, highlighted && styles.planCardHighlighted]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planPrice}>
        {price}
        <Text style={styles.planPeriod}>{period}</Text>
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.brand.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.xs,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(43, 191, 227, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
  benefits: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    flex: 1,
  },
  plans: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  planCardHighlighted: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(43, 191, 227, 0.08)',
  },
  planTitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginBottom: spacing.xs,
  },
  planPrice: {
    ...typography.h3,
    color: colors.brand.text,
  },
  planPeriod: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  restoreText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    textDecorationLine: 'underline',
  },
});
