import { Tabs, Redirect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { IdentityAppBackground } from '@/components/identity/IdentityAppBackground';
import { ModeSwitch } from '@/components/identity/ModeSwitch';
import {
  Map,
  HouseHeart,
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
  Target,
  ShoppingBag,
  Coins,
  Ticket,
  Sparkles,
  Briefcase,
  BarChart3,
  Package,
  WandSparkles,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Pressable, Text, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../../src/constants/theme';
import { Motion } from '@/constants/motion';
import { haptics } from '@/utils/haptics';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { CONTESTS_ENABLED } from '@/config/contests.flags';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { features } from '@/config/features';
import { useEventPublishSurfaces } from '@/hooks/useEventPublishSurfaces';
import { EventContributeSheet } from '@/components/events/EventContributeSheet';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { PremiumAvatarFrame } from '@/components/premium/PremiumAvatarFrame';
import { useOfferEntitlements } from '@/hooks/useOfferEntitlements';
import { useAuth } from '../../src/hooks';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { NotificationsService } from '@/services/notifications.service';
import { EventsService } from '@/services/events.service';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { LumiaTourOverlay } from '@/components/lumia/LumiaTourOverlay';
import { useLumiaTour } from '@/hooks/useLumiaTour';
import {
  LUMIA_TOUR_TARGET_RADIUS,
  type LumiaTourStep,
  type LumiaTourTargetId,
} from '@/constants/lumiaTour';
import { useLumiaTourStore } from '@/store/lumiaTourStore';

export default function TabsLayout() {
  const { isLoading, isAuthenticated, profile, signOut } = useAuth();
  const { isPremium, hasHabitue, hasEclaireur } = useOfferEntitlements();
  const showPaidOfferChrome = features.offers;
  const isOfferPremium = showPaidOfferChrome && isPremium;
  const { canCreateNow, canCreate, accent, showModeSwitch, activeMode, setActiveMode, savingMode, accountKind } =
    useAccountIdentity();
  const publishSurfaces = useEventPublishSurfaces();
  const canCreateEvents = canCreateNow;
  const isProfessionnelAccount = accountKind === 'professionnel';
  /** B2C Habitué/Lumo surfaces — never on Professionnel accounts (ADR_007). */
  const showB2cGamification = GAMIFICATION_ENABLED && !isProfessionnelAccount;
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarBottomPad = Math.max(insets.bottom, 8);
  const tabBarHeight = 60 + tabBarBottomPad;
  const tabBarStyleBase = {
    backgroundColor: colors.brand.page,
    borderTopColor: accent.accentBorder,
    height: tabBarHeight,
    paddingBottom: tabBarBottomPad,
    paddingTop: 8,
  } as const;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [guestGate, setGuestGate] = useState({ visible: false, title: '' });
  const resetCreateStore = useCreateEventStore((s) => s.reset);
  const setSubmissionSource = useCreateEventStore((s) => s.setSubmissionSource);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [hasMyEventsShortcut, setHasMyEventsShortcut] = useState(false);
  const drawerProgress = useSharedValue(0);
  useTaxonomy();
  const isGuest = !isAuthenticated;
  const { visible: lumiaTourVisible, steps: lumiaTourSteps, dismiss: dismissLumiaTour } = useLumiaTour();
  const setTourTarget = useLumiaTourStore((s) => s.setTarget);
  const bumpTourMeasure = useLumiaTourStore((s) => s.bumpMeasure);
  const targetRefs = useRef<Partial<Record<LumiaTourTargetId, View | null>>>({});

  const setTargetRef = useCallback(
    (id: LumiaTourTargetId) => (node: View | null) => {
      targetRefs.current[id] = node;
    },
    [],
  );

  const measureTourTargets = useCallback(() => {
    (Object.keys(targetRefs.current) as LumiaTourTargetId[]).forEach((id) => {
      const node = targetRefs.current[id];
      if (!node) return;
      node.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) return;
        const radius = Math.min(LUMIA_TOUR_TARGET_RADIUS[id], width / 2, height / 2);
        setTourTarget(id, { x, y, width, height, radius });
      });
    });
  }, [setTourTarget]);

  const handleLumiaTourStep = useCallback(
    (step: LumiaTourStep) => {
      if (step.href) {
        router.navigate(step.href as any);
      }
      requestAnimationFrame(() => {
        measureTourTargets();
        bumpTourMeasure();
        setTimeout(() => {
          measureTourTargets();
          bumpTourMeasure();
        }, 280);
      });
    },
    [router, measureTourTargets, bumpTourMeasure],
  );

  useEffect(() => {
    if (!lumiaTourVisible) return;
    const frame = requestAnimationFrame(() => {
      measureTourTargets();
      setTimeout(measureTourTargets, 280);
    });
    return () => cancelAnimationFrame(frame);
  }, [lumiaTourVisible, lumiaTourSteps, measureTourTargets]);

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
    if ((!features.eventCreate && !features.eventSuggest) || !profile?.id || isGuest) {
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
    drawerProgress.value = withSpring(open ? 1 : 0, Motion.spring.sheet);
    if (open) haptics.selection();
  };

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(drawerProgress.value, [0, 1], [400, 0]) }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: drawerProgress.value,
  }));

  const tabIconColor = (focused: boolean, disabled = false) => {
    if (disabled) return colors.brand.textSecondary;
    return focused ? accent.accent : colors.brand.textSecondary;
  };

  const renderTabIconSlot = (
    focused: boolean,
    content: React.ReactNode,
    targetId?: LumiaTourTargetId,
  ) => (
    <View
      ref={targetId ? setTargetRef(targetId) : undefined}
      collapsable={false}
      onLayout={targetId ? measureTourTargets : undefined}
      style={[
        styles.tabIconSlot,
        focused && { backgroundColor: accent.accentMuted },
      ]}
    >
      {content}
    </View>
  );

  const renderProtectedTabButton = (
    props: any,
    gateTitle: string,
    onAllowed?: () => void,
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
          haptics.selection();
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
        <IdentityAppBackground />
        <ActivityIndicator size="large" color={accent.accent} />
      </View>
    );
  }

  if (profile && !profile.onboarding_completed && isAuthenticated) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: accent.accent,
          tabBarInactiveTintColor: colors.brand.textSecondary,
          tabBarShowLabel: false,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle: tabBarStyleBase,
          tabBarItemStyle: {
            flex: 1,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: isProfessionnelAccount ? 'Tableau de bord' : 'Accueil',
            tabBarIcon: ({ focused, size }) =>
              renderTabIconSlot(
                focused,
                isProfessionnelAccount ? (
                  <Briefcase size={size} color={tabIconColor(focused, isGuest)} strokeWidth={focused ? 2.4 : 2} />
                ) : (
                  <HouseHeart size={size} color={tabIconColor(focused, isGuest)} strokeWidth={focused ? 2.4 : 2} />
                ),
                'home',
              ),
            tabBarButton: (props) =>
              renderProtectedTabButton(
                props,
                isProfessionnelAccount ? 'Accéder au tableau de bord' : "Accéder à l'accueil",
              ),
          }}
        />
        <Tabs.Screen
          name="proposals"
          options={
            isProfessionnelAccount
              ? { href: null }
              : {
                  title: 'Propositions',
                  tabBarIcon: ({ focused, size }) =>
                    renderTabIconSlot(
                      focused,
                      <WandSparkles
                        size={size}
                        color={tabIconColor(focused, isGuest)}
                        strokeWidth={focused ? 2.4 : 2}
                      />,
                      'proposals',
                    ),
                  tabBarButton: (props) =>
                    renderProtectedTabButton(props, 'Créer vos propositions'),
                }
          }
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Carte',
            tabBarIcon: ({ focused, size }) =>
              renderTabIconSlot(
                focused,
                <Map size={size} color={tabIconColor(focused)} strokeWidth={focused ? 2.4 : 2} />,
                'map',
              ),
            tabBarStyle: {
              ...tabBarStyleBase,
              borderTopWidth: 0,
              borderTopColor: 'transparent',
              elevation: 0,
              shadowOpacity: 0,
            },
          }}
        />
        <Tabs.Screen
          name="create"
          options={
            publishSurfaces.showCenterTabAction
              ? {
                  title: '',
                  tabBarButton: () => (
                    <View style={styles.createTargetWrap}>
                      <TouchableOpacity
                        style={[
                          styles.createButton,
                          { backgroundColor: accent.accent, marginBottom: 12 + insets.bottom },
                        ]}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Ajouter un événement"
                        onPress={() => {
                          haptics.selection();
                          if (isGuest) {
                            openGuestGate('Ajouter un événement');
                            return;
                          }
                          // Organizer-only (no suggest): go straight to form.
                          if (publishSurfaces.canOrganize && !publishSurfaces.eventSuggest) {
                            resetCreateStore();
                            setSubmissionSource('organizer_create');
                            router.push(publishSurfaces.routes.eventFormStepper as any);
                            return;
                          }
                          setContributeOpen(true);
                        }}
                      >
                        <PlusCircle size={28} color="#0f1719" />
                      </TouchableOpacity>
                    </View>
                  ),
                }
              : {
                  href: null,
                }
          }
        />
        <Tabs.Screen
          name="favorites"
          options={
            isProfessionnelAccount
              ? { href: null }
              : {
                  title: 'Favoris',
                  tabBarIcon: ({ focused, size }) =>
                    renderTabIconSlot(
                      focused,
                      <Heart size={size} color={tabIconColor(focused, isGuest)} strokeWidth={focused ? 2.4 : 2} />,
                      'favorites',
                    ),
                  tabBarButton: (props) => renderProtectedTabButton(props, 'Accéder à vos favoris'),
                }
          }
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
                    <PremiumAvatarFrame isPremium={isOfferPremium} size={26} showBadge={false}>
                      <Image
                        source={{ uri: profile.avatar_url }}
                        style={[styles.tabAvatar, focused && !isOfferPremium && styles.tabAvatarActive]}
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
                </View>,
                'menu',
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

      {drawerOpen ? (
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleDrawer(false)} />
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.drawer, drawerStyle]}>
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
              <PremiumAvatarFrame isPremium={isOfferPremium} size={56}>
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
              {showPaidOfferChrome && !isProfessionnelAccount && hasEclaireur ? (
                <View style={styles.drawerPremiumPill}>
                  <Crown size={12} color={colors.brand.primary} strokeWidth={2.5} />
                  <Text style={styles.drawerPremiumText}>Éclaireur</Text>
                </View>
              ) : showPaidOfferChrome && !isProfessionnelAccount && hasHabitue ? (
                <View style={[styles.drawerPremiumPill, styles.drawerHabituePill]}>
                  <Sparkles size={12} color={colors.brand.primary} strokeWidth={2.5} />
                  <Text style={styles.drawerPremiumText}>Habitué</Text>
                </View>
              ) : isProfessionnelAccount ? (
                <View style={[styles.drawerPremiumPill, styles.drawerHabituePill]}>
                  <Briefcase size={12} color={colors.brand.primary} strokeWidth={2.5} />
                  <Text style={styles.drawerPremiumText}>Diffuseur</Text>
                </View>
              ) : null}
              <Text style={styles.drawerEmail}>{profile?.email || 'Compte connecté'}</Text>
            </View>
          </View>
          {showModeSwitch ? (
            <View style={styles.drawerModeSwitch}>
              <ModeSwitch
                mode={activeMode}
                loading={savingMode}
                onChange={(mode) => {
                  void setActiveMode(mode);
                }}
              />
            </View>
          ) : null}
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
                iconColor={isOfferPremium ? colors.brand.premiumLight : undefined}
                premium={isOfferPremium}
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
            {features.roadtrip ? (
              <DrawerLink
                icon={MapPinned}
                label="Roadtrip"
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/roadtrip' as any);
                }}
              />
            ) : null}
            {publishSurfaces.showCenterTabAction ? (
              <DrawerLink
                icon={PlusCircle}
                label="Ajouter un événement"
                onPress={() => {
                  toggleDrawer(false);
                  if (isGuest) {
                    openGuestGate('Ajouter un événement');
                    return;
                  }
                  if (publishSurfaces.canOrganize && !publishSurfaces.eventSuggest) {
                    resetCreateStore();
                    setSubmissionSource('organizer_create');
                    router.push(publishSurfaces.routes.eventFormStepper as any);
                    return;
                  }
                  setContributeOpen(true);
                }}
              />
            ) : null}
            <DrawerLink
              icon={User}
              label="Mon profil"
              active
              onPress={() => {
                toggleDrawer(false);
                router.push('/(tabs)/profile' as any);
              }}
            />
            {features.socialPeers && (
              <DrawerLink
                icon={Users}
                label="Membres"
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/(tabs)/community' as any);
                }}
              />
            )}
          </View>

          {/* Section: Compte */}
          <View style={styles.drawerSection}>
            <Text style={styles.sectionTitle}>COMPTE</Text>
            {features.offers ? (
              <DrawerLink
                icon={Sparkles}
                label="Nos offres"
                iconColor={colors.brand.premiumLight}
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/profile/offers' as any);
                }}
              />
            ) : null}
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
            {showB2cGamification && (
              <>
                <DrawerLink
                  icon={Coins}
                  label="Portefeuille Lumo"
                  onPress={() => {
                    toggleDrawer(false);
                    if (!hasHabitue) {
                      if (features.offers) {
                        Alert.alert(
                          'Gagnez des Lumo en sortant',
                          'Avec Habitué, chaque présence validée vous rapporte des Lumo à dépenser dans la boutique. Éclaireur inclut Habitué.',
                          [
                            {
                              text: 'Découvrir Habitué',
                              onPress: () => router.push('/profile/offers' as any),
                            },
                            { text: 'Plus tard', style: 'cancel' as const },
                          ],
                        );
                        return;
                      }
                      router.push('/(tabs)/map' as any);
                      return;
                    }
                    router.push('/profile/wallet' as any);
                  }}
                />
                <DrawerLink
                  icon={ShoppingBag}
                  label="Boutique Lumo"
                  onPress={() => {
                    toggleDrawer(false);
                    if (!hasHabitue) {
                      if (features.offers) {
                        Alert.alert(
                          'La boutique vous attend',
                          'Boostez vos moments ou personnalisez votre profil avec vos Lumo. Passez Habitué pour y accéder — Éclaireur inclut Habitué.',
                          [
                            {
                              text: 'Découvrir Habitué',
                              onPress: () => router.push('/profile/offers' as any),
                            },
                            { text: 'Plus tard', style: 'cancel' as const },
                          ],
                        );
                        return;
                      }
                      router.push('/(tabs)/map' as any);
                      return;
                    }
                    router.push('/(tabs)/shop' as any);
                  }}
                />
                {hasHabitue && (
                  <>
                    <DrawerLink
                      icon={Target}
                      label="Missions"
                      onPress={() => {
                        toggleDrawer(false);
                        router.push('/(tabs)/missions' as any);
                      }}
                    />
                    <DrawerLink
                      icon={Ticket}
                      label="Pass quartier"
                      onPress={() => {
                        toggleDrawer(false);
                        router.push('/profile/pass' as any);
                      }}
                    />
                  </>
                )}
              </>
            )}
            {features.diffuseur && isProfessionnelAccount ? (
              <>
                <DrawerLink
                  icon={Package}
                  label="Packs Diffuseur"
                  onPress={() => {
                    toggleDrawer(false);
                    router.push('/profile/diffuseur' as any);
                  }}
                />
                <DrawerLink
                  icon={BarChart3}
                  label="Analytics Pro"
                  onPress={() => {
                    toggleDrawer(false);
                    router.push('/profile/diffuseur-analytics' as any);
                  }}
                />
              </>
            ) : null}
            {!isProfessionnelAccount ? (
              <DrawerLink
                icon={Heart}
                label="Mes favoris"
                onPress={() => {
                  toggleDrawer(false);
                  router.push('/(tabs)/favorites' as any);
                }}
              />
            ) : null}
            {publishSurfaces.showMyEvents &&
              (canCreate || hasMyEventsShortcut || isProfessionnelAccount || features.eventSuggest) && (
              <DrawerLink
                icon={MapPinned}
                label="Mes événements"
                onPress={() => {
                  toggleDrawer(false);
                  router.push(publishSurfaces.routes.myEvents as any);
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

      <EventContributeSheet
        visible={contributeOpen}
        onClose={() => setContributeOpen(false)}
        isGuest={isGuest}
        onRequireAuth={(title) => openGuestGate(title)}
      />
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
      <LumiaTourOverlay
        visible={lumiaTourVisible}
        steps={lumiaTourSteps}
        onDismiss={dismissLumiaTour}
        onStepChange={handleLumiaTourStep}
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
    accessibilityRole="button"
    accessibilityLabel={
      typeof badgeCount === 'number' && badgeCount > 0
        ? `${label}, ${badgeCount} notification${badgeCount > 1 ? 's' : ''}`
        : label
    }
    accessibilityState={{ selected: !!active }}
  >
    <IconCmp
      size={20}
      color={iconColor || (active ? colors.brand.secondary : colors.brand.textSecondary)}
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
    backgroundColor: colors.brand.page,
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
    backgroundColor: 'rgba(124, 181, 24, 0.18)',
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
    backgroundColor: colors.brand.page,
    padding: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(26, 51, 41, 0.08)',
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
    backgroundColor: colors.brand.surfaceMuted,
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
    color: colors.brand.text,
    marginBottom: 2,
  },
  drawerEmail: {
    fontSize: 13,
    color: colors.brand.textSecondary,
  },
  drawerModeSwitch: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26, 51, 41, 0.1)',
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
  drawerHabituePill: {
    backgroundColor: '#6EE7B7',
    borderColor: 'rgba(16,185,129,0.55)',
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
    color: colors.brand.textSecondary,
  },
  linkBadge: {
    backgroundColor: colors.brand.secondary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBadgeText: {
    color: colors.brand.onAccent,
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
    borderColor: '#7CB518',
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
    color: colors.brand.textSecondary,
    marginBottom: 8,
    marginLeft: 24,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  linkRowActive: {
    backgroundColor: 'rgba(124, 181, 24, 0.15)',
    borderRadius: 12,
  },
  linkLabelActive: {
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  drawerFooter: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 51, 41, 0.08)',
    padding: 24,
    backgroundColor: colors.brand.surfaceMuted,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand.surface,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  logoutText: {
    color: colors.brand.text,
    fontWeight: '600',
    fontSize: 14,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 10,
    color: colors.brand.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  createTargetWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  createButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.brand.page,
  },
  createButtonDisabled: {
    backgroundColor: colors.brand.surface,
  },
  tabDisabled: {
    opacity: 0.5,
  },
});
