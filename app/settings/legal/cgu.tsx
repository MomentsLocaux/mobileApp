import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpenCheck } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

const CGU_TEXT = [
  'CONDITIONS GÉNÉRALES D’UTILISATION',
  'Application : Moments Locaux',
  'Date de mise à jour : 4 juin 2026',
  '',
  '1. ÉDITEUR',
  'L’application Moments Locaux est éditée par l’équipe Moments Locaux.',
  'Contact support et privacy : contact@momentslocaux.app',
  '',
  '2. OBJET',
  'Les présentes CGU définissent les conditions d’accès et d’utilisation de l’application mobile Moments Locaux.',
  'Le service permet notamment de consulter des événements locaux, créer un profil, publier des événements, interagir avec la communauté et signaler des contenus.',
  '',
  '3. ACCEPTATION',
  'La création d’un compte et l’utilisation du service impliquent l’acceptation des présentes CGU.',
  'En cas de désaccord, l’utilisateur doit s’abstenir d’utiliser le service.',
  '',
  '4. ACCES AU SERVICE',
  'Le service MVP est accessible gratuitement. L’utilisateur est responsable de son matériel, de sa connexion internet et de la confidentialité de ses identifiants.',
  '',
  '5. CONDITIONS D\'AGE',
  'Le service est destiné aux utilisateurs âgés d’au moins 13 ans.',
  'Les mineurs doivent disposer de l’autorisation d’un représentant légal.',
  '',
  '6. COMPTE UTILISATEUR',
  'La création d’un compte est nécessaire pour publier, commenter, aimer, suivre ou signaler.',
  'L’utilisateur s’engage à fournir des informations exactes et à ne pas usurper l’identité d’un tiers.',
  '',
  '7. CONTENUS UTILISATEURS',
  'L’utilisateur reste propriétaire de ses contenus, mais autorise Moments Locaux à les héberger, afficher et diffuser dans le cadre du service.',
  '',
  'L’utilisateur s’interdit de publier des contenus illicites, diffamatoires, haineux, trompeurs, dangereux, non autorisés ou portant atteinte aux droits d’autrui.',
  '',
  '8. MODERATION',
  'Moments Locaux peut modérer, masquer, refuser ou supprimer tout contenu contraire aux présentes CGU, et peut limiter ou suspendre un compte en cas d’abus.',
  '',
  '9. SIGNALEMENT',
  'Tout utilisateur peut signaler un contenu, un événement, un média ou un profil via les outils intégrés.',
  'Les signalements sont analysés par la modération.',
  '',
  '10. GEOLOCALISATION',
  'L’application peut utiliser la géolocalisation afin d’afficher des événements à proximité ou de vérifier un check-in.',
  'Cette fonctionnalité est optionnelle et dépend des autorisations données par l’utilisateur.',
  '',
  '11. DONNEES PERSONNELLES',
  'Les données personnelles sont traitées conformément à la Politique de confidentialité.',
  'L’utilisateur dispose de droits d’accès, de rectification et de suppression.',
  '',
  '12. DISPONIBILITE DU SERVICE',
  'Moments Locaux s’efforce d’assurer l’accessibilité du service mais ne garantit pas une disponibilité continue.',
  '',
  '13. RESPONSABILITE',
  'Moments Locaux ne saurait être tenu responsable des contenus publiés par les utilisateurs ni des dommages indirects liés à l’utilisation du service.',
  '',
  '14. MODIFICATIONS DES CGU',
  'Moments Locaux peut modifier les présentes CGU. Les utilisateurs seront informés des mises à jour significatives.',
  '',
  '15. DROIT APPLICABLE',
  'Les présentes CGU sont régies par le droit français.',
  '',
  '16. CONTACT',
  'Pour toute question : contact@momentslocaux.app',
];

export default function CguScreen() {
  return (
    <SettingsLayout title="CGU">
      <SettingsSectionCard title="Conditions Générales d’Utilisation" icon={BookOpenCheck}>
        <View style={styles.block}>
          {CGU_TEXT.map((line, index) => (
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
