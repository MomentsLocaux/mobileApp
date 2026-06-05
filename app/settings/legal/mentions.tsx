import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Info } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

const LEGAL_TEXT = [
  'MENTIONS LÉGALES',
  'Date de mise à jour : 4 juin 2026.',
  '',
  '1. ÉDITEUR',
  'L’application Moments Locaux est éditée par l’équipe Moments Locaux.',
  '- Nom du service : Moments Locaux',
  '- Zone principale d’activité : France',
  '- Email support et privacy : contact@momentslocaux.app',
  '',
  '2. DIRECTEUR DE LA PUBLICATION',
  'Direction de la publication : équipe Moments Locaux.',
  '',
  '3. HEBERGEUR',
  '- Nom : Supabase (Supabase Inc.)',
  '- Adresse : 970 Toa Payoh North, #07-04, Singapore 318992',
  '- Site : https://supabase.com',
  '',
  '4. PROPRIÉTÉ INTELLECTUELLE',
  'Les contenus, marques, logos, textes, visuels et éléments d’interface de l’application sont protégés par le droit de la propriété intellectuelle.',
  'Les contenus publiés par les utilisateurs restent sous leur responsabilité.',
  '',
  '5. DONNÉES PERSONNELLES',
  'Les données personnelles sont traitées conformément à la Politique de confidentialité.',
  'L’utilisateur peut exercer ses droits d’accès, rectification et suppression en contactant : contact@momentslocaux.app',
  '',
  '6. RESPONSABILITÉ',
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
