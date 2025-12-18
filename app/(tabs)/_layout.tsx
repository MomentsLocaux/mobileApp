import { Tabs, Redirect, useRouter } from 'expo-router';
import { Map, Home, Users, ShoppingBag, User, PlusCircle, Send, Compass, UserCircle2, Target } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Animated, Pressable, Alert, Text } from 'react-native';
import { colors } from '../../src/constants/theme';
import { useAuth } from '../../src/hooks';

export default function TabsLayout() {
  const { isLoading, isAuthenticated, profile } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  if (profile && !profile.onboarding_completed) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <Tabs
        initialRouteName="map"
        screenOptions={{
          headerShown: true,
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
          headerRight: () => (
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => toggleDrawer(true)}
              accessibilityLabel="Ouvrir le menu profil"
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <UserCircle2 size={28} color={colors.neutral[700]} />
              )}
            </TouchableOpacity>
          ),
          headerTitle: '',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
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
                style={styles.createButton}
                activeOpacity={0.85}
                onPress={() => router.push('/events/create' as any)}
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
            tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            title: 'Boutique',
            tabBarIcon: ({ size, color }) => <ShoppingBag size={size} color={color} />,
          }}
        />
        {/* Routes masquées du tab bar mais toujours accessibles */}
        <Tabs.Screen name="profile" options={{ href: null }} />
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
          <View>
            <View style={styles.drawerTitleRow}>
              <View>
                <View>
                  <View>
                    <View />
                  </View>
                </View>
              </View>
            </View>
            <View>
              <View>
                <View />
              </View>
            </View>
          </View>
        </View>
        <View style={styles.drawerLinks}>
          <DrawerLink
            icon={PlusCircle}
            label="Créer un évènement"
            onPress={() => {
              toggleDrawer(false);
              router.push('/events/create' as any);
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
          icon={Send}
          label="Inviter des amis"
          onPress={() => {
            toggleDrawer(false);
            Alert.alert('Inviter des amis', 'À implémenter');
          }}
        />
        <DrawerLink
          icon={Compass}
          label="Mon parcours"
          onPress={() => {
            toggleDrawer(false);
            Alert.alert('Mon parcours', 'Page gamification à venir');
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
        <DrawerLink
          icon={Map}
          label="Évènements"
          onPress={() => {
            toggleDrawer(false);
              router.push('/(tabs)/index' as any);
            }}
          />
        </View>
      </Animated.View>
    </>
  );
}

const DrawerLink = ({ icon: IconCmp, label, onPress }: { icon: any; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.8}>
    <IconCmp size={20} color={colors.neutral[800]} />
    <View style={styles.linkLabelWrapper}>
      <Text style={styles.linkLabel}>{label}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
  },
  avatarButton: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  createButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E84141',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
});
