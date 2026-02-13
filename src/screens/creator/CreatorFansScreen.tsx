import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Gift, Sparkles, Trophy, Users } from 'lucide-react-native';
import { Button, Card, Input } from '@/components/ui';
import { CreatorFanItem } from '@/components/creator';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { borderRadius, colors, minimumTouchTarget, spacing, typography } from '@/constants/theme';
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
    await refresh();
  }, [refresh]);

  if (isGuest) {
    return (
      <View style={styles.container}>
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
        <View style={styles.contentWrap}>
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Community Hub</Text>
              <Text style={styles.subtitle}>Segmentation, classement XP et actions rapides.</Text>
            </View>
            <View style={styles.headerActions}>
              <Button
                title="Dashboard"
                size="sm"
                variant="secondary"
                onPress={() => router.push('/creator/dashboard' as any)}
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
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {!!feedbackText && (
            <Card padding="sm" style={styles.feedbackCard} elevation="sm">
              <Sparkles size={14} color={colors.success[700]} />
              <Text style={styles.feedbackText}>{feedbackText}</Text>
            </Card>
          )}

          {loading && !fans.length ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.loadingText}>Chargement de la communauté…</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <FlatList
            data={filteredFans}
            keyExtractor={(item) => item.fan_id}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyBox}>
                  <Users size={18} color={colors.textSecondary[500]} />
                  <Text style={styles.emptyText}>Aucun fan trouvé pour ce segment.</Text>
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
                    <Gift size={16} color={colors.secondaryAccent[500]} />
                    <Text style={styles.swipeActionText}>Récompenser</Text>
                  </Pressable>
                )}
              >
                <CreatorFanItem fan={item} rank={index + 1} onPress={() => openInsights(item)} />
              </Swipeable>
            )}
          />
        </View>

        <BottomSheetModal
          ref={insightsModalRef}
          snapPoints={['48%', '68%']}
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Super Fan Insights</Text>
            <Text style={styles.sheetSubtitle}>
              {selectedFan?.profile?.display_name || 'Fan'} · Niveau {selectedFan?.level ?? 1}
            </Text>

            <Card padding="md" style={styles.insightCard} elevation="sm">
              <Text style={styles.insightStat}>{selectedFan?.interactions_count ?? 0} interactions</Text>
              <Text style={styles.insightBody}>Activité cumulée sur vos événements.</Text>
            </Card>

            <Card padding="md" style={styles.insightCard} elevation="sm">
              <Text style={styles.insightStat}>{selectedFan?.xp ?? 0} XP</Text>
              <Text style={styles.insightBody}>Potentiel élevé pour un challenge personnalisé.</Text>
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
            <Text style={styles.sheetTitle}>Reward Attribution</Text>
            <Text style={styles.sheetSubtitle}>
              Choisissez une récompense pour {selectedFan?.profile?.display_name || 'ce fan'}.
            </Text>

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
                    <View style={styles.perkIconWrap}>
                      <Trophy size={14} color={active ? colors.secondaryAccent[500] : colors.primary[700]} />
                    </View>
                    <View style={styles.perkTextWrap}>
                      <Text style={[styles.perkTitle, active && styles.perkTitleActive]}>{perk.title}</Text>
                      <Text style={[styles.perkDescription, active && styles.perkDescriptionActive]}>
                        {perk.description}
                      </Text>
                    </View>
                    <Text style={[styles.perkXp, active && styles.perkXpActive]}>{perk.xp} XP</Text>
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
    backgroundColor: colors.background[500],
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary[500],
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  segmentButton: {
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.secondaryAccent[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  segmentButtonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  segmentText: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.secondaryAccent[500],
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.success[0],
    borderColor: colors.success[500],
    marginBottom: spacing.sm,
  },
  feedbackText: {
    ...typography.bodySmall,
    color: colors.success[700],
    fontWeight: '600',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error[700],
    marginBottom: spacing.sm,
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
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
  },
  swipeAction: {
    marginVertical: 4,
    borderRadius: borderRadius.md,
    minWidth: 122,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary[600],
  },
  swipeActionText: {
    ...typography.caption,
    color: colors.secondaryAccent[500],
    fontWeight: '700',
  },
  sheetBackground: {
    backgroundColor: colors.secondaryAccent[500],
  },
  sheetHandle: {
    backgroundColor: colors.neutral[300],
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    ...typography.h5,
    color: colors.textPrimary[500],
  },
  sheetSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
    marginBottom: spacing.xs,
  },
  insightCard: {
    backgroundColor: colors.background[500],
  },
  insightStat: {
    ...typography.h6,
    color: colors.textPrimary[500],
  },
  insightBody: {
    ...typography.caption,
    color: colors.textSecondary[500],
  },
  perksColumn: {
    gap: spacing.xs,
  },
  perkItem: {
    minHeight: minimumTouchTarget,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.background[500],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  perkItemActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  perkIconWrap: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  perkTextWrap: {
    flex: 1,
  },
  perkTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary[500],
    fontWeight: '700',
  },
  perkTitleActive: {
    color: colors.secondaryAccent[500],
  },
  perkDescription: {
    ...typography.caption,
    color: colors.textSecondary[500],
  },
  perkDescriptionActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  perkXp: {
    ...typography.caption,
    color: colors.primary[700],
    fontWeight: '700',
  },
  perkXpActive: {
    color: colors.secondaryAccent[500],
  },
  messageInput: {
    textAlignVertical: 'top',
    minHeight: 82,
  },
});
