import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ShoppingBag, Sparkles, Coins } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { AppBackground, Card, ScreenHeader } from '@/components/ui';
import { HabitueGamificationGate } from '@/components/HabitueGamificationGate';
import { ShopService, SHOP_RAYON_LABELS, type ShopItemRow, type ShopRayon } from '@/services/shop.service';
import { LumoService } from '@/services/lumo.service';
import { CreatorBoostService } from '@/services/creator-boost.service';
import { useAuth } from '@/hooks';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { useOfferEntitlements } from '@/hooks/useOfferEntitlements';
import { GuestGateModal } from '@/components/auth/GuestGateModal';

export default function ShopScreen() {
  return (
    <HabitueGamificationGate>
      <ShopScreenInner />
    </HabitueGamificationGate>
  );
}

function ShopScreenInner() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { canCreate } = useAccountIdentity();
  const { hasEclaireur } = useOfferEntitlements();
  const userId = profile?.id || session?.user?.id;
  const isGuest = !session;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ShopItemRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [earnedBoosts, setEarnedBoosts] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [guestGate, setGuestGate] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const list = await ShopService.listItems();
      setItems(list);
      if (userId) {
        setBalance(await LumoService.getBalance(userId));
      }
      try {
        const earned = await CreatorBoostService.getMine();
        setEarnedBoosts(earned.unused);
      } catch {
        setEarnedBoosts(0);
      }
    } catch (error) {
      console.warn('load shop items error', error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, userId]);

  useFocusEffect(
    useCallback(() => {
      if (isGuest) {
        setGuestGate(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      void load();
    }, [isGuest, load]),
  );

  const onBuy = async (item: ShopItemRow) => {
    if (isGuest) {
      setGuestGate(true);
      return;
    }
    if (item.key === 'event_boost_24h' || item.key === 'event_boost_72h' || item.key === 'early_access_unlock') {
      Alert.alert(
        item.key.includes('early') ? 'Accès anticipé' : 'Boost événement',
        'Choisis un de tes événements publiés pour l’appliquer depuis la fiche.',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Mes événements', onPress: () => router.push('/profile/my-events' as any) },
        ],
      );
      return;
    }

    Alert.alert('Confirmer l’achat', `${item.title} pour ${item.price} Lumo ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Acheter',
        onPress: async () => {
          setBusyKey(item.key);
          try {
            await ShopService.buyItem(item.key);
            const effectHint =
              item.key === 'community_highlight_7d'
                ? 'Mise en avant communauté 7j activée.'
                : item.key === 'pass_extra_stamp'
                  ? 'Tampon Pass bonus ajouté (max 1 / mois).'
                  : `${item.title} ajouté à ton inventaire.`;
            Alert.alert('Achat confirmé', effectHint);
            await load();
          } catch (e: any) {
            const msg = String(e?.message || '');
            if (msg.includes('PASS_STAMP_CAP_REACHED')) {
              Alert.alert('Achat', 'Tu as déjà utilisé ton tampon Pass bonus ce mois-ci.');
            } else {
              Alert.alert('Achat', msg || 'Impossible pour le moment');
            }
          } finally {
            setBusyKey(null);
          }
        },
      },
    ]);
  };

  const visibleItems = items.filter((item) => {
    if (item.requiresCanCreate && !canCreate) return false;
    if (item.minEntitlement === 'eclaireur' && !hasEclaireur) return false;
    return true;
  });

  const byRayon = (['visibility', 'access', 'style'] as ShopRayon[])
    .map((rayon) => ({
      rayon,
      items: visibleItems.filter((i) => i.rayon === rayon),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <ScreenHeader
        title="Boutique Lumo"
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/map');
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brand.secondary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <ShoppingBag size={20} color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Boutique Lumo</Text>
            <Text style={styles.subtitle}>
              Visibilité · Accès · Style — ~{CHECKIN_HINT} Lumo / sortie
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.balancePill} onPress={() => router.push('/profile/wallet' as any)}>
          <Coins size={14} color={colors.brand.secondary} />
          <Text style={styles.balanceText}>{balance} Lumo</Text>
        </TouchableOpacity>

        {earnedBoosts > 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Boosts gagnés : {earnedBoosts}</Text>
            <Text style={styles.emptyBody}>
              Utilise-les gratuitement depuis la fiche d’un de tes événements publiés (pas un achat
              Lumo).
            </Text>
            <TouchableOpacity style={styles.buyBtn} onPress={() => router.push('/profile/my-events' as any)}>
              <Text style={styles.buyBtnText}>Mes événements</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {!canCreate ? (
          <Text style={styles.hintDiscover}>
            Les items Visibilité s’affichent si tu actives aussi la création (Particulier).
          </Text>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : byRayon.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun article</Text>
            <Text style={styles.emptyBody}>La boutique sera alimentée bientôt.</Text>
          </Card>
        ) : (
          byRayon.map((group) => (
            <View key={group.rayon} style={styles.rayonBlock}>
              <Text style={styles.rayonTitle}>{SHOP_RAYON_LABELS[group.rayon]}</Text>
              {group.items.map((item) => (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemTypeWrap}>
                      <Sparkles size={14} color={colors.brand.secondary} />
                      <Text style={styles.itemType}>{item.type}</Text>
                    </View>
                    <View style={styles.priceWrap}>
                      <Coins size={14} color={colors.brand.secondary} />
                      <Text style={styles.priceText}>{item.price}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDescription}>{item.description || 'Aucune description.'}</Text>
                  <Text style={styles.sortiesHint}>≈ {item.sortiesEstimate} sorties</Text>
                  <TouchableOpacity
                    style={styles.buyBtn}
                    disabled={busyKey === item.key}
                    onPress={() => void onBuy(item)}
                  >
                    <Text style={styles.buyBtnText}>
                      {busyKey === item.key
                        ? '…'
                        : item.key.startsWith('event_boost') || item.key === 'early_access_unlock'
                          ? 'Choisir un événement'
                          : 'Acheter'}
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <GuestGateModal
        visible={guestGate}
        title="Connexion requise"
        onClose={() => {
          setGuestGate(false);
          router.replace('/(tabs)/map');
        }}
        onSignUp={() => router.replace('/auth/register' as any)}
        onSignIn={() => router.replace('/auth/login' as any)}
      />
    </View>
  );
}

const CHECKIN_HINT = 20;

const styles = StyleSheet.create({
  container: {
    minHeight: '100%',
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  hintDiscover: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
  },
  rayonBlock: {
    gap: spacing.sm,
  },
  rayonTitle: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  sortiesHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  balancePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  balanceText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  wrapper: {
    flex: 1,
  },
  emptyCard: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.brand.surface,
  },
  emptyTitle: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '700',
  },
  emptyBody: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  itemCard: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.brand.surface,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTypeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemType: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  itemTitle: {
    ...typography.bodyLarge,
    color: colors.brand.text,
    fontWeight: '700',
  },
  itemDescription: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  buyBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buyBtnText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
});
