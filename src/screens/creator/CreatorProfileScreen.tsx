import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Home, MapPin, User } from 'lucide-react-native';
import { EventCard } from '@/components/events';
import {
  Avatar,
  Button,
  Card,
  ScreenLayout,
  TopBar,
  Typography,
  colors,
  radius,
  spacing,
} from '@/components/ui/v2';
import { ProfileService } from '@/services/profile.service';
import { EventsService } from '@/services/events.service';
import { getRoleLabel } from '@/utils/roleHelpers';
import type { Profile, EventWithCreator } from '@/types/database';

export default function CreatorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const router = useRouter();

  const creatorId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

  const [creator, setCreator] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCreatorProfile();
  }, [creatorId]);

  const loadCreatorProfile = async () => {
    if (!creatorId) {
      setLoading(false);
      setCreator(null);
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const [profileData, eventsData] = await Promise.all([
        ProfileService.getProfile(creatorId),
        EventsService.listEventsByCreator(creatorId),
      ]);

      setCreator(profileData);
      setEvents(eventsData);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenLayout
        scroll={false}
        header={<TopBar title="Profil créateur" onBack={() => router.back()} />}
        contentContainerStyle={styles.centered}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenLayout>
    );
  }

  if (!creator) {
    return (
      <ScreenLayout
        scroll={false}
        header={<TopBar title="Profil créateur" onBack={() => router.back()} />}
        contentContainerStyle={styles.centered}
      >
        <Card padding="lg" style={styles.errorCard}>
          <Typography variant="subsection" color={colors.textPrimary} weight="700">
            Profil introuvable
          </Typography>
          <Typography variant="body" color={colors.textSecondary}>
            Ce profil créateur n&apos;est pas disponible pour le moment.
          </Typography>
          <Button
            title="Retour"
            variant="secondary"
            onPress={() => router.back()}
            accessibilityRole="button"
          />
        </Card>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      header={
        <TopBar
          title="Profil créateur"
          onBack={() => router.back()}
          rightSlot={
            <Button
              title="Accueil"
              size="sm"
              variant="secondary"
              onPress={() => router.replace('/(tabs)' as any)}
              leftSlot={<Home size={14} color={colors.textPrimary} />}
              accessibilityRole="button"
            />
          }
        />
      }
      contentContainerStyle={styles.content}
    >
      <Card padding="lg" style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Avatar
            uri={creator.avatar_url}
            name={creator.display_name}
            size={92}
            badge={
              <View style={styles.badgeWrap}>
                <Typography variant="caption" color={colors.background} weight="700">
                  CR
                </Typography>
              </View>
            }
          />

          <View style={styles.profileTextWrap}>
            <Typography variant="sectionTitle" color={colors.textPrimary} weight="700" numberOfLines={1}>
              {creator.display_name}
            </Typography>

            <Typography variant="body" color={colors.primary} weight="600">
              {getRoleLabel(creator.role)}
            </Typography>

            {creator.city ? (
              <View style={styles.metaRow}>
                <MapPin size={14} color={colors.textSecondary} />
                <Typography variant="caption" color={colors.textSecondary}>
                  {creator.city}
                </Typography>
              </View>
            ) : null}
          </View>
        </View>

        {creator.bio ? (
          <Typography variant="body" color={colors.textSecondary} style={styles.bio}>
            {creator.bio}
          </Typography>
        ) : null}
      </Card>

      <View style={styles.sectionHeader}>
        <Typography variant="subsection" color={colors.textPrimary} weight="700">
          Événements créés ({events.length})
        </Typography>
      </View>

      {events.length === 0 ? (
        <Card padding="lg" style={styles.emptyCard}>
          <View style={styles.emptyRow}>
            <User size={16} color={colors.textMuted} />
            <Typography variant="body" color={colors.textSecondary}>
              Aucun événement créé pour le moment
            </Typography>
          </View>
        </Card>
      ) : (
        events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onPress={() => router.push(`/events/${event.id}` as any)}
          />
        ))
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  errorCard: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
  },
  profileCard: {
    gap: spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badgeWrap: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileTextWrap: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  bio: {
    lineHeight: 24,
  },
  sectionHeader: {
    gap: 2,
  },
  emptyCard: {
    minHeight: 88,
    justifyContent: 'center',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
