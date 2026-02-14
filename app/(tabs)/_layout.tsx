import { Tabs, Redirect, useRouter } from 'expo-router';
import {
  Map,
  Home,
  Users,
  User,
  Bell,
  PlusCircle,
  Send,
  Compass,
  UserCircle2,
  Target,
  Heart,
  ShoppingBag,
  Bug,
  Settings,
  BarChart3,
  Coins,
  LogOut,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Pressable,
  Text,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, radius, shadows, spacing } from '@/components/ui/v2';
import { useAuth } from '../../src/hooks';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { NotificationsService } from '@/services/notifications.service';
import { EventsService } from '@/services/events.service';
import { DrawerItem } from '@/components/ui/v2/navigation';

export default function TabsLayout() {
  const { isLoading, isAuthenticated, profile, signOut } = useAuth();
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

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          toggleDrawer(false);
          router.replace('/auth/login' as any);
        },
      },
    ]);
  };

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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingTop: 4,
          },
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.borderSubtle,
            borderTopWidth: 1,
            height: 86,
            paddingBottom: 8,
            paddingTop: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ size, color, focused }) => (
              <View style={[styles.tabIconShell, focused && styles.tabIconShellActive]}>
                <Home size={size} color={isGuest ? colors.textMuted : color} />
              </View>
            ),
            tabBarButton: (props) => renderProtectedTabButton(props, "Accéder à l'accueil"),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Carte',
            tabBarIcon: ({ size, color, focused }) => (
              <View style={[styles.tabIconShell, focused && styles.tabIconShellActive]}>
                <Map size={size} color={color} />
              </View>
            ),
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
                <PlusCircle size={28} color={colors.background} />
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Communauté',
            tabBarIcon: ({ size, color, focused }) => (
              <View style={[styles.tabIconShell, focused && styles.tabIconShellActive]}>
                <Users size={size} color={isGuest ? colors.textMuted : color} />
              </View>
            ),
            tabBarButton: (props) => renderProtectedTabButton(props, 'Accéder à la communauté'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ size, color, focused }) => (
              <View style={[styles.profileTabIconWrap, focused && styles.tabIconShellActive]}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.tabAvatar} />
                ) : (
                  <User size={size} color={isGuest ? colors.textMuted : color} />
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
        <Tabs.Screen name="favorites" options={{ href: null }} />
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
        <ScrollView contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.drawerHeader}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.drawerAvatar} />
            ) : (
              <View style={styles.drawerAvatarPlaceholder}>
                <UserCircle2 size={32} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.drawerIdentity}>
              <Text style={styles.drawerName}>{profile?.display_name || 'Profil'}</Text>
              {profile?.email ? <Text style={styles.drawerEmail}>{profile.email}</Text> : null}
            </View>
          </View>

          <TouchableOpacity
            style={styles.walletCard}
            activeOpacity={0.85}
            onPress={() => {
              toggleDrawer(false);
              router.push('/(tabs)/shop' as any);
            }}
          >
            <Coins size={20} color={colors.primary} />
            <View style={styles.walletCopy}>
              <Text style={styles.walletTitle}>Lumo Coins</Text>
              <Text style={styles.walletSubtitle}>Accéder à la boutique</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.drawerSectionTitle}>DÉCOUVERTE</Text>
          <View style={styles.drawerLinks}>
            <DrawerItem
              icon={PlusCircle}
              label="Créer un évènement"
              onPress={() => {
                toggleDrawer(false);
                router.push('/events/create/step-1' as any);
              }}
            />
            <DrawerItem
              icon={User}
              label="Mon profil"
              highlight
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/profile' as any);
              }}
            />
            <DrawerItem
              icon={BarChart3}
              label="Espace créateur"
              onPress={() => {
                toggleDrawer(false);
                router.push('/creator' as any);
              }}
            />
          </View>

          <Text style={styles.drawerSectionTitle}>COMPTE</Text>
          <View style={styles.drawerLinks}>
            <DrawerItem
              icon={ShoppingBag}
              label="Offres & abonnements"
              onPress={() => {
                toggleDrawer(false);
                router.push('/profile/offers' as any);
              }}
            />
            <DrawerItem
              icon={Settings}
              label="Paramètres"
              onPress={() => {
                toggleDrawer(false);
                router.push('/settings/index' as any);
              }}
            />
            <DrawerItem
              icon={Bell}
              label="Notifications"
              badgeCount={unreadNotifications}
              onPress={() => {
                toggleDrawer(false);
                router.push('/notifications' as any);
              }}
            />
            <DrawerItem
              icon={Send}
              label="Inviter des amis"
              onPress={() => {
                toggleDrawer(false);
                router.push('/profile/invite' as any);
              }}
            />
          </View>

          <Text style={styles.drawerSectionTitle}>ACTIVITÉ</Text>
          <View style={styles.drawerLinks}>
            <DrawerItem
              icon={Compass}
              label="Mon parcours"
              onPress={() => {
                toggleDrawer(false);
                router.push('/profile/journey' as any);
              }}
            />
            <DrawerItem
              icon={Target}
              label="Missions"
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/missions' as any);
              }}
            />
            {hasMyEventsShortcut && (
              <DrawerItem
                icon={Map}
                label="Mes évènements"
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/profile/my-events' as any);
                }}
              />
            )}
            <DrawerItem
              icon={ShoppingBag}
              label="Boutique"
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/shop' as any);
              }}
            />
            <DrawerItem
              icon={Heart}
              label="Mes favoris"
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/favorites' as any);
              }}
            />
            <DrawerItem
              icon={Bug}
              label="Reporter un bug"
              onPress={() => {
                toggleDrawer(false);
                router.push('/bug-report' as any);
              }}
            />
            <DrawerItem
              icon={BarChart3}
              label="Preview Event UI (temp)"
              onPress={() => {
                toggleDrawer(false);
                router.push('/events/ui-preview' as any);
              }}
            />
          </View>

          {(profile?.role === 'moderateur' || profile?.role === 'admin') && (
            <>
              <Text style={styles.drawerSectionTitle}>MODÉRATION</Text>
              <View style={styles.drawerLinks}>
                <DrawerItem
                  icon={Target}
                  label="Modération"
                  onPress={() => {
                    toggleDrawer(false);
                    router.push('/moderation' as any);
                  }}
                />
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.drawerFooter}>
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.85}
            onPress={handleSignOut}
          >
            <LogOut size={18} color={colors.textPrimary} />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tabAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  tabIconShell: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconShellActive: {
    backgroundColor: 'rgba(43, 191, 227, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.42)',
    ...shadows.subtleGlow,
  },
  profileTabIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
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
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
  },
  profileTabBadgeText: {
    fontSize: 9,
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 10,
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: colors.overlay,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '78%',
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderTopLeftRadius: radius.card,
    borderBottomLeftRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.surfaceSoft,
  },
  drawerScrollContent: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  drawerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  drawerAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceLevel1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  drawerIdentity: {
    flex: 1,
  },
  drawerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  drawerEmail: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  drawerLinks: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  walletCard: {
    minHeight: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceLevel1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.subtleGlow,
  },
  walletCopy: {
    flex: 1,
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  walletSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  drawerSectionTitle: {
    marginTop: spacing.md,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.primary,
    fontWeight: '700',
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  logoutButton: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceLevel1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  logoutText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  createButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...shadows.primaryGlow,
  },
  createButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  tabDisabled: {
    opacity: 0.55,
  },
});
