import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  return (
    <SettingsLayout title="Politique de confidentialité">
      <SettingsSectionCard title="Politique de confidentialité" icon={FileText}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Cette politique explique comment Moments Locaux collecte, utilise et protège vos données. Contact privacy : hello@moments-locaux.com
          </Text>
          <Text style={styles.heading}>1. Données collectées</Text>
          <Text style={styles.text}>
            Nous collectons les informations nécessaires à la création du compte et à l’utilisation du service : email via Supabase Auth, profil, événements publiés, médias, commentaires, favoris, follows, signalements, bug reports, notifications, vues et check-ins. Lorsque Lumia est activé, un compteur d’usage mensuel (sans texte des messages) peut être conservé.
          </Text>
          <Text style={styles.heading}>2. Utilisation</Text>
          <Text style={styles.text}>
            Ces données servent à fournir les fonctionnalités de l’application, personnaliser l’expérience, sécuriser la plateforme, prévenir les abus, traiter les signalements et améliorer la fiabilité du service.
          </Text>
          <Text style={styles.heading}>3. Conservation</Text>
          <Text style={styles.text}>
            Les données sont conservées tant que le compte est actif ou selon les obligations légales applicables. Les données privées sont supprimées ou anonymisées lors d’une suppression de compte.
          </Text>
          <Text style={styles.heading}>4. Géolocalisation</Text>
          <Text style={styles.text}>
            La localisation peut être utilisée pour afficher les événements proches et valider certains check-ins. Elle dépend des autorisations accordées par l’utilisateur.
          </Text>
          <Text style={styles.heading}>5. Médias et stockage</Text>
          <Text style={styles.text}>
            Les avatars, couvertures et photos d’événements peuvent être stockés dans Supabase Storage. Les médias liés à des contenus publics peuvent rester visibles tant que le contenu public est conservé.
          </Text>
          <Text style={styles.heading}>6. Assistant Lumia</Text>
          <Text style={styles.text}>
            Lorsque l’assistant conversationnel Lumia est activé dans le build, vos questions sont
            traitées pour répondre à des demandes d’aide sur l’application ou pour rechercher des
            moments déjà publiés. L’historique du chat n’est pas enregistré sur nos serveurs : il
            reste en mémoire sur votre appareil le temps de la session d’écran. Nous pouvons
            conserver un compteur d’usage (nombre de messages par mois) pour limiter les abus et
            maîtriser les coûts, sans conserver le texte des messages. Pour générer une réponse,
            le contenu de la question peut être transmis temporairement à un prestataire
            d’intelligence artificielle (traitement pour notre compte). Contact privacy /
            support : hello@moments-locaux.com.
          </Text>
          <Text style={styles.heading}>7. Vos droits</Text>
          <Text style={styles.text}>
            Vous pouvez demander l’accès, la rectification ou la suppression de vos données depuis l’application ou en contactant hello@moments-locaux.com. L’export de compte, lorsqu’il est disponible, n’inclut pas d’historique Lumia (non persisté).
          </Text>
        </View>
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  heading: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  text: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
});
