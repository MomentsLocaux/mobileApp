import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { User, MapPin, Calendar } from 'lucide-react-native';
import { Card } from '../../components/ui';
import { EventCard } from '../../components/events';
import { ProfileService } from '../../services/profile.service';
import { EventsService } from '../../services/events.service';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
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
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Créateur introuvable</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        {creator.avatar_url ? (
          <Image source={{ uri: creator.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <User size={48} color={colors.neutral[400]} />
          </View>
        )}

        <Text style={styles.displayName}>{creator.display_name}</Text>
        <Text style={styles.role}>{creator.role}</Text>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error[500],
  },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  role: {
    ...typography.bodySmall,
    color: colors.primary[600],
    textTransform: 'capitalize',
    marginBottom: spacing.md,
  },
  bio: {
    ...typography.body,
    color: colors.neutral[600],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
