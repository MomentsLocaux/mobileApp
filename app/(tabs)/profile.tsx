import React, { useEffect, useRef, useState } from 'react';
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
import { Settings, User as UserIcon, MapPin, Calendar, Award, LogOut } from 'lucide-react-native';
import { Button, Card } from '../../src/components/ui';
import { useAuth } from '../../src/hooks';
import { colors, spacing, typography, borderRadius } from '../../src/constants/theme';
import { getRoleLabel, getRoleBadgeColor } from '../../src/utils/roleHelpers';
import { EventsService } from '../../src/services/events.service';
import type { EventWithCreator } from '../../src/types/database';
import { useI18n } from '@/contexts/I18nProvider';
import { t } from '@/i18n/translations';
import { LanguageSwitcher } from '@/components/profile/LanguageSwitcher';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { locale } = useI18n();
  const [myEvents, setMyEvents] = useState<EventWithCreator[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const sheetTranslate = useRef(new Animated.Value(300)).current;

  const handleSignOut = async () => {
    Alert.alert(
      t('profile', 'logout', locale),
      t('profile', 'logoutConfirm', locale),
      [
        { text: t('common', 'cancel', locale), style: 'cancel' },
        {
          text: t('profile', 'logout', locale),
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
    if (!profile?.id) return;
    setSheetVisible(true);
    loadMyEvents();
    Animated.timing(sheetTranslate, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
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

  const loadMyEvents = async () => {
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
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.fallback}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          {profile.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.neutral[200] }]} />
          )}
          <View style={styles.headerOverlay}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <UserIcon size={40} color={colors.neutral[0]} />
              </View>
            )}
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
            >
              <Settings size={20} color={colors.primary[600]} />
              <Text style={styles.editButtonText}>Modifier le profil</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <Card padding="md">
            <Text style={styles.sectionTitle}>{t('profile', 'info', locale)}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('profile', 'role', locale)}</Text>
              <Text style={styles.infoValue}>{getRoleLabel(profile.role)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('profile', 'onboarding', locale)}</Text>
              <Text style={styles.infoValue}>
                {profile.onboarding_completed ? t('profile', 'onboardingDone', locale) : t('profile', 'onboardingPending', locale)}
              </Text>
            </View>
            <LanguageSwitcher />
          </Card>

          <Card padding="md" style={styles.actionCard}>
            <Text style={styles.sectionTitle}>{t('profile', 'actions', locale)}</Text>
            <TouchableOpacity style={styles.linkButton} onPress={handleViewMyEvents}>
              <Calendar size={18} color={colors.primary[600]} />
              <Text style={styles.linkText}>{t('profile', 'myEvents', locale)}</Text>
            </TouchableOpacity>
          </Card>

          {(profile.role === 'moderateur' || profile.role === 'admin') && (
            <Card padding="md" style={styles.actionCard}>
              <Text style={styles.sectionTitle}>{t('profile', 'moderation', locale)}</Text>
              <TouchableOpacity style={styles.linkButton}>
                <Award size={18} color={colors.secondary[600]} />
                <Text style={styles.linkText}>{t('profile', 'moderationAccess', locale)}</Text>
              </TouchableOpacity>
            </Card>
          )}

          <Button
            title={t('profile', 'logout', locale)}
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
              <Text style={styles.sheetTitle}>{t('profile', 'myEvents', locale)}</Text>
              <TouchableOpacity onPress={closeSheet}>
                <Text style={styles.closeText}>{t('profile', 'close', locale)}</Text>
              </TouchableOpacity>
            </View>
            {loadingEvents ? (
              <View style={styles.loadingEvents}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
              </View>
            ) : myEvents.length === 0 ? (
              <Text style={styles.emptySheetText}>{t('profile', 'noEvents', locale)}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {myEvents.map((event) => (
                  <Card key={event.id} padding="md" style={{ marginBottom: spacing.sm }}>
                    <TouchableOpacity onPress={() => router.push(`/events/${event.id}` as any)}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventMeta}>{event.city || event.address || ''}</Text>
                    </TouchableOpacity>
                  </Card>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    backgroundColor: colors.neutral[50],
  },
  cover: {
    width: '100%',
    height: 180,
  },
  headerOverlay: {
    alignItems: 'center',
    marginTop: -60,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  displayName: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.neutral[700],
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
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
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  editButtonText: {
    ...typography.body,
    color: colors.primary[600],
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  infoValue: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  actionCard: {
    marginTop: spacing.md,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.primary[600],
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
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
  sheetOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
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
    ...typography.h4,
    color: colors.neutral[900],
  },
  closeText: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
  },
  loadingEvents: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  emptySheetText: {
    ...typography.body,
    color: colors.neutral[600],
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  eventTitle: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  eventMeta: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginTop: 2,
  },
});
