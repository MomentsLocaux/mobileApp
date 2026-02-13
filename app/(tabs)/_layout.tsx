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
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Animated, Pressable, Text } from 'react-native';
import { colors } from '../../src/constants/theme';
import { useAuth } from '../../src/hooks';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { NotificationsService } from '@/services/notifications.service';
import { EventsService } from '@/services/events.service';

export default function TabsLayout() {
  const { isLoading, isAuthenticated, profile } = useAuth();
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
        <ActivityIndicator size="large" color={colors.primary[600]} />
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
          tabBarActiveTintColor: colors.primary[600],
          tabBarInactiveTintColor: colors.neutral[500],
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: colors.neutral[50],
            borderTopColor: colors.neutral[200],
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
            tabBarIcon: ({ size, color }) => (
              <Home size={size} color={isGuest ? colors.neutral[400] : color} />
            ),
            tabBarButton: (props) => renderProtectedTabButton(props, "Accéder à l'accueil"),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Carte',
            tabBarIcon: ({ size, color }) => <Map size={size} color={color} />,
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
                <PlusCircle size={28} color="#FFFFFF" />
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Communauté',
            tabBarIcon: ({ size, color }) => (
              <Users size={size} color={isGuest ? colors.neutral[400] : color} />
            ),
            tabBarButton: (props) => renderProtectedTabButton(props, 'Accéder à la communauté'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ size, color }) => (
              <View style={styles.profileTabIconWrap}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.tabAvatar} />
                ) : (
                  <User size={size} color={isGuest ? colors.neutral[400] : color} />
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
        <View style={styles.drawerHeader}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.drawerAvatar} />
          ) : (
            <View style={styles.drawerAvatarPlaceholder}>
              <UserCircle2 size={32} color={colors.neutral[600]} />
            </View>
          )}
          <View style={styles.drawerIdentity}>
            <Text style={styles.drawerName}>{profile?.display_name || 'Profil'}</Text>
            {profile?.email ? <Text style={styles.drawerEmail}>{profile.email}</Text> : null}
          </View>
        </View>
        <View style={styles.drawerLinks}>
          <DrawerLink
            icon={PlusCircle}
            label="Créer un évènement"
            onPress={() => {
              toggleDrawer(false);
              router.push('/events/create/step-1' as any);
            }}
          />
        <DrawerLink
          icon={User}
          label="Mon profil"
          onPress={() => {
            toggleDrawer(false);
            router.push('/(tabs)/profile' as any);
          }}
        />
        <DrawerLink
          icon={BarChart3}
          label="Espace créateur"
          onPress={() => {
            toggleDrawer(false);
            router.push('/creator' as any);
          }}
        />
        <DrawerLink
          icon={ShoppingBag}
          label="Offres & abonnements"
          highlight
          onPress={() => {
            toggleDrawer(false);
            router.push('/profile/offers' as any);
          }}
        />
        <DrawerLink
          icon={Settings}
          label="Paramètres"
          onPress={() => {
            toggleDrawer(false);
            router.push('/settings/index' as any);
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
        <DrawerLink
          icon={Send}
          label="Inviter des amis"
          onPress={() => {
            toggleDrawer(false);
            router.push('/profile/invite' as any);
          }}
        />
        <DrawerLink
          icon={Compass}
          label="Mon parcours"
          onPress={() => {
            toggleDrawer(false);
            router.push('/profile/journey' as any);
          }}
        />
        <DrawerLink
          icon={Target}
          label="Missions"
          onPress={() => {
            toggleDrawer(false);
            router.push('/(tabs)/missions' as any);
          }}
        />
        {hasMyEventsShortcut && (
          <DrawerLink
            icon={Map}
            label="Mes évènements"
            onPress={() => {
              toggleDrawer(false);
              router.push('/profile/my-events' as any);
            }}
          />
        )}
        <DrawerLink
          icon={ShoppingBag}
          label="Boutique"
          onPress={() => {
            toggleDrawer(false);
            router.push('/(tabs)/shop' as any);
          }}
        />
        <DrawerLink
          icon={Heart}
          label="Mes favoris"
          onPress={() => {
            toggleDrawer(false);
            router.push('/(tabs)/favorites' as any);
          }}
        />
        <DrawerLink
          icon={Bug}
          label="Reporter un bug"
          onPress={() => {
            toggleDrawer(false);
            router.push('/bug-report' as any);
          }}
        />
        {(profile?.role === 'moderateur' || profile?.role === 'admin') && (
          <DrawerLink
            icon={Target}
            label="Modération"
            onPress={() => {
              toggleDrawer(false);
              router.push('/moderation' as any);
            }}
          />
        )}
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
  highlight,
  badgeCount,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  highlight?: boolean;
  badgeCount?: number;
}) => (
  <TouchableOpacity style={[styles.linkRow, highlight && styles.linkRowHighlight]} onPress={onPress} activeOpacity={0.8}>
    <IconCmp size={20} color={highlight ? '#C18A1C' : colors.neutral[800]} />
    <View style={styles.linkLabelWrapper}>
      <Text style={[styles.linkLabel, highlight && styles.linkLabelHighlight]}>{label}</Text>
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
    backgroundColor: colors.neutral[50],
  },
  tabAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    backgroundColor: colors.error[500],
    borderWidth: 2,
    borderColor: colors.neutral[50],
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
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  drawerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  drawerAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerIdentity: {
    flex: 1,
  },
  drawerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  drawerEmail: {
    marginTop: 4,
    fontSize: 13,
    color: colors.neutral[600],
  },
  drawerLinks: {
    marginTop: 12,
    gap: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  linkLabelWrapper: {
    flex: 1,
  },
  linkLabel: {
    fontSize: 16,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  linkRowHighlight: {
    backgroundColor: '#FFF5DB',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  linkLabelHighlight: {
    color: '#C18A1C',
  },
  linkBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
  },
  linkBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  createButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E84141',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  createButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  tabDisabled: {
    opacity: 0.5,
  },
});
