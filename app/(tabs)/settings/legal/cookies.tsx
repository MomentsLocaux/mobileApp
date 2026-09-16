import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Cookie } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import { LEGAL_CONTACT_EMAIL, LEGAL_POLICY_VERSION } from '@/constants/legal';

const COOKIES_TEXT = [
  'COOKIES ET TRACEURS',
  `Version : ${LEGAL_POLICY_VERSION}`,
  '',
  'L’application mobile Moments Locaux n’utilise pas de cookies publicitaires, de traceurs publicitaires ni de bandeau de consentement de type site web.',
  '',
  'La session est conservée sur l’appareil (jetons d’authentification, préférences locales). Ces données techniques sont nécessaires au fonctionnement du compte, pas à de la publicité ciblée.',
  '',
  'La cartographie (Mapbox) et les notifications (Expo) peuvent envoyer des identifiants techniques à ces prestataires pour fournir la carte et les alertes. Ils ne servent pas à vous profiler à des fins publicitaires.',
  '',
  'Le site marketing (moments-locaux.com) peut déposer des cookies strictement nécessaires au fonctionnement des pages. Il n’y a pas de bandeau publicitaire à ce jour.',
  '',
  `Contact : ${LEGAL_CONTACT_EMAIL}`,
];

export default function CookiesPolicyScreen() {
  return (
    <SettingsLayout title="Cookies et traceurs">
      <SettingsSectionCard title="Cookies et traceurs" icon={Cookie}>
        <View style={styles.block}>
          {COOKIES_TEXT.map((line, index) => (
            <Text
              key={`${line}-${index}`}
              style={line === '' ? styles.spacer : styles.text}
            >
              {line}
            </Text>
          ))}
        </View>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingTop: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  spacer: {
    height: spacing.sm,
  },
});
