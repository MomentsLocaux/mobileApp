import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpenCheck } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { features } from '@/config/features';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_MIN_AGE,
  LEGAL_POLICY_VERSION,
  LEGAL_PUBLISHER_NAME,
} from '@/constants/legal';

const CGU_TEXT = [
  'CONDITIONS GÉNÉRALES D’UTILISATION',
  'Application : Moments Locaux — Alpha',
  `Version : ${LEGAL_POLICY_VERSION}`,
  'Le texte long de référence est aussi publié sur le site (moments-locaux.com/fr/terms).',
  '',
  '1. ÉDITEUR',
  `L’application Moments Locaux est éditée par ${LEGAL_PUBLISHER_NAME}, personne physique.`,
  `Contact support, privacy et signalements : ${LEGAL_CONTACT_EMAIL}`,
  'Aucune société (SAS) ni SIRET n’est déclaré à ce stade.',
  '',
  '2. OBJET (PÉRIMÈTRE ALPHA)',
  'Les présentes CGU définissent l’accès à l’application mobile Moments Locaux.',
  'En Alpha, le service permet de : découvrir des moments locaux sur une carte, créer un profil Particulier, suivre d’autres personnes, commenter, aimer, mettre en favoris, suggérer un événement aperçu (y compris depuis une photo d’affiche), proposer une correction, parler à l’assistant Lumia lorsque le chat est activé, et signaler un contenu.',
  'Moments Locaux n’est pas une billetterie.',
  'Ne sont pas des services actifs en Alpha : la création d’événements en tant qu’organisateur, le check-in / confirmation de présence, Lumo / boutique, Moments Diffuseur et Moments Partenaire. Ces sujets pourront ouvrir plus tard, avec des CGU mises à jour.',
  '',
  '3. ACCEPTATION',
  'La création d’un compte implique l’acceptation des présentes CGU et de la Politique de confidentialité.',
  'En cas de désaccord, l’utilisateur doit s’abstenir d’utiliser le service.',
  '',
  '4. ACCÈS AU SERVICE',
  'Le service Alpha est accessible gratuitement. L’utilisateur est responsable de son matériel, de sa connexion et de la confidentialité de ses identifiants.',
  '',
  '5. CONDITIONS D’ÂGE',
  `Le service est destiné aux utilisateurs âgés d’au moins ${LEGAL_MIN_AGE} ans.`,
  `Les personnes de moins de ${LEGAL_MIN_AGE} ans ne sont pas autorisées à créer un compte.`,
  '',
  '6. COMPTE UTILISATEUR',
  'Un compte est nécessaire pour commenter, aimer, suivre, signaler, suggérer un moment ou parler à Lumia.',
  'L’utilisateur s’engage à fournir des informations exactes et à ne pas usurper l’identité d’un tiers.',
  '',
  '7. SUGGESTIONS ET CONTENUS UTILISATEURS',
  'Suggérer un événement (y compris depuis une affiche) n’en fait pas l’organisateur. La publication reste soumise à vérification.',
  'L’utilisateur reste propriétaire de ses contenus, mais autorise Moments Locaux à les héberger, afficher et diffuser dans le cadre du service.',
  'Sont interdits les contenus illicites, diffamatoires, haineux, trompeurs, dangereux, non autorisés ou portant atteinte aux droits d’autrui (y compris le droit à l’image sur une photo d’affiche).',
  '',
  '8. CONTENUS TIERS ET SOURCES EXTERNES',
  'Une partie des moments affichés provient de sources déjà publiques (agendas ouverts, communes, offices de tourisme, etc.) lorsque la réutilisation est autorisée.',
  'Moments Locaux n’en revendique pas la propriété et agit comme intermédiaire technique de référencement.',
  'L’utilisateur est invité à vérifier les informations essentielles auprès de la source officielle avant de se déplacer.',
  '',
  '9. MODÉRATION',
  'Moments Locaux peut masquer, refuser ou retirer un contenu contraire aux présentes CGU, et limiter ou suspendre un compte en cas d’abus.',
  'La modération est traitée via un outil web distinct, pas depuis un tableau de bord admin dans l’app.',
  '',
  '10. SIGNALEMENT',
  'Tout utilisateur peut signaler un contenu, un événement, un média ou un profil via les outils intégrés.',
  `Un contact dédié aux contenus illicites (DSA) figure dans les mentions légales : ${LEGAL_CONTACT_EMAIL}.`,
  '',
  '11. GÉOLOCALISATION',
  'L’application peut utiliser la géolocalisation pour afficher des moments à proximité et envoyer des alertes de proximité.',
  'Cette fonctionnalité est optionnelle et dépend des autorisations système. Elle ne sert pas à un check-in en Alpha.',
  '',
  '12. DONNÉES PERSONNELLES',
  'Les données personnelles sont traitées conformément à la Politique de confidentialité, y compris les traitements d’IA (Lumia et suggestion depuis une affiche).',
  '',
  '13. DISPONIBILITÉ',
  'Moments Locaux s’efforce d’assurer l’accessibilité du service mais ne garantit pas une disponibilité continue.',
  '',
  '14. RESPONSABILITÉ',
  'Moments Locaux n’est pas responsable des contenus publiés par les utilisateurs ni des informations, annulations ou pratiques des organisateurs ou sources tiers.',
  'L’utilisateur reste responsable de ses choix de participation.',
  '',
  '15. MODIFICATIONS',
  'Les CGU peuvent être mises à jour. Les changements significatifs seront communiqués via l’app ou le site.',
  '',
  '16. DROIT APPLICABLE',
  'Les présentes CGU sont régies par le droit français.',
  '',
  '17. CONTACT',
  `Questions, privacy, signalement de contenu : ${LEGAL_CONTACT_EMAIL}`,
];

const CGU_LUMO_SECTION = [
  '',
  '18. LUMO (NON ACTIF EN ALPHA)',
  'Les fonctionnalités Lumo / gamification ne sont pas déployées en Alpha. Le paragraphe ci-dessous ne s’applique que si elles sont réactivées dans un build ultérieur.',
  'Lorsque ces fonctionnalités sont activées, Moments Locaux peut attribuer une monnaie virtuelle appelée « Lumo », sans valeur monétaire.',
];

const CGU_LUMIA_SECTION = [
  '',
  'ASSISTANT LUMIA',
  'Lorsque l’assistant conversationnel Lumia est activé, l’utilisateur peut poser des questions pour s’orienter dans l’application ou rechercher des moments déjà publiés.',
  'Lumia ne vend pas de billets, n’invente pas d’événements et n’accède pas à la modération admin.',
  'Les messages peuvent être transmis temporairement à un sous-traitant d’IA (OpenAI) pour produire une réponse. L’historique n’est pas stocké sur nos serveurs. Détails : Politique de confidentialité.',
  `Support : ${LEGAL_CONTACT_EMAIL}`,
];

export default function CguScreen() {
  const lines = [
    ...CGU_TEXT,
    ...(GAMIFICATION_ENABLED ? CGU_LUMO_SECTION : []),
    ...(features.lumiaChat ? CGU_LUMIA_SECTION : []),
  ];

  return (
    <SettingsLayout title="CGU">
      <SettingsSectionCard title="Conditions Générales d’Utilisation" icon={BookOpenCheck}>
        <View style={styles.block}>
          {lines.map((line, index) => (
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
