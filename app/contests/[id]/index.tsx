import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { AppBackground, Button } from '@/components/ui';
import { useAuthStore } from '@/state/auth';
import { ContestsService, type Contest, type ContestEntry, type ContestReward } from '@/features/contests';
import { ContestZoneMap } from '@/features/contests/ContestZoneMap';

export default function ContestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const [contest, setContest] = useState<Contest | null>(null);
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [rewards, setRewards] = useState<ContestReward[]>([]);
  const [myVoteEntryId, setMyVoteEntryId] = useState<string | null>(null);
  const [myEntry, setMyEntry] = useState<ContestEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const contestData = await ContestsService.getById(id);
      setContest(contestData);
      const [entriesData, vote, mine] = await Promise.all([
        ContestsService.listActiveEntries(id),
        userId ? ContestsService.getMyVote(id, userId) : Promise.resolve(null),
        userId ? ContestsService.getMyEntry(id, userId) : Promise.resolve(null),
      ]);
      setEntries(entriesData);
      setMyVoteEntryId(vote?.entry_id || null);
      setMyEntry(mine);
      if (contestData.jury_announced_at) {
        setRewards(await ContestsService.listRewards(id));
      } else {
        setRewards([]);
      }
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [id, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canVote =
    !!userId &&
    contest?.status === 'open' &&
    !!contest.voting_ends_at &&
    new Date(contest.voting_ends_at).getTime() > Date.now();

  const canSubmit =
    !!userId &&
    contest?.status === 'open' &&
    new Date(contest.start_at).getTime() <= Date.now() &&
    new Date(contest.end_at).getTime() >= Date.now() &&
    (!myEntry || myEntry.status === 'pending' || myEntry.status === 'refused');

  const onVote = async (entry: ContestEntry) => {
    if (!userId || !contest) return;
    if (entry.user_id === userId) {
      Alert.alert('Impossible', 'Vous ne pouvez pas voter pour votre participation.');
      return;
    }
    setVotingId(entry.id);
    try {
      const vote = await ContestsService.castVote(contest.id, entry.id);
      setMyVoteEntryId(vote.entry_id);
      await load();
    } catch (err) {
      Alert.alert('Vote impossible', err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setVotingId(null);
    }
  };

  if (loading || !contest) {
    return (
      <View style={styles.wrapper}>
        <AppBackground />
        <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.xxl }} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.neutral[100]} />
        </TouchableOpacity>

        {contest.cover_url ? <Image source={{ uri: contest.cover_url }} style={styles.cover} /> : null}
        <Text style={styles.title}>{contest.title}</Text>
        {contest.theme ? <Text style={styles.theme}>{contest.theme}</Text> : null}
        <Text style={styles.meta}>
          Dépôts jusqu’au {new Date(contest.end_at).toLocaleString()} · Votes jusqu’au{' '}
          {new Date(contest.voting_ends_at).toLocaleString()}
        </Text>
        {contest.description ? <Text style={styles.body}>{contest.description}</Text> : null}

        {myEntry ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Ma participation : {myEntry.status}</Text>
            {myEntry.refusal_reason ? (
              <Text style={styles.bannerText}>Motif : {myEntry.refusal_reason}</Text>
            ) : null}
          </View>
        ) : null}

        {canSubmit ? (
          <Button
            title={myEntry ? 'Modifier ma participation' : 'Participer'}
            onPress={() => router.push(`/contests/${contest.id}/submit` as any)}
          />
        ) : null}

        {rewards.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lauréats officiels</Text>
            {rewards.map((reward) => (
              <Text key={reward.id} style={styles.body}>
                #{reward.rank} — participation {reward.entry_id?.slice(0, 8)}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Carte des zones</Text>
        <Text style={styles.meta}>Zones approximatives — jamais de pin exact.</Text>
        <ContestZoneMap
          entries={entries}
          gridMeters={contest.geo_grid_meters}
          canVote={canVote}
          myVoteEntryId={myVoteEntryId}
          onVotePress={onVote}
        />

        <Text style={styles.sectionTitle}>Galerie ({entries.length})</Text>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            {entry.media_url ? <Image source={{ uri: entry.media_url }} style={styles.entryImage} /> : null}
            <View style={styles.entryBody}>
              <Text style={styles.entryTitle}>{entry.title || 'Sans titre'}</Text>
              <Text style={styles.meta}>{entry.votes_count} votes</Text>
              {canVote ? (
                <TouchableOpacity
                  style={[styles.voteBtn, myVoteEntryId === entry.id && styles.voteBtnActive]}
                  onPress={() => onVote(entry)}
                  disabled={votingId === entry.id}
                >
                  <Heart
                    size={16}
                    color={myVoteEntryId === entry.id ? colors.brand.primary : colors.neutral[300]}
                    fill={myVoteEntryId === entry.id ? colors.brand.primary : 'transparent'}
                  />
                  <Text style={styles.voteText}>
                    {myVoteEntryId === entry.id ? 'Votre vote' : 'Voter'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xl + spacing.md, gap: spacing.md },
  backBtn: { alignSelf: 'flex-start', padding: spacing.xs },
  cover: { width: '100%', height: 180, borderRadius: borderRadius.lg },
  title: { ...typography.h2, color: colors.neutral[50] },
  theme: { ...typography.caption, color: colors.brand.primary },
  meta: { ...typography.caption, color: colors.neutral[400] },
  body: { ...typography.body, color: colors.neutral[200] },
  banner: {
    backgroundColor: colors.neutral[900],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[800],
  },
  bannerTitle: { ...typography.bodyBold, color: colors.neutral[100] },
  bannerText: { ...typography.caption, color: colors.neutral[400], marginTop: 4 },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.h3, color: colors.neutral[50], marginTop: spacing.sm },
  entryCard: {
    backgroundColor: colors.neutral[900],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[800],
  },
  entryImage: { width: '100%', height: 200 },
  entryBody: { padding: spacing.md, gap: spacing.xs },
  entryTitle: { ...typography.bodyBold, color: colors.neutral[50] },
  voteBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[800],
  },
  voteBtnActive: { backgroundColor: colors.brand.primary + '22' },
  voteText: { ...typography.caption, color: colors.neutral[100] },
});
