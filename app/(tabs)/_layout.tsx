import { Tabs, Redirect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { AppBackground } from '@/components/ui';
import {
  Map,
  Home,
  Users,
  User,
  Bell,
  PlusCircle,
  UserCircle2,
  Heart,
  Bug,
  Settings,
  LogOut,
  MapPinned,
  Compass,
  Crown,
  Trophy,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Animated, Pressable, Text, ScrollView } from 'react-native';
import { colors } from '../../src/constants/theme';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { CONTESTS_ENABLED } from '@/config/contests.flags';
import { PremiumAvatarFrame } from '@/components/premium/PremiumAvatarFrame';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import { useAuth } from '../../src/hooks';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { NotificationsService } from '@/services/notifications.service';
import { EventsService } from '@/services/events.service';
export default function TabsLayout() {
  const { isLoading, isAuthenticated, profile, signOut } = useAuth();
  const { isPremium } = usePremiumEntitlement();
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guestGate, setGuestGate] = useState({ visible: false, title: '' });
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [hasMyEventsShortcut, setHasMyEventsShortcut] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  useTaxonomy();
  const isGuest = !isAuthenticated;

  const openGuestGate = (title: string) => setGuestGate({ visible: true, title });
  const closeGuestGate = () => setGuestGate({ visible: false, title: '' });

  const loadUnreadNotifications = useCallback(async () => {
    if (!profile?.id) {
      setUnreadNotifications(0);
      return;
    }
    try {
      const count = await NotificationsService.getUnreadCount();
      setUnreadNotifications(count);
    } catch {
      setUnreadNotifications(0);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadUnreadNotifications();
  }, [loadUnreadNotifications]);

  useEffect(() => {
    if (!profile?.id) return;
    return NotificationsService.subscribeToMyNotifications(profile.id, () => {
      loadUnreadNotifications();
    });
  }, [profile?.id, loadUnreadNotifications]);

  useEffect(() => {
    return NotificationsService.subscribeToLocalChanges(() => {
      loadUnreadNotifications();
    });
  }, [loadUnreadNotifications]);

  const loadMyEventsShortcut = useCallback(async () => {
    if (!profile?.id || isGuest) {
      setHasMyEventsShortcut(false);
      return;
    }

    try {
      const events = await EventsService.listEvents({ creatorId: profile.id, limit: 1 } as any);
      setHasMyEventsShortcut(events.length > 0);
    } catch {
      setHasMyEventsShortcut(false);
    }
  }, [profile?.id, isGuest]);

  useEffect(() => {
    if (!drawerOpen) return;
    loadMyEventsShortcut();
  }, [drawerOpen, loadMyEventsShortcut]);

  const toggleDrawer = (open: boolean) => {
    setDrawerOpen(open);
    Animated.timing(slideAnim, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const drawerTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const tabIconColor = (focused: boolean, disabled = false) => {
    if (disabled) return colors.brand.textSecondary;
    return focused ? colors.brand.secondary : colors.brand.textSecondary;
  };

  const renderTabIconSlot = (focused: boolean, content: React.ReactNode) => (
    <View style={[styles.tabIconSlot, focused && styles.tabIconSlotActive]}>{content}</View>
  );

  const renderProtectedTabButton = (
    props: any,
    gateTitle: string,
    onAllowed?: () => void
  ) => {
    const {
      style,
      onPress,
      onLongPress,
      children,
      accessibilityState,
      accessibilityLabel,
      testID,
    } = props;

    return (
      <TouchableOpacity
        style={[style, isGuest && styles.tabDisabled]}
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onLongPress={onLongPress || undefined}
        onPress={() => {
          if (isGuest) {
            openGuestGate(gateTitle);
            return;
          }
          if (onAllowed) {
            onAllowed();
            return;
          }
          onPress?.();
        }}
      >
        {children}
      </TouchableOpacity>
    );
  };

  if (isLoading || (isAuthenticated && !profile)) {
    return (
      <View style={styles.container}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.brand.secondary} />
      </View>
    );
  }

  if (profile && !profile.onboarding_completed && isAuthenticated) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <Tabs
        initialRouteName="map"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand.secondary,
          tabBarInactiveTintColor: colors.brand.textSecondary,
          tabBarShowLabel: false,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle: {
            backgroundColor: colors.brand.primary,
            borderTopColor: 'rgba(255,255,255,0.05)',
            height: 76,
            paddingBottom: 8,
            paddingTop: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ focused, size }) =>
              renderTabIconSlot(
                focused,
                <Home size={size} color={tabIconColor(focused, isGuest)} strokeWidth={focused ? 2.4 : 2} />
              ),
            tabBarButton: (props) => renderProtectedTabButton(props, "Accéder à l'accueil"),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Carte',
            tabBarIcon: ({ focused, size }) =>
              renderTabIconSlot(
                focused,
                <Map size={size} color={tabIconColor(focused)} strokeWidth={focused ? 2.4 : 2} />
              ),
            tabBarStyle: {
              backgroundColor: colors.brand.primary,
              borderTopWidth: 0,
              borderTopColor: 'transparent',
              elevation: 0,
              shadowOpacity: 0,
              height: 76,
              paddingBottom: 8,
              paddingTop: 8,
            },
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: '',
            tabBarButton: () => (
              <TouchableOpacity
                style={[styles.createButton, isGuest && styles.createButtonDisabled]}
                activeOpacity={0.85}
                onPress={() => {
                  if (isGuest) {
                    openGuestGate('Créer un événement');
                    return;
                  }
                  router.push('/events/create/step-1' as any);
                }}
              >
                <PlusCircle size={28} color="#0f1719" />
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: 'Favoris',
            tabBarIcon: ({ focused, size }) =>
              renderTabIconSlot(
                focused,
                <Heart size={size} color={tabIconColor(focused, isGuest)} strokeWidth={focused ? 2.4 : 2} />
              ),
            tabBarButton: (props) => renderProtectedTabButton(props, 'Accéder à vos favoris'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ focused, size }) =>
              renderTabIconSlot(
                focused,
                <View style={styles.profileTabIconWrap}>
                  {profile?.avatar_url ? (
                    <PremiumAvatarFrame isPremium={isPremium} size={26} showBadge={false}>
                      <Image
                        source={{ uri: profile.avatar_url }}
                        style={[styles.tabAvatar, focused && !isPremium && styles.tabAvatarActive]}
                      />
                    </PremiumAvatarFrame>
                  ) : (
                    <User size={size} color={tabIconColor(focused, isGuest)} strokeWidth={focused ? 2.4 : 2} />
                  )}
                  {unreadNotifications > 0 ? (
                    <View style={styles.profileTabBadge}>
                      <Text style={styles.profileTabBadgeText}>
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ),
            tabBarButton: (props) =>
              renderProtectedTabButton(props, 'Accéder à votre profil', () => toggleDrawer(true)),
          }}
        />
        {/* Routes masquées du tab bar mais toujours accessibles */}
        <Tabs.Screen name="shop" options={{ href: null }} />
        <Tabs.Screen name="community" options={{ href: null }} />
        <Tabs.Screen name="missions" options={{ href: null }} />
      </Tabs>

      {drawerOpen && (
        <Pressable style={styles.backdrop} onPress={() => toggleDrawer(false)} />
      )}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: drawerTranslate }],
          },
        ]}
      >
        {/* User Header Section */}
        <View style={styles.drawerHeader}>
          <View style={styles.drawerUserRow}>
            <TouchableOpacity
              style={styles.avatarContainer}
              activeOpacity={0.85}
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/profile' as any);
              }}
            >
              <PremiumAvatarFrame isPremium={isPremium} size={56}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.drawerAvatar} />
                ) : (
                  <View style={styles.drawerAvatarPlaceholder}>
                    <UserCircle2 size={32} color={colors.neutral[400]} />
                  </View>
                )}
              </PremiumAvatarFrame>
            </TouchableOpacity>
            <View style={styles.drawerIdentity}>
              <Text style={styles.drawerName}>{profile?.display_name || 'Profil'}</Text>
              {isPremium ? (
                <View style={styles.drawerPremiumPill}>
                  <Crown size={12} color={colors.brand.primary} strokeWidth={2.5} />
                  <Text style={styles.drawerPremiumText}>Moments Locaux+</Text>
                </View>
              ) : null}
              <Text style={styles.drawerEmail}>{profile?.email || 'Compte connecté'}</Text>
            </View>
          </View>
        </View>

        {/* Scrollable Menu Content */}
        <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
          {/* Section: Découverte */}
          <View style={styles.drawerSection}>
            <Text style={styles.sectionTitle}>DÉCOUVERTE</Text>
            {DISCOVERY_ENABLED && (
              <DrawerLink
                icon={Compass}
                label="Discovery"
                iconColor={isPremium ? colors.brand.premiumLight : undefined}
                premium={isPremium}
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/discovery' as any);
                }}
              />
            )}
            {CONTESTS_ENABLED && (
              <DrawerLink
                icon={Trophy}
                label="Concours"
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/contests' as any);
                }}
              />
            )}
            <DrawerLink
              icon={PlusCircle}
              label="Créer un événement"
              onPress={() => {
                toggleDrawer(false);
                router.push('/events/create/step-1' as any);
              }}
            />
            <DrawerLink
              icon={User}
              label="Mon profil"
              active
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/profile' as any);
              }}
            />
            <DrawerLink
              icon={Users}
              label="Communauté"
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/community' as any);
              }}
            />
          </View>

          {/* Section: Compte */}
          <View style={styles.drawerSection}>
            <Text style={styles.sectionTitle}>COMPTE</Text>
            <DrawerLink
              icon={Settings}
              label="Paramètres"
              onPress={() => {
                toggleDrawer(false);
                router.push('/settings' as any);
              }}
            />
            <DrawerLink
              icon={Bell}
              label="Notifications"
              badgeCount={unreadNotifications}
              onPress={() => {
                toggleDrawer(false);
                router.push('/notifications' as any);
              }}
            />
          </View>

          {/* Section: Activité */}
          <View style={styles.drawerSection}>
            <Text style={styles.sectionTitle}>ACTIVITÉ</Text>
            <DrawerLink
              icon={Heart}
              label="Mes favoris"
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/favorites' as any);
              }}
            />
            {hasMyEventsShortcut && (
              <DrawerLink
                icon={MapPinned}
                label="Mes événements"
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/profile/my-events' as any);
                }}
              />
            )}
          </View>

          {!isGuest ? (
            <View style={styles.drawerSection}>
              <Text style={styles.sectionTitle}>ASSISTANCE</Text>
              <DrawerLink
                icon={Bug}
                label="Reporter un bug"
                iconColor={colors.error[400]}
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/bug-report' as any);
                }}
              />
            </View>
          ) : null}
        </ScrollView>

        {/* Footer / Logout */}
        <View style={styles.drawerFooter}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await signOut();
              toggleDrawer(false);
              router.replace('/auth/login' as any);
            }}
          >
            <LogOut size={20} color={colors.neutral[400]} />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Version {appVersion} • Moments Locaux</Text>
        </View>
      </Animated.View>

      <GuestGateModal
        visible={guestGate.visible}
        title={guestGate.title}
        onClose={closeGuestGate}
        onSignUp={() => {
          closeGuestGate();
          router.push('/auth/register' as any);
        }}
        onSignIn={() => {
          closeGuestGate();
          router.push('/auth/login' as any);
        }}
      />
    </>
  );
}

