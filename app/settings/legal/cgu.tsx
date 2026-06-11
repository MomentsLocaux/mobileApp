import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpenCheck } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

const CGU_TEXT = [
  'CONDITIONS GÉNÉRALES D’UTILISATION',
  'Application : Moments Locaux',
  'Date de mise à jour : 11 juin 2026',
  '',
  '1. ÉDITEUR',
  'L’application Moments Locaux est éditée par l’équipe Moments Locaux.',
  'Contact support et privacy : contact@momentslocaux.app',
  '',
  '2. OBJET',
  'Les présentes CGU définissent les conditions d’accès et d’utilisation de l’application mobile Moments Locaux.',
  'Le service permet notamment de consulter des événements locaux, créer un profil, publier des événements, interagir avec la communauté et signaler des contenus.',
  'Moments Locaux agit comme plateforme de découverte et d’agrégation : une partie des événements affichés provient de sources tierces (offices de tourisme, plateformes de données ouvertes, partenaires ou flux publics), complétée par les contenus publiés par les utilisateurs.',
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
  'L’utilisateur s’interdit de publier des contenus illicites, diffamatoires, haineux, trompeurs, dangereux, non autorisés ou portant atteinte aux droits d’autrui.',
  'L’utilisateur garantit disposer des droits nécessaires sur les contenus qu’il publie, y compris textes, visuels et informations d’événements.',
  '',
  '8. CONTENUS TIERS ET SOURCES EXTERNES',
  'Certains événements, textes, visuels, horaires, tarifs ou coordonnées sont fournis par des tiers (organisateurs, offices de tourisme, bases de données ouvertes, partenaires, etc.).',
  'Ces contenus demeurent sous la responsabilité de leurs éditeurs respectifs. Moments Locaux ne revendique pas la propriété de ces contenus tiers et agit en qualité d’intermédiaire technique de référencement et de mise en relation.',
  'Lorsque cela est possible, Moments Locaux affiche l’origine de l’événement et un lien vers la fiche ou le site source officiel. L’utilisateur est invité à consulter cette source pour vérifier les informations avant de se déplacer, de réserver ou d’effectuer un paiement.',
  'Les contenus tiers peuvent être protégés par le droit d’auteur, le droit des bases de données ou des conditions d’utilisation propres à leur source. Moments Locaux ne présente dans l’application que les éléments nécessaires à la découverte de l’événement, dans le cadre du service.',
  'Moments Locaux ne garantit ni l’exhaustivité, ni l’exactitude, ni l’actualisation permanente des contenus tiers. Un événement peut être modifié, reporté, complet ou annulé par l’organisateur sans mise à jour immédiate dans l’application.',
  'Moments Locaux peut corriger, masquer, refuser ou retirer un contenu tiers notamment en cas de signalement, de demande d’un titulaire de droits, d’évolution des licences, de fin d’autorisation de réutilisation ou de risque juridique.',
  'L’utilisateur s’interdit d’extraire, copier ou réutiliser massivement les contenus de l’application ou de ses sources tierces à des fins commerciales ou concurrentielles sans autorisation des titulaires de droits concernés.',
  '',
  '9. MODERATION',
  'Moments Locaux peut modérer, masquer, refuser ou supprimer tout contenu contraire aux présentes CGU, et peut limiter ou suspendre un compte en cas d’abus.',
  'La modération s’applique aux contenus publiés par les utilisateurs comme aux contenus référencés depuis des sources externes.',
  '',
  '10. SIGNALEMENT',
  'Tout utilisateur peut signaler un contenu, un événement, un média ou un profil via les outils intégrés.',
  'Les signalements sont analysés par la modération.',
  '',
  '11. GEOLOCALISATION',
  'L’application peut utiliser la géolocalisation afin d’afficher des événements à proximité ou de vérifier un check-in.',
  'Cette fonctionnalité est optionnelle et dépend des autorisations données par l’utilisateur.',
  '',
  '12. DONNEES PERSONNELLES',
  'Les données personnelles sont traitées conformément à la Politique de confidentialité.',
  'L’utilisateur dispose de droits d’accès, de rectification et de suppression.',
  'Les coordonnées personnelles de contact d’organisateurs tiers, lorsqu’elles apparaissent, relèvent de leurs propres responsabilités de publication ; Moments Locaux limite leur collecte et leur réutilisation au strict nécessaire au fonctionnement du service.',
  '',
  '13. DISPONIBILITE DU SERVICE',
  'Moments Locaux s’efforce d’assurer l’accessibilité du service mais ne garantit pas une disponibilité continue.',
  'L’accès à certaines informations peut dépendre de la disponibilité technique de sources externes.',
  '',
  '14. RESPONSABILITE',
  'Moments Locaux ne saurait être tenu responsable des contenus publiés par les utilisateurs.',
  'Moments Locaux ne saurait être tenu responsable des contenus, informations, annulations, tarifs ou pratiques des organisateurs ou éditeurs tiers, ni des dommages indirects liés à l’utilisation du service.',
  'Chaque organisateur demeure seul responsable de son événement, de sa sécurité, de sa conformité réglementaire et des informations qu’il publie ou autorise à publier.',
  'L’utilisateur demeure seul responsable de ses choix de participation à un événement et est invité à vérifier les informations essentielles auprès de la source officielle.',
  '',
  '15. MODIFICATIONS DES CGU',
  'Moments Locaux peut modifier les présentes CGU. Les utilisateurs seront informés des mises à jour significatives.',
  '',
  '16. DROIT APPLICABLE',
  'Les présentes CGU sont régies par le droit français.',
  '',
  '17. CONTACT',
  'Pour toute question, signalement de contenu tiers ou demande relative aux droits : contact@momentslocaux.app',
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
