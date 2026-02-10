import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '../../src/constants/theme';
import { useOffersStore } from '../../src/store/offersStore';
import { useAuth } from '../../src/hooks';

type OfferCardProps = {
  title: string;
  badge?: string;
  accent?: boolean;
  subtitle?: string;
  children: React.ReactNode;
};

const OfferCard: React.FC<OfferCardProps> = ({ title, badge, accent, subtitle, children }) => (
  <View style={[styles.card, accent ? styles.cardAccent : styles.cardNeutral]}>
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleWrap}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </View>
    {children}
  </View>
);

const FeatureList = ({ items }: { items: string[] }) => (
  <View style={styles.featureList}>
    {items.map((item) => (
      <View key={item} style={styles.featureRow}>
        <View style={styles.bullet} />
        <Text style={styles.featureText}>{item}</Text>
      </View>
    ))}
  </View>
);

type OfferDetails = {
  id: 'creator_prime' | 'explorer_insider' | 'all_access';
  name: string;
  subtitle: string;
  message: string;
  preview: string[];
  features: string[];
  accent?: boolean;
  priceMonthly: string;
  priceYearly: string;
};

export default function OffersScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { userPlan } = useOffersStore();
  const insets = useSafeAreaInsets();
  const [activeOffer, setActiveOffer] = useState<OfferDetails | null>(null);
  const [institutionalOpen, setInstitutionalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const offers = useMemo<OfferDetails[]>(
    () => [
      {
        id: 'creator_prime',
        name: 'Créateur Prime',
        subtitle: 'Visibilité et contrôle pour créateurs actifs',
        message: 'Développez votre visibilité et comprenez réellement l’impact de vos événements.',
        preview: ['Badge Créateur Prime', 'Statistiques avancées', 'Wallet & boutique Lumo'],
        priceMonthly: '6,99 € / mois',
        priceYearly: '69 € / an',
        features: [
          'Badge Créateur Prime (carte, fiche événement, profil)',
          'Mention “Créateur Prime” dans les listes',
          'Dashboard statistiques (vues, clics, favoris, partages, heatmap)',
          'Comparaison événement / événement',
          'Accès complet au wallet Lumo et historique',
          'Accès à la boutique (boosts, mises en avant, cosmétiques)',
          'Bonus Lumo mensuel',
          'Duplication et programmation d’événements',
          'Edition étendue post-publication',
          'Priorité légère de modération',
        ],
      },
      {
        id: 'explorer_insider',
        name: 'Dénicheur Insider',
        subtitle: 'Découverte premium pour explorateurs',
        message: 'Découvrez les meilleurs moments locaux avant tout le monde.',
        preview: ['Filtres premium', 'Accès anticipé', 'Missions Insider'],
        priceMonthly: '3,99 € / mois',
        priceYearly: '39 € / an',
        features: [
          'Filtres premium exclusifs (Pépites locales, Très populaire, Ce week-end, Nouveautés)',
          'Accès anticipé à certains événements',
          'Badge Dénicheur Insider (profil & commentaires)',
          'Bonus Lumo sur partages, commentaires, favoris',
          'Missions & challenges Insider',
          'Notifications intelligentes prioritaires',
          'Mode “moins de bruit” (suggestions ciblées)',
          'Historique enrichi des découvertes',
        ],
      },
      {
        id: 'all_access',
        name: 'Moments All Access',
        subtitle: 'L’offre ultime pour créateurs + explorateurs',
        message: 'L’expérience Moments Locaux complète, sans compromis.',
        preview: ['Tout Prime + Insider', 'Bonus Lumo majoré', 'Accès anticipé aux nouveautés'],
        priceMonthly: '9,99 € / mois',
        priceYearly: '99 € / an',
        features: [
          'Inclut 100% de Créateur Prime',
          'Inclut 100% de Dénicheur Insider',
          'Badge All Access ultra visible (couleur dédiée)',
          'Bonus Lumo majoré',
          'Accès anticipé aux nouvelles fonctionnalités',
          'Invitations concours et événements partenaires',
          'Accès privilégié aux beta-tests',
          'Possibilité de recommander des événements (V1.5+)',
          'Participation à des sélections éditoriales (V1.5+)',
        ],
        accent: true,
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary[600]} />
        <Text style={styles.loadingText}>Chargement…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroGlow} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top - 12, 0) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Offres & abonnements</Text>
        <Text style={styles.subtitle}>Choisissez l’offre adaptée à votre usage</Text>
      </View>

      <OfferCard title="Offre Gratuite" badge="Offre actuelle" subtitle="Accès essentiel pour démarrer">
        <FeatureList
          items={[
            'Publier des événements',
            'Explorer la carte',
            'Interagir avec la communauté',
          ]}
        />
      </OfferCard>

      {offers.map((offer) => (
        <OfferCard
          key={offer.id}
          title={offer.name}
          subtitle={offer.subtitle}
          badge={userPlan === offer.id ? 'Votre offre' : offer.id === 'creator_prime' ? 'Recommandé' : undefined}
          accent={offer.accent}
        >
          <View style={styles.priceRow}>
            <Text style={styles.pricePrimary}>{offer.priceMonthly}</Text>
            <Text style={styles.priceSecondary}>{offer.priceYearly}</Text>
          </View>
          <Text style={styles.paragraph}>{offer.message}</Text>
          <FeatureList items={offer.preview} />
          <TouchableOpacity style={styles.detailsButton} onPress={() => setActiveOffer(offer)}>
            <Text style={styles.detailsButtonText}>Voir les détails</Text>
          </TouchableOpacity>
        </OfferCard>
      ))}

      <OfferCard title="Pack Institutionnel">
        <Text style={styles.paragraph}>
          Une solution dédiée aux collectivités, offices du tourisme et acteurs publics.
        </Text>
        <View style={styles.institutionalPricing}>
          <View style={styles.pricingTier}>
            <Text style={styles.tierTitle}>Commune / petite collectivité</Text>
            <Text style={styles.tierPrice}>990 € / an</Text>
          </View>
          <View style={styles.pricingTier}>
            <Text style={styles.tierTitle}>Ville moyenne / Office de tourisme</Text>
            <Text style={styles.tierPrice}>1 990 € / an</Text>
          </View>
          <View style={styles.pricingTier}>
            <Text style={styles.tierTitle}>Département / Région / Réseau</Text>
            <Text style={styles.tierPrice}>Sur devis (3 000 € – 10 000 € / an)</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.detailsButton} onPress={() => setInstitutionalOpen(true)}>
          <Text style={styles.detailsButtonText}>Voir les détails</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => Linking.openURL('mailto:contact@momentslocaux.app')}
        >
          <Text style={styles.outlineButtonText}>Nous contacter</Text>
        </TouchableOpacity>
      </OfferCard>

      <View style={styles.priceGrid}>
        <Text style={styles.gridTitle}>Grille tarifaire</Text>
        {[
          { label: 'Gratuit', monthly: '0 €', yearly: '0 €' },
          { label: 'Créateur Prime', monthly: '6,99 €', yearly: '69 €' },
          { label: 'Dénicheur Insider', monthly: '3,99 €', yearly: '39 €' },
          { label: 'Moments All Access', monthly: '9,99 €', yearly: '99 €' },
          { label: 'Institutionnel', monthly: '—', yearly: '990 €+' },
        ].map((row) => (
          <View key={row.label} style={styles.gridRow}>
            <Text style={styles.gridLabel}>{row.label}</Text>
            <Text style={styles.gridValue}>{row.monthly}</Text>
            <Text style={styles.gridValue}>{row.yearly}</Text>
          </View>
        ))}
      </View>

      <Modal visible={!!activeOffer} transparent animationType="fade" onRequestClose={() => setActiveOffer(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activeOffer?.name}</Text>
            <Text style={styles.modalSubtitle}>{activeOffer?.message}</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {activeOffer?.features.map((item) => (
                <View key={item} style={styles.modalRow}>
                  <View style={styles.modalBullet} />
                  <Text style={styles.modalText}>{item}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setActiveOffer(null)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={institutionalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInstitutionalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pack Institutionnel — Détails</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>
                Le Pack Institutionnel est une solution dédiée aux collectivités et acteurs publics (mairies,
                offices de tourisme, intercommunalités, régions) souhaitant valoriser leur territoire et structurer
                la visibilité des initiatives locales, sans publicité ni mise en avant payante.
              </Text>
              <Text style={styles.modalSubtitle}>Il permet de :</Text>
              {[
                'Disposer d’un compte officiel vérifié, clairement identifié sur la carte et les événements',
                'Publier et relayer des événements institutionnels (animations, festivals, marchés, informations locales)',
                'Mettre en valeur le territoire via des sélections éditoriales et des espaces dédiés, dans le respect de la neutralité de la plateforme',
                'Accéder à des statistiques territoriales anonymisées pour mieux comprendre la dynamique locale (activité, fréquentation, catégories, périodes clés)',
                'Collaborer à plusieurs agents grâce à un système de rôles et de gestion multi-comptes',
                'Soutenir et recommander des initiatives citoyennes sans pouvoir de censure ni priorité algorithmique',
              ].map((item) => (
                <View key={item} style={styles.modalRow}>
                  <View style={styles.modalBullet} />
                  <Text style={styles.modalText}>{item}</Text>
                </View>
              ))}
              <Text style={styles.modalText}>
                Le Pack Institutionnel est proposé uniquement sur demande, avec un accompagnement dédié, et
                s’inscrit dans une démarche de service public, de transparence et de confiance.
              </Text>
              <Text style={styles.modalText}>
                👉 Une solution pensée pour éclairer, valoriser et coordonner, sans jamais concurrencer les créateurs locaux.
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setInstitutionalOpen(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heroGlow: {
    position: 'absolute',
    top: -120,
    right: -140,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: '#F5D27B',
    opacity: 0.35,
  },
  header: {
    marginBottom: spacing.md,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backText: {
    ...typography.caption,
    color: '#9B6A13',
    fontWeight: '600',
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    backgroundColor: colors.neutral[0],
  },
  cardNeutral: {
    borderColor: colors.neutral[200],
  },
  cardAccent: {
    borderColor: '#D6A93A',
    backgroundColor: '#FFF6DD',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    fontSize: 12,
    color: colors.neutral[700],
    fontWeight: '700',
  },
  featureList: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: '#C18A1C',
  },
  featureText: {
    ...typography.body,
    color: colors.neutral[700],
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pricePrimary: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  priceSecondary: {
    ...typography.body,
    color: colors.neutral[500],
  },
  paragraph: {
    ...typography.body,
    color: colors.neutral[700],
    marginBottom: spacing.md,
  },
  institutionalPricing: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pricingTier: {
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
  },
  tierTitle: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  tierPrice: {
    ...typography.caption,
    color: colors.neutral[600],
    marginTop: 4,
  },
  detailsButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: colors.neutral[700],
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: colors.neutral[700],
    fontWeight: '600',
  },
  priceGrid: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: spacing.md,
  },
  gridTitle: {
    ...typography.h4,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[200],
  },
  gridLabel: {
    flex: 1,
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  gridValue: {
    width: 70,
    textAlign: 'right',
    ...typography.body,
    color: colors.neutral[600],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.neutral[600],
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  modalScroll: {
    maxHeight: 320,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: '#C18A1C',
  },
  modalText: {
    ...typography.body,
    color: colors.neutral[700],
    flex: 1,
  },
  modalClose: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
  },
  modalCloseText: {
    fontWeight: '600',
    color: colors.neutral[700],
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#F3F3F3',
  },
  loadingText: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
