import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, Star, Heart } from 'lucide-react-native';
import { AppBackground, Card, ScreenHeader } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { supabase } from '@/lib/supabase/client';

type JourneyStats = {
  eventsCreated: number;
  favoritesSaved: number;
  likesGiven: number;
};

export default function JourneyScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<JourneyStats>({
    eventsCreated: 0,
    favoritesSaved: 0,
    likesGiven: 0,
  });

  const loadStats = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      const [eventsResp, favoritesResp, likesResp] = await Promise.all([
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', profile.id),
        supabase
          .from('favorites')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', profile.id),
        supabase
          .from('event_likes')
          .select('event_id', { count: 'exact', head: true })
          .eq('user_id', profile.id),
      ]);

      if (eventsResp.error) throw eventsResp.error;
      if (favoritesResp.error) throw favoritesResp.error;
      if (likesResp.error) throw likesResp.error;

      setStats({
        eventsCreated: eventsResp.count || 0,
        favoritesSaved: favoritesResp.count || 0,
        likesGiven: likesResp.count || 0,
      });
    } catch (error) {
      console.warn('load journey stats error', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScreenHeader title="Mon parcours" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : (
        <View style={styles.cards}>
          <Card style={styles.card}>
            <View style={styles.cardRow}>
              <CalendarDays size={18} color={colors.primary[600]} />
              <Text style={styles.cardLabel}>Événements créés</Text>
            </View>
            <Text style={styles.cardValue}>{stats.eventsCreated}</Text>
          </Card>
          <Card style={styles.card}>
            <View style={styles.cardRow}>
              <Star size={18} color={colors.warning[600]} />
              <Text style={styles.cardLabel}>Favoris enregistrés</Text>
            </View>
            <Text style={styles.cardValue}>{stats.favoritesSaved}</Text>
          </Card>
          <Card style={styles.card}>
            <View style={styles.cardRow}>
              <Heart size={18} color={colors.error[500]} />
              <Text style={styles.cardLabel}>Likes donnés</Text>
            </View>
            <Text style={styles.cardValue}>{stats.likesGiven}</Text>
          </Card>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cards: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardLabel: {
    ...typography.body,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  cardValue: {
    ...typography.h3,
    color: colors.brand.text,
    fontWeight: '700',
  },
});