const DrawerLink = ({
  icon: IconCmp,
  label,
  onPress,
  active,
  badgeCount,
  iconColor,
  premium,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  active?: boolean;
  badgeCount?: number;
  iconColor?: string;
  premium?: boolean;
}) => (
  <TouchableOpacity
    style={[
      styles.linkRow,
      active && styles.linkRowActive,
      premium && styles.linkRowPremium,
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <IconCmp
      size={20}
      color={iconColor || (active ? colors.brand.secondary : 'rgba(255,255,255,0.7)')}
      strokeWidth={2}
    />
    <View style={styles.linkLabelWrapper}>
      <Text style={[styles.linkLabel, active && styles.linkLabelActive, premium && styles.linkLabelPremium]}>
        {label}
      </Text>
    </View>
    {typeof badgeCount === 'number' && badgeCount > 0 ? (
      <View style={styles.linkBadge}>
        <Text style={styles.linkBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
      </View>
    ) : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.brand.primary,
  },
  tabAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  tabAvatarActive: {
    borderWidth: 2,
    borderColor: colors.brand.secondary,
  },
  tabIconSlot: {
    minWidth: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  tabIconSlotActive: {
    backgroundColor: 'rgba(43, 191, 227, 0.18)',
  },
  profileTabIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTabBadge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.error,
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  profileTabBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 10,
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '78%',
    backgroundColor: '#0f1719', // Deep dark brand background
    padding: 0, // Reset padding to handle footer correctly
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
  },

  drawerHeader: {
    paddingTop: 60, // Safe area
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  drawerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  drawerAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerIdentity: {
    flex: 1,
    justifyContent: 'center',
  },
  drawerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  drawerEmail: {
    fontSize: 13,
    color: '#587588', // Muted slate blue/grey
  },
  drawerPremiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.brand.premiumLight,
    borderWidth: 1,
    borderColor: colors.brand.premiumBorder,
  },
  drawerPremiumText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand.primary,
    letterSpacing: 0.3,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 2,
    marginHorizontal: 16,
  },
  linkLabelWrapper: {
    flex: 1,
    marginLeft: 14,
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94a3b8',
  },
  linkBadge: {
    backgroundColor: '#2bbfe3',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
  },
  drawerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarBorder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#2bbfe3',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRowPremium: {
    borderWidth: 1,
    borderColor: colors.brand.premiumBorder,
    backgroundColor: colors.brand.premiumMuted,
    borderRadius: 12,
  },
  linkLabelPremium: {
    color: colors.brand.premiumLight,
    fontWeight: '700',
  },
  drawerScroll: {
    flex: 1,
    marginTop: 8,
  },
  drawerScrollContent: {
    paddingBottom: 40,
    gap: 32,
  },
  drawerSection: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#325868', // Dark Cyan/Blue specific to Stitch design
    marginBottom: 8,
    marginLeft: 24,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  linkRowActive: {
    backgroundColor: 'rgba(43, 191, 227, 0.15)', // More visible active bg
    borderRadius: 12,
  },
  linkLabelActive: {
    color: '#2bbfe3',
    fontWeight: '700',
  },
  drawerFooter: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    padding: 24,
    backgroundColor: '#0b1113', // Slightly darker footer
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#162024',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logoutText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 10,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  createButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 4,
    borderColor: colors.brand.primary, // Add border to match dark background
  },
  createButtonDisabled: {
    backgroundColor: colors.brand.surface,
  },
  tabDisabled: {
    opacity: 0.5,
  },
});
