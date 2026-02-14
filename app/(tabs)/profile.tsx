import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Settings, Calendar, Award, BarChart3 } from 'lucide-react-native';
import { useAuth } from '../../src/hooks';
import { AppBackground, Avatar, Button, Card, colors, radius, spacing, typography } from '@/components/ui/v2';
import { getRoleLabel, getRoleBadgeColor } from '../../src/utils/roleHelpers';
import { EventsService } from '../../src/services/events.service';
import type { EventWithCreator } from '../../src/types/database';
import { GuestGateModal } from '../../src/components/auth/GuestGateModal';
import { supabase } from '../../src/lib/supabase/client';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut, session } = useAuth();
  const isGuest = !session;
  const [myEvents, setMyEvents] = useState<EventWithCreator[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [lumoBalance, setLumoBalance] = useState<number | null>(null);
  const [loadingLumo, setLoadingLumo] = useState(false);
  const sheetTranslate = useRef(new Animated.Value(300)).current;

  const handleSignOut = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const handleViewMyEvents = () => {
    router.push('/profile/my-events' as any);
  };

  const closeSheet = () => {
    Animated.timing(sheetTranslate, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSheetVisible(false));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gesture) => {
        if (gesture.dy > 0) {
          sheetTranslate.setValue(Math.min(gesture.dy, 300));
        }
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.7) {
          closeSheet();
        } else {
          Animated.timing(sheetTranslate, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const loadMyEvents = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingEvents(true);
    try {
      const data = await EventsService.listEventsByCreator(profile.id);
      setMyEvents(data);
    } catch (e) {
      console.warn('loadMyEvents error', e);
    } finally {
      setLoadingEvents(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    const loadWallet = async () => {
      if (!profile?.id) return;
      setLoadingLumo(true);
      try {
        const { data, error } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', profile.id)
          .maybeSingle();
        if (error) {
          console.warn('loadWallet error', error);
          setLumoBalance(null);
          return;
        }
        const wallet = data as { balance?: number } | null;
        setLumoBalance(typeof wallet?.balance === 'number' ? wallet.balance : null);
      } catch (err) {
        console.warn('loadWallet error', err);
        setLumoBalance(null);
      } finally {
        setLoadingLumo(false);
      }
    };

    loadWallet();
  }, [profile?.id]);

  useEffect(() => {
    if (!sheetVisible) return;
    loadMyEvents();
  }, [loadMyEvents, sheetVisible]);

  if (isGuest) {
    return (
      <View style={styles.container}>
        <AppBackground opacity={0.2} />
        <GuestGateModal
          visible
          title="Accéder à votre profil"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <AppBackground opacity={0.2} />
        <View style={styles.fallback}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground opacity={0.2} />
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          {profile.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.surfaceLevel2 }]} />
          )}
          <View style={styles.headerOverlay}>
            <Avatar uri={profile.avatar_url} name={profile.display_name} size={100} style={styles.avatar} />
            <Text style={styles.displayName}>{profile.display_name}</Text>
            <Text style={styles.email}>{profile.email}</Text>
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: getRoleBadgeColor(profile.role).bg },
              ]}
            >
              <Award size={14} color={getRoleBadgeColor(profile.role).text} />
              <Text
                style={[
                  styles.roleText,
                  { color: getRoleBadgeColor(profile.role).text },
                ]}
              >
                {getRoleLabel(profile.role)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/profile/edit' as any)}
              accessibilityRole="button"
            >
              <Settings size={20} color={colors.primary} />
              <Text style={styles.editButtonText}>Modifier le profil</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <Card padding="md">
            <Text style={styles.sectionTitle}>Informations</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Rôle</Text>
              <Text style={styles.infoValue}>{getRoleLabel(profile.role)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Onboarding</Text>
              <Text style={styles.infoValue}>
                {profile.onboarding_completed ? '✓ Terminé' : '○ En cours'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lumo</Text>
              <Text style={styles.infoValue}>
                {loadingLumo ? '...' : lumoBalance ?? 0}
              </Text>
            </View>
          </Card>

          <Card padding="md" style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/creator' as any)}>
              <BarChart3 size={18} color={colors.primary} />
              <Text style={styles.linkText}>Espace créateur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={handleViewMyEvents}>
              <Calendar size={18} color={colors.primary} />
              <Text style={styles.linkText}>Mes événements</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/onboarding' as any)}>
              <Award size={18} color={colors.primary} />
              <Text style={styles.linkText}>Recommencer l'onboarding</Text>
            </TouchableOpacity>
          </Card>

          {(profile.role === 'moderateur' || profile.role === 'admin') && (
            <Card padding="md" style={styles.actionCard}>
              <Text style={styles.sectionTitle}>Modération</Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.push('/moderation' as any)}
              >
                <Award size={18} color={colors.danger} />
                <Text style={styles.linkText}>Accès modération</Text>
              </TouchableOpacity>
            </Card>
          )}

          <Button
            title="Se déconnecter"
            onPress={handleSignOut}
            variant="outline"
            fullWidth
            style={styles.signOutButton}
          />
        </View>
      </ScrollView>

      {sheetVisible && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeSheet} />
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetTranslate }] }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Mes événements</Text>
              <TouchableOpacity onPress={closeSheet}>
                <Text style={styles.closeText}>Fermer</Text>
              </TouchableOpacity>
            </View>
            {loadingEvents ? (
              <View style={styles.loadingEvents}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : myEvents.length === 0 ? (
              <Text style={styles.emptySheetText}>Aucun événement créé</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {myEvents.map((event) => {
                  const isDraft = event.status === 'draft';
                  const now = new Date();
                  const startDate = event.starts_at ? new Date(event.starts_at) : null;
                  const endDate = event.ends_at ? new Date(event.ends_at) : null;
                  let timeLabel: string | null = null;
                  if (!isDraft && startDate && !isNaN(startDate.getTime())) {
                    if (endDate && !isNaN(endDate.getTime()) && endDate < now) {
                      timeLabel = 'Passé';
                    } else if (startDate > now) {
                      timeLabel = 'À venir';
                    } else {
                      timeLabel = 'En cours';
                    }
                  }
                  return (
                  <Card key={event.id} padding="md" style={{ marginBottom: spacing.sm }}>
                    <TouchableOpacity
                      onPress={() =>
                        router.push(
                          (isDraft ? `/events/create/step-1?edit=${event.id}` : `/events/${event.id}`) as any
                        )
                      }
                    >
                      <View style={styles.eventTitleRow}>
                        <Text style={styles.eventTitle}>{event.title || 'Brouillon sans titre'}</Text>
                        {isDraft && <Text style={styles.eventDraft}>Brouillon</Text>}
                        {!isDraft && timeLabel && (
                          <Text
                            style={[
                              styles.eventStatus,
                              timeLabel === 'Passé' && styles.eventStatusPast,
                              timeLabel === 'En cours' && styles.eventStatusLive,
                              timeLabel === 'À venir' && styles.eventStatusUpcoming,
                            ]}
                          >
                            {timeLabel}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.eventMeta}>{event.city || event.address || ''}</Text>
                    </TouchableOpacity>
                  </Card>
                );
                })}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: colors.surfaceLevel1,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  cover: {
    width: '100%',
    height: 180,
    opacity: 0.45,
  },
  headerOverlay: {
    alignItems: 'center',
    marginTop: -60,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    marginBottom: spacing.md,
  },
  displayName: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  roleText: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceCard,
  },
  editButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actionCard: {
    marginTop: 0,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  signOutButton: {
    marginTop: spacing.lg,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  sheetOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surfaceLevel1,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
  },
  closeText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  loadingEvents: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  emptySheetText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  eventTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eventDraft: {
    ...typography.caption,
    color: colors.background,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  eventStatus: {
    ...typography.caption,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  eventStatusPast: {
    color: colors.textSecondary,
    backgroundColor: colors.surfaceLevel2,
  },
  eventStatusLive: {
    color: colors.background,
    backgroundColor: colors.success,
  },
  eventStatusUpcoming: {
    color: colors.background,
    backgroundColor: colors.primary,
  },
  eventMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
