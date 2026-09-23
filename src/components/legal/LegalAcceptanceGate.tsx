import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import {
  LEGAL_MIN_AGE,
  LEGAL_POLICY_VERSION,
  LEGAL_SITE_PRIVACY_URL,
  LEGAL_SITE_TERMS_URL,
} from '@/constants/legal';
import { colors, spacing, typography } from '@/constants/theme';
import { AuthService } from '@/services/auth.service';
import { useAuthStore } from '@/state/auth';
import { shouldWriteLegalAcceptance } from '@/utils/legal-acceptance';

/**
 * SCRUM-276 / SCRUM-279 — blocking CGU/privacy gate.
 * Shown for a new OAuth account (no legal_accepted_at) and when the policy version changes.
 * Existing compliant accounts are not prompted.
 */
export function LegalAcceptanceGate() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const onAuthRoute = typeof pathname === 'string' && pathname.startsWith('/auth');
  const visible =
    !onAuthRoute &&
    !!user?.id &&
    !!profile &&
    shouldWriteLegalAcceptance(profile, LEGAL_POLICY_VERSION);

  if (!visible || !user?.id) return null;

  const handleConfirm = async () => {
    if (!accepted) {
      Alert.alert(
        'Consentement requis',
        `Vous devez avoir ${LEGAL_MIN_AGE} ans et accepter les CGU et la politique de confidentialité pour continuer.`,
      );
      return;
    }
    setSaving(true);
    try {
      const ok = await AuthService.recordLegalAcceptance(user.id);
      if (!ok) {
        Alert.alert(
          'Enregistrement impossible',
          'Réessayez dans un instant. Si le problème continue, écrivez à hello@moments-locaux.com.',
        );
        return;
      }
      const next = await AuthService.getProfileForUser(user);
      if (next) setProfile(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>Conditions d’utilisation</Text>
          <Text style={styles.body}>
            Avant de continuer, confirmez que vous avez au moins {LEGAL_MIN_AGE} ans et que vous
            acceptez les documents légaux en vigueur (version {LEGAL_POLICY_VERSION}).
          </Text>

          <TouchableOpacity
            style={styles.consentRow}
            activeOpacity={0.85}
            onPress={() => setAccepted((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted ? <Ionicons name="checkmark" size={14} color={colors.brand.primary} /> : null}
            </View>
            <Text style={styles.consentText}>
              J’ai au moins {LEGAL_MIN_AGE} ans et j’accepte les{' '}
              <Text style={styles.inlineLink} onPress={() => void Linking.openURL(LEGAL_SITE_TERMS_URL)}>
                CGU
              </Text>{' '}
              et la{' '}
              <Text
                style={styles.inlineLink}
                onPress={() => void Linking.openURL(LEGAL_SITE_PRIVACY_URL)}
              >
                politique de confidentialité
              </Text>
              .
            </Text>
          </TouchableOpacity>

          <Button
            title="Continuer"
            onPress={() => void handleConfirm()}
            loading={saving}
            disabled={saving}
            fullWidth
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 51, 41, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.brand.page,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  body: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.brand.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.secondary,
  },
  consentText: {
    flex: 1,
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 20,
  },
  inlineLink: {
    color: colors.brand.secondary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
