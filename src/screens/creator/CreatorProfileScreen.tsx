import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { User, MapPin, Calendar } from 'lucide-react-native';
import { Card, AppBackground, ScreenHeader } from '../../components/ui';
import { EventCard } from '../../components/events';
import { ProfileService } from '../../services/profile.service';
import { EventsService } from '../../services/events.service';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getRoleLabel } from '../../utils/roleHelpers';
import type { Profile, EventWithCreator } from '../../types/database';

export default function CreatorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [creator, setCreator] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCreatorProfile();
  }, [id]);

  const loadCreatorProfile = async () => {
    if (!id) return;

    const [profileData, eventsData] = await Promise.all([
      ProfileService.getProfile(id),
      EventsService.listEventsByCreator(id),
    ]);

    setCreator(profileData);
    setEvents(eventsData);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Profil introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Profil créateur"
          onBack={() => router.back()}
          right={(
            <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(tabs)' as any)}>
              <Text style={styles.homeText}>Accueil</Text>
            </TouchableOpacity>
          )}
        />
        <View style={styles.header}>
          {creator.avatar_url ? (
            <Image source={{ uri: creator.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <User size={48} color={colors.brand.textSecondary} />
            </View>
          )}

          <Text style={styles.displayName}>{creator.display_name}</Text>
          <Text style={styles.role}>{getRoleLabel(creator.role)}</Text>

          {creator.bio && (
            <Text style={styles.bio}>{creator.bio}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Événements créés ({events.length})
          </Text>

          {events.length === 0 ? (
            <Card padding="lg">
              <Text style={styles.emptyText}>
                Aucun événement créé pour le moment
              </Text>
            </Card>
          ) : (
            events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/events/${event.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error[400],
  },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  homeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  homeText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    ...typography.h2,
    color: colors.brand.text,
    marginBottom: spacing.xs,
  },
  role: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    textTransform: 'capitalize',
    marginBottom: spacing.md,
  },
  bio: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.brand.text,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
});
