import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield, Sparkles, SlidersHorizontal } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { AppBackground, Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useDiscoveryConsent } from '@/hooks/useDiscoveryConsent';

const STEPS = [
  {
    title: 'Des découvertes qui vous ressemblent',
    body:
      'Discovery propose des événements accessibles près de vous, en tenant compte de vos centres d’intérêt et de vos habitudes.',
    icon: Sparkles,
  },
  {
    title: 'Vous gardez le contrôle',
    body:
      'Vous choisissez d’activer la personnalisation. Vos données Discovery restent séparées de votre profil public. Vous pouvez révoquer ou supprimer vos données à tout moment.',
    icon: SlidersHorizontal,
  },
  {
    title: 'Prêt à commencer ?',
    body:
      'Nous utilisons votre position actuelle lorsque vous ouvrez Discovery. La collecte en arrière-plan sera proposée séparément, plus tard.',
    icon: Shield,
  },
] as const;

export default function DiscoveryOnboardingScreen() {
  const router = useRouter();
  const { activate } = useDiscoveryConsent();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleNext = async () => {
    if (!isLast) {
      setStep((value) => value + 1);
      return;
    }

    setSubmitting(true);
    try {
      await activate();
      Toast.show({ type: 'success', text1: 'Discovery activé' });
      router.replace('/discovery' as any);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Activation impossible',
        text2: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppBackground />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (step > 0 ? setStep(step - 1) : router.back())}
        >
          <ChevronLeft size={22} color={colors.brand.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discovery</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Icon size={28} color={colors.brand.secondary} />
        </View>
        <Text style={styles.stepLabel}>
          Étape {step + 1} / {STEPS.length}
        </Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>

        {isLast && (
          <TouchableOpacity onPress={() => router.push('/settings/privacy/policy' as any)}>
            <Text style={styles.policyLink}>Consulter la politique de confidentialité</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isLast ? 'Activer Discovery' : 'Continuer'}
          onPress={handleNext}
          loading={submitting}
          fullWidth
        />
        {!isLast && (
          <TouchableOpacity onPress={() => router.back()} style={styles.skipButton}>
            <Text style={styles.skipText}>Plus tard</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.brand.text,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(43, 191, 227, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.brand.secondary,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 24,
  },
  policyLink: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    marginTop: spacing.lg,
    textDecorationLine: 'underline',
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
});
