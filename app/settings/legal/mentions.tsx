import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Info } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DSA_EMAIL,
  LEGAL_POLICY_VERSION,
  LEGAL_PUBLISHER_CAPACITY,
  LEGAL_PUBLISHER_NAME,
} from '@/constants/legal';

const LEGAL_TEXT = [
  'MENTIONS LÉGALES',
  `Version : ${LEGAL_POLICY_VERSION}`,
  '',
  '1. ÉDITEUR',
  `Le service Moments Locaux est édité par ${LEGAL_PUBLISHER_NAME}, ${LEGAL_PUBLISHER_CAPACITY}.`,
  '- Nom du service : Moments Locaux',
  '- Zone principale d’activité : France',
  `- Email support et privacy : ${LEGAL_CONTACT_EMAIL}`,
  'Aucune société (SAS) ni SIRET n’est déclaré à ce stade Alpha.',
  '',
  '2. DIRECTEUR DE LA PUBLICATION',
  `Direction de la publication : ${LEGAL_PUBLISHER_NAME}.`,
  '',
  '3. HÉBERGEURS',
  '- Application et données : Supabase (Supabase Inc.), https://supabase.com',
  '- Distribution des builds : Expo / EAS (Expo Application Services)',
  '',
  '4. CONTACT DSA (contenus illicites)',
  'Pour signaler un contenu illicite au sens du règlement (UE) 2022/2065 (DSA), au-delà du bouton de signalement in-app :',
  `- Email : ${LEGAL_DSA_EMAIL} (objet : « Signalement DSA »)`,
  '- Merci d’indiquer l’URL ou l’identifiant du contenu, une description, et pourquoi il serait illicite.',
  '- Nous accusons réception et traitons le signalement dans les meilleurs délais, en général sous 7 jours.',
  '',
  '5. PROPRIÉTÉ INTELLECTUELLE',
  'Les contenus, marques, logos, textes, visuels et éléments d’interface de l’application sont protégés par le droit de la propriété intellectuelle.',
  'Les contenus publiés par les utilisateurs restent sous leur responsabilité.',
  '',
  '6. DONNÉES PERSONNELLES',
  'Les données personnelles sont traitées conformément à la Politique de confidentialité.',
  `Droits d’accès, rectification et suppression : ${LEGAL_CONTACT_EMAIL} ou les écrans Paramètres → Confidentialité.`,
  '',
  '7. RESPONSABILITÉ',
  'L’éditeur met en œuvre des moyens raisonnables pour assurer la disponibilité du service, sans garantir l’absence d’interruption ou d’erreur.',
];

export default function LegalMentionsScreen() {
  return (
    <SettingsLayout title="Mentions légales">
      <SettingsSectionCard title="Mentions légales" icon={Info}>
        <View style={styles.block}>
          {LEGAL_TEXT.map((line, index) => (
            <Text
              key={`${line}-${index}`}
              style={line.match(/^\d+\./) ? styles.heading : line === '' ? styles.spacer : styles.text}
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
  heading: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  spacer: {
    height: spacing.sm,
  },
});
