import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { colors, spacing, typography } from '@/constants/theme';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_MIN_AGE,
  LEGAL_POLICY_VERSION,
} from '@/constants/legal';

export default function PrivacyPolicyScreen() {
  return (
    <SettingsLayout title="Politique de confidentialité">
      <SettingsSectionCard title="Politique de confidentialité" icon={FileText}>
        <View style={styles.block}>
          <Text style={styles.text}>
            Version {LEGAL_POLICY_VERSION}. Le texte de référence est aussi publié sur
            moments-locaux.com/fr/privacy. Contact : {LEGAL_CONTACT_EMAIL}.
          </Text>
          <Text style={styles.heading}>1. Données collectées (Alpha)</Text>
          <Text style={styles.text}>
            Compte (e-mail via Supabase Auth), profil, interactions (favoris, likes, commentaires,
            follows), suggestions d’événements et corrections, signalements, bug reports,
            notifications, données techniques d’appareil. Pas de check-in, pas de création
            organisateur, pas de Lumo en Alpha.
          </Text>
          <Text style={styles.heading}>2. Utilisation</Text>
          <Text style={styles.text}>
            Fournir la découverte locale, la carte, le social entre pairs, la suggestion depuis
            une affiche, Lumia, la modération et la sécurité, et répondre aux obligations légales
            (dont le DSA).
          </Text>
          <Text style={styles.heading}>3. Conservation</Text>
          <Text style={styles.text}>
            Tant que le compte est actif, ou selon les obligations légales. Export JSON et
            suppression de compte sont disponibles dans Paramètres. Les données privées sont
            supprimées ou anonymisées à la suppression.
          </Text>
          <Text style={styles.heading}>4. Géolocalisation</Text>
          <Text style={styles.text}>
            Optionnelle, pour la carte et les alertes de proximité (autorisations When In Use et,
            pour les alertes, Always). Pas de check-in en Alpha. Vous pouvez retirer l’accès dans
            les réglages du téléphone.
          </Text>
          <Text style={styles.heading}>5. Médias</Text>
          <Text style={styles.text}>
            Avatars, photos de suggestions / contributions : stockés dans Supabase Storage. Une
            photo d’affiche peut contenir des visages ou des lieux : elle n’est envoyée à l’IA
            qu’après information (voir §7).
          </Text>
          <Text style={styles.heading}>6. Assistant Lumia</Text>
          <Text style={styles.text}>
            Lorsque Lumia est activé, vos questions (et un court historique local) sont transmises
            temporairement à un sous-traitant d’IA (OpenAI) pour produire une réponse d’aide ou de
            recherche de moments déjà publiés. L’historique n’est pas enregistré sur nos serveurs ;
            il reste sur l’appareil et est effacé à la déconnexion complète ou à la suppression du
            compte. Un compteur mensuel d’usage (sans le texte) peut être conservé. L’export de
            compte n’inclut pas l’historique Lumia.
          </Text>
          <Text style={styles.heading}>7. Suggestion depuis une affiche</Text>
          <Text style={styles.text}>
            La photo ou l’image d’affiche est envoyée à une fonction Moments Locaux puis traitée par
            le même type de sous-traitant IA pour préremplir le formulaire. Vous relisez avant envoi
            à la modération. Finalité : préremplir une suggestion, pas entraîner un modèle à partir
            de vos images (sous réserve du contrat sous-traitant en vigueur).
          </Text>
          <Text style={styles.heading}>8. Sous-traitants</Text>
          <Text style={styles.text}>
            Supabase (Auth, base, stockage), Mapbox (carte), Expo / EAS (builds et notifications),
            OpenAI (processor IA), Apple et Google (distribution). Des transferts hors UE sont
            possibles.
          </Text>
          <Text style={styles.heading}>9. Âge</Text>
          <Text style={styles.text}>
            Le service n’est pas destiné aux personnes de moins de {LEGAL_MIN_AGE} ans.
          </Text>
          <Text style={styles.heading}>10. Vos droits</Text>
          <Text style={styles.text}>
            Accès, rectification, suppression, portabilité et opposition : depuis l’app
            (export / supprimer le compte) ou {LEGAL_CONTACT_EMAIL}.
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
