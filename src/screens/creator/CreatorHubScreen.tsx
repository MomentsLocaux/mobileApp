import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarClock, PlusCircle } from 'lucide-react-native';
import { AppBackground, Button } from '@/components/ui';
import { IdentityAppBackground } from '@/components/identity/IdentityAppBackground';
import { ModeSwitch } from '@/components/identity/ModeSwitch';
import { useAuth } from '@/hooks';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { EventsService } from '@/services/events.service';
import { colors, spacing, typography } from '@/constants/theme';
import type { Event } from '@/types/database';

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Brouillon';
    case 'pending':
      return 'En revue';
    case 'published':
      return 'Publié';
    case 'refused':
      return 'Refusé';
    default:
      return status;
  }
}

/**
 * Hub Créateur B2C — active_mode=create (ADR_007 / ID-MODE-SWITCH).
 * Pas le dashboard Diffuseur (réservé Professionnel).
 */
export default function CreatorHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { activeMode, setActiveMode, savingMode, accent } = useAccountIdentity();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setEvents([]);
      setLoading(false);
      return;
    }
    try {
      const list = await EventsService.listEventsByCreator(profile.id);
      setEvents(list as Event[]);
    } catch (err) {
      console.warn('CreatorHub load', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <IdentityAppBackground />
      <AppBackground opacity={0.85} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent.accent} />
        }
      >
        <Text style={styles.eyebrow}>Mode Créateur</Text>
        <Text style={styles.title}>Tes moments</Text>
        <Text style={styles.subtitle}>
          Publie et suis tes statuts. Pour explorer le quartier, repasse en mode Découvreur.
        </Text>

        <ModeSwitch mode={activeMode} loading={savingMode} onChange={(m) => void setActiveMode(m)} />

        <Button
          title="Créer un moment"
          onPress={() => router.push('/events/create/step-1' as any)}
          style={{ marginTop: spacing.md }}
        />

        <Pressable
          onPress={() => router.push('/profile/my-events' as any)}
          style={styles.linkRow}
        >
          <PlusCircle size={16} color={accent.accent} />
          <Text style={[styles.linkText, { color: accent.accent }]}>Tous mes événements</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={accent.accent} style={{ marginTop: spacing.xl }} />
        ) : events.length === 0 ? (
          <Text style={styles.empty}>Aucun événement pour l’instant — lance le premier.</Text>
        ) : (
          <View style={styles.list}>
            {events.slice(0, 8).map((ev) => (
              <Pressable
                key={ev.id}
                style={styles.row}
                onPress={() => router.push(`/events/${ev.id}` as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {ev.title}
                  </Text>
                  <Text style={styles.rowMeta}>{statusLabel(ev.status || 'draft')}</Text>
                </View>
                <CalendarClock size={16} color={colors.brand.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand.page },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 8,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { ...typography.h1, color: colors.brand.text },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  linkText: { ...typography.body, fontWeight: '600' },
  empty: {
    ...typography.body,
    color: colors.brand.textSecondary,
    marginTop: spacing.lg,
  },
  list: { marginTop: spacing.md, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  rowTitle: { ...typography.body, color: colors.brand.text, fontWeight: '600' },
  rowMeta: { ...typography.caption, color: colors.brand.textSecondary },
});
