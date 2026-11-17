import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { BrandIcon } from '@/components/ui/BrandIcon';
import type { BrandIconName } from '@/constants/brand-icon-artwork';
import { colors, spacing, typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

type PromiseItem = {
  id: string;
  icon: BrandIconName;
  title: string;
  summary: string;
  features: string[];
};

/** Same nine promises as moments-locaux.com/fr/accueil, in the app's voice. */
const PROMISES: PromiseItem[] = [
  {
    id: 'map',
    icon: 'map',
    title: 'Voir autour de toi',
    summary: 'Repère d’un coup d’œil ce qui est accessible là où tu es.',
    features: [
      'La carte montre les moments de la zone.',
      'La recherche et les filtres précisent.',
      'Un pin ouvre l’aperçu puis la fiche.',
    ],
  },
  {
    id: 'ideas',
    icon: 'sparkles',
    title: 'Trouver une idée',
    summary: 'Dis ce qui te ferait plaisir. L’app te propose des sorties.',
    features: [
      'Tu indiques le type de moments le départ la distance et la période.',
      'À droite tu aimes. À gauche tu passes.',
      'En fin de série tu relances ou tu ajustes.',
    ],
  },
  {
    id: 'agenda',
    icon: 'heart',
    title: 'Garder pour plus tard',
    summary: 'Un cœur et le moment rejoint ton agenda.',
    features: [
      'Tu touches le cœur.',
      'Le moment arrive dans ton agenda au bon jour.',
      'Tes suivis voient qu’il te plaît.',
    ],
  },
  {
    id: 'peers',
    icon: 'users',
    title: 'Voir ce qui tente tes proches',
    summary: 'Une sortie donne plus envie quand quelqu’un que tu connais l’a repérée.',
    features: [
      'Tu suis des personnes.',
      'Tu vois « Aimé par tes suivis ».',
      'Tu partages un lien d’invitation.',
    ],
  },
  {
    id: 'echoes',
    icon: 'pen',
    title: 'Sentir l’ambiance',
    summary: 'Des impressions et des photos pour savoir à quoi t’attendre.',
    features: [
      'Tu lis les échos d’un moment.',
      'Tu laisses un commentaire ou une photo.',
      'Tu signales si quelque chose dépasse.',
    ],
  },
  {
    id: 'alerts',
    icon: 'bell',
    title: 'Ne rien rater dans le coin',
    summary: 'Tu règles le rayon les thèmes et le rythme. L’app t’alerte sans t’envahir.',
    features: [
      'Tu actives la localisation si tu veux.',
      'Tu choisis le rayon les thèmes et les heures calmes.',
      'Tu reçois une alerte quand un moment correspond.',
    ],
  },
  {
    id: 'safety',
    icon: 'flag',
    title: 'Participer en confiance',
    summary: 'Un souci ? Tu peux le signaler.',
    features: [
      'Signaler un événement.',
      'Signaler un profil.',
      'Signaler un commentaire.',
    ],
  },
  {
    id: 'lumia',
    icon: 'bulb',
    title: 'Parler à Lumia',
    summary: 'Une question ou une envie encore vague ? Lumia t’oriente vers de vrais événements.',
    features: [
      'Tu ouvres le chat.',
      'Tu poses ta question ou tu décris ce que tu cherches.',
      'Lumia répond avec l’app et les événements déjà publiés.',
    ],
  },
  {
    id: 'poster',
    icon: 'plus',
    title: 'Suggérer depuis une affiche',
    summary: 'Tu photographies une affiche. Lumia préremplit. Tu vérifies.',
    features: [
      'Tu ouvres la suggestion.',
      'Une photo et les champs se remplissent.',
      'Tu vérifies puis tu envoies. L’équipe valide avant publication.',
    ],
  },
];

export function OnboardingPromisesStep() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <View style={styles.list}>
      {PROMISES.map((item) => {
        const open = openId === item.id;
        return (
          <View key={item.id} style={styles.row}>
            <TouchableOpacity
              style={styles.header}
              onPress={() => {
                haptics.selection();
                setOpenId(open ? null : item.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${item.title}. ${item.summary}`}
            >
              <BrandIcon name={item.icon} size={22} />
              <View style={styles.copy}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.summary}>{item.summary}</Text>
              </View>
              <ChevronDown
                size={18}
                color={colors.brand.textSecondary}
                strokeWidth={2.2}
                style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>
            {open ? (
              <View style={styles.features}>
                {item.features.map((feature) => (
                  <Text key={feature} style={styles.feature}>
                    {feature}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.line,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  summary: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  features: {
    gap: spacing.xs,
    paddingLeft: 22 + spacing.sm,
  },
  feature: {
    ...typography.caption,
    color: colors.brand.text,
    lineHeight: 18,
  },
});
