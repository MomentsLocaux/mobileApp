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
            www.moments-locaux.com/fr/privacy. Contact : {LEGAL_CONTACT_EMAIL}.
          </Text>
          <Text style={styles.heading}>1. Données collectées (Alpha)</Text>
          <Text style={styles.text}>
            Compte (e-mail via Supabase Auth), profil, interactions (favoris, likes, commentaires,
            follows), suggestions d’événements et corrections, signalements, bug reports,
            notifications, données techniques d’appareil. Pas de check-in, pas de création
            organisateur, pas de Lumo en Alpha.
          </Text>
          <Text style={styles.heading}>2. Bases légales (art. 6 RGPD)</Text>
          <Text style={styles.text}>
            Compte et service : exécution du contrat (CGU). Localisation : votre consentement via
            les autorisations de l’appareil. Modération et signalements DSA : obligation légale.
            Sécurité, logs techniques et anti-spam : intérêt légitime. Liste de lancement (site) :
            consentement, retirable via la page Désinscription. Formulaire de contact (site) :
            mesures précontractuelles et intérêt légitime — ce n’est pas un consentement marketing.
          </Text>
          <Text style={styles.heading}>3. Utilisation</Text>
          <Text style={styles.text}>
            Fournir la découverte locale, la carte, le social entre pairs, la suggestion depuis
            une affiche, Lumia, la modération et la sécurité, et répondre aux obligations légales
            (dont le DSA).
          </Text>
          <Text style={styles.heading}>4. Conservation</Text>
          <Text style={styles.text}>
            Compte et profil : tant que le compte est actif, puis suppression sur demande. Liste
            de lancement : jusqu’à désinscription. Messages de contact : jusqu’à 12 mois. Bug
            reports et logs techniques : 6 à 12 mois. Exports de compte : 24 heures. Les
            commentaires publics sont anonymisés à la suppression (texte retiré ; l’identifiant
            d’auteur peut être conservé pour la continuité du fil). Export JSON et suppression
            sont disponibles dans Paramètres.
          </Text>
          <Text style={styles.heading}>5. Géolocalisation</Text>
          <Text style={styles.text}>
            Optionnelle, pour la carte et les alertes de proximité (autorisations When In Use et,
            pour les alertes, Always). Pas de check-in en Alpha. Vous pouvez retirer l’accès dans
            les réglages du téléphone.
          </Text>
          <Text style={styles.heading}>6. Médias</Text>
          <Text style={styles.text}>
            Avatars, photos de suggestions / contributions : stockés dans Supabase Storage. Une
            photo d’affiche peut contenir des visages ou des lieux : elle n’est envoyée à l’IA
            qu’après information (voir §8).
          </Text>
          <Text style={styles.heading}>7. Assistant Lumia</Text>
          <Text style={styles.text}>
            Lorsque Lumia est activé, vos questions (et un court historique local) sont transmises
            temporairement à un sous-traitant d’IA (OpenAI) pour produire une réponse d’aide ou de
            recherche de moments déjà publiés. L’historique n’est pas enregistré sur nos serveurs ;
            il reste sur l’appareil et est effacé à la déconnexion complète ou à la suppression du
            compte. Un compteur mensuel d’usage (sans le texte) peut être conservé. L’export de
            compte n’inclut pas l’historique Lumia.
          </Text>
          <Text style={styles.heading}>8. Suggestion depuis une affiche</Text>
          <Text style={styles.text}>
            La photo ou l’image d’affiche est envoyée à une fonction Moments Locaux puis traitée par
            le même type de sous-traitant IA pour préremplir le formulaire. Vous relisez avant envoi
            à la modération. Finalité : préremplir une suggestion, pas entraîner un modèle à partir
            de vos images (sous réserve du contrat sous-traitant en vigueur).
          </Text>
          <Text style={styles.heading}>9. Sous-traitants et transferts</Text>
          <Text style={styles.text}>
            Supabase (Auth, base, stockage), Mapbox (carte), Expo / EAS (builds et notifications),
            OpenAI (processor IA), Apple et Google (distribution), Brevo (e-mails transactionnels
            Auth et contact), Vercel (site). Des transferts hors UE sont possibles, encadrés par
            les DPA et clauses contractuelles types des prestataires.
          </Text>
          <Text style={styles.heading}>10. Âge</Text>
          <Text style={styles.text}>
            Le service n’est pas destiné aux personnes de moins de {LEGAL_MIN_AGE} ans.
          </Text>
          <Text style={styles.heading}>11. Vos droits</Text>
          <Text style={styles.text}>
            Accès, rectification, suppression, portabilité et opposition : depuis l’app
            (export / supprimer le compte) ou {LEGAL_CONTACT_EMAIL}. Liste de lancement : page
            Désinscription du site, aussi simplement que l’inscription.
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
