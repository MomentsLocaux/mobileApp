import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Gift, Sparkles, Trophy, Users } from 'lucide-react-native';
import { CreatorFanItem } from '@/components/creator';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import {
  Button,
  Card,
  Input,
  ScreenLayout,
  Typography,
  colors,
  radius,
  spacing,
} from '@/components/ui/v2';
import { useAuth } from '@/hooks';
import { useCreatorFans } from '@/hooks/useCreatorFans';
import type { CreatorFan } from '@/types/creator.types';

type SegmentKey = 'all' | 'super' | 'active';

type RewardPerk = {
  id: string;
  title: string;
  description: string;
  xp: number;
};

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'super', label: 'Super fans' },
  { key: 'active', label: 'Très actifs' },
];

const REWARD_PERKS: RewardPerk[] = [
  {
    id: 'highlight',
    title: 'Badge mise en avant',
    description: 'Ajoute une reconnaissance visible sur 7 jours.',
    xp: 120,
  },
  {
    id: 'private_invite',
    title: 'Invitation privée',
    description: 'Accès anticipé à un prochain événement.',
    xp: 200,
  },
  {
    id: 'creator_thanks',
    title: 'Message créateur',
    description: 'Remerciement personnalisé et épinglé.',
    xp: 80,
  },
];

export default function CreatorFansScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const isGuest = !session;

  const handleExitCreator = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/map' as any);
  };

  const { fans, loading, error, refresh } = useCreatorFans(profile?.id, 40);

  const [segment, setSegment] = useState<SegmentKey>('all');
  const [selectedFan, setSelectedFan] = useState<CreatorFan | null>(null);
  const [selectedPerkId, setSelectedPerkId] = useState(REWARD_PERKS[0].id);
  const [rewardMessage, setRewardMessage] = useState('Merci pour ton soutien régulier.');
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const insightsModalRef = useRef<BottomSheetModal>(null);
  const rewardModalRef = useRef<BottomSheetModal>(null);

  const filteredFans = useMemo(() => {
    if (segment === 'super') return fans.filter((fan) => fan.super_fan);
    if (segment === 'active') return fans.filter((fan) => fan.interactions_count >= 5);
    return fans;
  }, [fans, segment]);

  const selectedPerk = useMemo(
    () => REWARD_PERKS.find((perk) => perk.id === selectedPerkId) || REWARD_PERKS[0],
    [selectedPerkId],
  );

  const openInsights = useCallback((fan: CreatorFan) => {
    setSelectedFan(fan);
    insightsModalRef.current?.present();
  }, []);

  const openReward = useCallback((fan: CreatorFan) => {
    setSelectedFan(fan);
    setFeedbackText(null);
    rewardModalRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
    ),
    [],
  );

  const onSendReward = useCallback(async () => {
    if (!selectedFan) return;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFeedbackText(`Récompense envoyée à ${selectedFan.profile?.display_name || 'ce fan'}.`);
    rewardModalRef.current?.dismiss();
  }, [selectedFan]);

  const onLaunchChallenge = useCallback(async () => {
    if (!selectedFan) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFeedbackText(`Challenge lancé pour ${selectedFan.profile?.display_name || 'ce fan'}.`);
    insightsModalRef.current?.dismiss();
  }, [selectedFan]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (isGuest) {
    return (
      <View style={styles.guestContainer}>
        <GuestGateModal
          visible
          title="Communauté créateur"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <BottomSheetModalProvider>
        <ScreenLayout
          scroll={false}
          header={
            <View style={styles.headerRow}>
              <View style={styles.headerTextWrap}>
                <Typography variant="sectionTitle" color={colors.textPrimary} weight="700">
                  Community Hub
                </Typography>
                <Typography variant="body" color={colors.textSecondary}>
                  Segmentation, ranking XP et actions rapides.
                </Typography>
              </View>

              <View style={styles.headerActions}>
                <Button
                  title="Dashboard"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push('/creator/dashboard' as any)}
                  accessibilityRole="button"
                />
                <Button
                  title="Quitter"
                  size="sm"
                  variant="secondary"
                  onPress={handleExitCreator}
                  accessibilityRole="button"
                  accessibilityLabel="Quitter l'espace créateur"
                />
              </View>
            </View>
          }
          contentContainerStyle={styles.content}
        >
          <View style={styles.segmentRow}>
            {SEGMENTS.map((item) => {
              const active = item.key === segment;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => setSegment(item.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrer ${item.label}`}
                  accessible
                >
                  <Typography
                    variant="caption"
                    color={active ? colors.background : colors.textSecondary}
                    weight="700"
                  >
                    {item.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>

          {!!feedbackText && (
            <Card padding="sm" style={styles.feedbackCard}>
              <Sparkles size={14} color={colors.success} />
              <Typography variant="body" color={colors.textPrimary}>
                {feedbackText}
              </Typography>
            </Card>
          )}

          {loading && !fans.length ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Typography variant="body" color={colors.textSecondary}>
                Chargement de la communauté...
              </Typography>
            </View>
          ) : null}

          {error ? (
            <Typography variant="body" color={colors.danger}>
              {error}
            </Typography>
          ) : null}

          <FlatList
            data={filteredFans}
            keyExtractor={(item) => item.fan_id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyBox}>
                  <Users size={18} color={colors.textMuted} />
                  <Typography variant="body" color={colors.textSecondary}>
                    Aucun fan trouvé pour ce segment.
                  </Typography>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <Swipeable
                overshootRight={false}
                renderRightActions={() => (
                  <Pressable
                    style={styles.swipeAction}
                    onPress={() => openReward(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Récompenser ${item.profile?.display_name || 'ce fan'}`}
                    accessible
                  >
                    <Gift size={16} color={colors.background} />
                    <Typography variant="caption" color={colors.background} weight="700">
                      Récompenser
                    </Typography>
                  </Pressable>
                )}
              >
                <CreatorFanItem fan={item} rank={index + 1} onPress={() => openInsights(item)} />
              </Swipeable>
            )}
          />
        </ScreenLayout>

        <BottomSheetModal
          ref={insightsModalRef}
          snapPoints={['48%', '68%']}
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <View style={styles.sheetContent}>
            <Typography variant="subsection" color={colors.textPrimary} weight="700">
              Super Fan Insights
            </Typography>
            <Typography variant="body" color={colors.textSecondary}>
              {selectedFan?.profile?.display_name || 'Fan'} · Niveau {selectedFan?.level ?? 1}
            </Typography>

            <Card padding="md" style={styles.insightCard}>
              <Typography variant="subsection" color={colors.textPrimary} weight="700">
                {selectedFan?.interactions_count ?? 0} interactions
              </Typography>
              <Typography variant="caption" color={colors.textSecondary}>
                Activité cumulée sur vos événements.
              </Typography>
            </Card>

            <Card padding="md" style={styles.insightCard}>
              <Typography variant="subsection" color={colors.textPrimary} weight="700">
                {selectedFan?.xp ?? 0} XP
              </Typography>
              <Typography variant="caption" color={colors.textSecondary}>
                Potentiel élevé pour un challenge personnalisé.
              </Typography>
            </Card>

            <Button title="Lancer un challenge" onPress={onLaunchChallenge} accessibilityRole="button" />
          </View>
        </BottomSheetModal>

        <BottomSheetModal
          ref={rewardModalRef}
          snapPoints={['58%', '82%']}
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <View style={styles.sheetContent}>
            <Typography variant="subsection" color={colors.textPrimary} weight="700">
              Reward Attribution
            </Typography>
            <Typography variant="body" color={colors.textSecondary}>
              Choisissez une récompense pour {selectedFan?.profile?.display_name || 'ce fan'}.
            </Typography>

            <View style={styles.perksColumn}>
              {REWARD_PERKS.map((perk) => {
                const active = perk.id === selectedPerkId;
                return (
                  <Pressable
                    key={perk.id}
                    onPress={() => setSelectedPerkId(perk.id)}
                    style={[styles.perkItem, active && styles.perkItemActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Choisir ${perk.title}`}
                    accessible
                  >
                    <View style={[styles.perkIconWrap, active && styles.perkIconWrapActive]}>
                      <Trophy size={14} color={active ? colors.background : colors.primary} />
                    </View>
                    <View style={styles.perkTextWrap}>
                      <Typography
                        variant="body"
                        color={active ? colors.background : colors.textPrimary}
                        weight="700"
                        numberOfLines={1}
                      >
                        {perk.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={active ? 'rgba(15,23,25,0.82)' : colors.textSecondary}
                        numberOfLines={2}
                      >
                        {perk.description}
                      </Typography>
                    </View>
                    <Typography variant="caption" color={active ? colors.background : colors.primary} weight="700">
                      {perk.xp} XP
                    </Typography>
                  </Pressable>
                );
              })}
            </View>

            <Input
              label="Message personnalisé"
              value={rewardMessage}
              onChangeText={setRewardMessage}
              placeholder="Écrivez un message"
              multiline
              numberOfLines={3}
              style={styles.messageInput}
            />

            <Button
              title={`Envoyer ${selectedPerk.xp} XP`}
              onPress={onSendReward}
              accessibilityRole="button"
            />
          </View>
        </BottomSheetModal>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  guestContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  segmentButton: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.element,
    backgroundColor: colors.surfaceLevel1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderColor: 'rgba(52, 199, 89, 0.45)',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  swipeAction: {
    marginVertical: 4,
    borderRadius: radius.element,
    minWidth: 128,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
  },
  sheetBackground: {
    backgroundColor: colors.surfaceLevel1,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  sheetHandle: {
    backgroundColor: colors.textMuted,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  insightCard: {
    backgroundColor: colors.surfaceLevel2,
  },
  perksColumn: {
    gap: spacing.xs,
  },
  perkItem: {
    minHeight: 48,
    borderRadius: radius.element,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceLevel2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  perkItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  perkIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
  },
  perkIconWrapActive: {
    backgroundColor: 'rgba(15, 23, 25, 0.2)',
  },
  perkTextWrap: {
    flex: 1,
    gap: 2,
  },
  messageInput: {
    textAlignVertical: 'top',
    minHeight: 96,
    borderRadius: radius.element,
    backgroundColor: colors.surfaceLevel2,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
});
