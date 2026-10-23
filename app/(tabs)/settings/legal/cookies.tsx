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
  'La version gratuite de l’application peut afficher des cartes publicitaires servies par Google (AdMob). Ces cartes sont distinctes des événements : elles portent le mot Publicité et le nom de l’annonceur.',
  '',
  'Si vous acceptez, les cartes peuvent être personnalisées. Vous pouvez ouvrir « Gérer les options » pour garder les cartes et retirer la personnalisation, ou retirer seulement la position.',
  '',
  'La position qui sert à trouver des sorties peut aussi servir à choisir l’annonce, seulement si vous acceptez ce point dans le formulaire, en plus de l’autorisation du téléphone.',
  '',
  'Sur iPhone, après un oui aux cartes personnalisées, le téléphone peut afficher la fenêtre « Autoriser le suivi ». Si vous la refusez, les cartes restent, sans identifiant publicitaire.',
  '',
  'Avant la première carte, un formulaire de consentement est proposé. Le refus limite les usages de vos données ; des annonces compatibles avec ce choix peuvent encore être affichées. Vous pouvez revoir ce choix dans Réglages, rubrique Publicités.',
  '',
  'Un abonnement Habitué ou Éclaireur actif retire les cartes. Sans abonnement actif, le compte reste sur la version gratuite. L’achat de cet abonnement n’est pas proposé dans l’application tant que l’offre n’est pas ouverte.',
  '',
  'La session est conservée sur l’appareil (jetons d’authentification, préférences locales). Ces données techniques sont nécessaires au fonctionnement du compte. Elles ne servent pas à choisir l’annonce.',
  '',
  'La cartographie (Mapbox) et les notifications (Expo) peuvent envoyer des identifiants techniques à ces prestataires pour fournir la carte et les alertes. Ils ne servent pas à choisir les annonces.',
  '',
  'Le site marketing (www.moments-locaux.com) peut déposer des cookies strictement nécessaires et, uniquement si vous l’acceptez via le bandeau, une mesure d’audience Vercel. Le site ne dépose pas de cookies publicitaires. Les cartes publicitaires concernent l’application.',
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
