import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Info } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

const LEGAL_TEXT = [
  'MENTIONS LEGALES',
  '',
  '1. EDITEUR',
  'L\'application Moments Locaux est editee par :',
  '- Raison sociale : Moments Locaux [a completer]',
  '- Forme juridique : [a completer]',
  '- Capital social : [a completer]',
  '- SIREN / RCS : [a completer]',
  '- Adresse du siege : Fontoy [adresse complete a completer]',
  '- Email : [contact@momentslocaux.app]',
  '',
  '2. DIRECTEUR DE LA PUBLICATION',
  '[Nom, prenom a completer]',
  '',
  '3. HEBERGEUR',
  '- Nom : Supabase (Supabase Inc.)',
  '- Adresse : 970 Toa Payoh North, #07-04, Singapore 318992',
  '- Site : https://supabase.com',
  '',
  '4. PROPRIETE INTELLECTUELLE',
  'L\'ensemble des contenus (textes, visuels, logos, marque, structure) presentes sur l\'application',
  'Moments Locaux sont proteges par le droit de la propriete intellectuelle et demeurent la',
  'propriete exclusive de l\'editeur, sauf mention contraire.',
  '',
  '5. DONNEES PERSONNELLES',
  'Les donnees personnelles sont traitees conformement a la Politique de confidentialite.',
  'L\'utilisateur peut exercer ses droits (acces, rectification, suppression) en contactant :',
  '[contact@momentslocaux.app]',
  '',
  '6. RESPONSABILITE',
  'L\'editeur met en oeuvre tous les moyens raisonnables pour assurer l\'exactitude des informations',
  'et la disponibilite du service, mais ne saurait etre tenu responsable d\'eventuelles interruptions',
  'ou erreurs.',
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
    color: colors.neutral[600],
    lineHeight: 20,
  },
  heading: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  spacer: {
    height: spacing.sm,
  },
});
