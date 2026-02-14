import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpenCheck } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/components/ui/v2';

const CGU_TEXT = [
  'CONDITIONS GENERALES D\'UTILISATION',
  'Application : Moments Locaux',
  'Date de mise a jour : [a completer]',
  '',
  '1. EDITEUR',
  'L\'application Moments Locaux est editee par Moments Locaux,',
  'domicilie a Fontoy.',
  '[Adresse complete / SIREN / contact legal a completer]',
  '',
  '2. OBJET',
  'Les presentes CGU ont pour objet de definir les conditions d\'acces et d\'utilisation',
  'de l\'application Moments Locaux (mobile et web), permettant notamment :',
  '- la consultation d\'evenements locaux,',
  '- la publication d\'evenements,',
  '- l\'interaction communautaire (commentaires, likes, signalements).',
  '',
  '3. ACCEPTATION',
  'L\'acces et l\'utilisation de l\'application impliquent l\'acceptation pleine et entiere',
  'des presentes CGU. En cas de desaccord, l\'utilisateur doit s\'abstenir d\'utiliser le service.',
  '',
  '4. ACCES AU SERVICE',
  'Le service est accessible gratuitement. Certaines fonctionnalites peuvent etre',
  'proposees via des achats integres (monnaie virtuelle, options premium, boosts).',
  'L\'utilisateur est seul responsable de son materiel et de sa connexion internet.',
  '',
  '5. CONDITIONS D\'AGE',
  'Le service est destine aux utilisateurs ages d\'au moins 13 ans.',
  'Les mineurs doivent disposer de l\'autorisation d\'un representant legal.',
  '',
  '6. COMPTE UTILISATEUR',
  'La creation d\'un compte est necessaire pour publier, commenter ou interagir.',
  'L\'utilisateur s\'engage a fournir des informations exactes et a les maintenir a jour.',
  '',
  '7. CONTENUS UTILISATEURS',
  'L\'utilisateur reste proprietaire de ses contenus, mais concede a Moments Locaux',
  'une licence non exclusive, gratuite et mondiale pour heberger, afficher et diffuser',
  'ces contenus dans le cadre du service.',
  '',
  'L\'utilisateur s\'interdit notamment de publier :',
  '- contenus illicites, diffamatoires ou haineux,',
  '- contenus promotionnels non autorises,',
  '- contenus portant atteinte aux droits d\'autrui.',
  '',
  '8. MODERATION',
  'Moments Locaux se reserve le droit de moderer tout contenu ne respectant pas',
  'les regles de la plateforme, et d\'appliquer des sanctions :',
  '- suppression de contenu,',
  '- avertissement,',
  '- suspension temporaire,',
  '- bannissement definitif.',
  '',
  '9. SIGNALEMENT',
  'Tout utilisateur peut signaler un contenu ou un profil via les outils integres.',
  'Les signalements sont analyses par la moderation.',
  '',
  '10. GEOLOCALISATION',
  'L\'application peut utiliser la geolocalisation afin d\'afficher des evenements a proximite.',
  'Cette fonctionnalite est optionnelle et parametrable par l\'utilisateur.',
  '',
  '11. DONNEES PERSONNELLES',
  'Les donnees personnelles sont traitees conformement a la Politique de confidentialite.',
  'L\'utilisateur dispose de droits d\'acces, de rectification et de suppression.',
  '',
  '12. DISPONIBILITE DU SERVICE',
  'Moments Locaux s\'efforce d\'assurer l\'accessibilite du service mais ne garantit pas',
  'une disponibilite continue. Des interruptions temporaires peuvent survenir.',
  '',
  '13. RESPONSABILITE',
  'Moments Locaux ne saurait etre tenu responsable des contenus publies par les utilisateurs,',
  'ni des dommages indirects lies a l\'utilisation du service.',
  '',
  '14. MODIFICATIONS DES CGU',
  'Moments Locaux peut modifier les presentes CGU a tout moment.',
  'L\'utilisateur sera informe des mises a jour significatives.',
  '',
  '15. DROIT APPLICABLE',
  'Les presentes CGU sont regies par le droit francais.',
  'Tout litige releve de la competence des tribunaux francais.',
  '',
  '16. CONTACT',
  'Pour toute question : [contact@momentslocaux.app] (a confirmer)',
];

export default function CguScreen() {
  return (
    <SettingsLayout title="CGU">
      <SettingsSectionCard title="Conditions Generales d'Utilisation" icon={BookOpenCheck}>
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
    color: colors.textSecondary,
    lineHeight: 20,
  },
  heading: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  spacer: {
    height: spacing.sm,
  },
});
