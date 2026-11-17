import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { LUMIA_AVATAR_LOCAL, LUMIA_NAME } from '@/constants/lumia';
import { isLumiaTourHeaderTarget, type LumiaTourTargetId } from '@/constants/lumiaTour';
import { colors, spacing, typography } from '@/constants/theme';
import { UserAvatar } from '@/components/ui';
import { useLumiaTourStore } from '@/store/lumiaTourStore';
import { HomeBrandSignature } from './HomeBrandSignature';

type TourTarget = {
  ref: React.Ref<View>;
  onLayout: () => void;
};

type Props = {
  greeting: string;
  avatarUrl?: string | null;
  displayName?: string | null;
  showLumia: boolean;
  unreadNotifications: number;
  onSubmitSearch: () => void;
  onPressProfile: () => void;
  onPressLumia: () => void;
  onPressNotifications: () => void;
  profileTour?: TourTarget;
  lumiaTour?: TourTarget;
  notificationsTour?: TourTarget;
};

export function HomeHeader({
  greeting,
  avatarUrl,
  displayName,
  showLumia,
  unreadNotifications,
  onSubmitSearch,
  onPressProfile,
  onPressLumia,
  onPressNotifications,
  profileTour,
  lumiaTour,
  notificationsTour,
}: Props) {
  const activeTargetId = useLumiaTourStore((s) => s.activeTargetId);
  const setHeaderBandHeight = useLumiaTourStore((s) => s.setHeaderBandHeight);
  const headerTour = Platform.OS === 'android' && isLumiaTourHeaderTarget(activeTargetId);
  const highlighted = (id: LumiaTourTargetId) => headerTour && activeTargetId === id;

  return (
    <View
      style={styles.header}
      onLayout={(event) => setHeaderBandHeight(Math.round(event.nativeEvent.layout.height))}
    >
      <HomeBrandSignature />
      <View style={styles.headerTop}>
        <View
          ref={profileTour?.ref}
          collapsable={false}
          onLayout={profileTour?.onLayout}
          style={[
            highlighted('headerProfile') && styles.tourTarget,
            headerTour && !highlighted('headerProfile') && styles.tourDimmed,
          ]}
        >
          <Pressable
            onPress={onPressProfile}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir mon profil"
          >
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <UserAvatar uri={avatarUrl} name={displayName} size={40} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}><BrandIcon name="user" size={24} /></View>
              )}
            </View>
          </Pressable>
        </View>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting}
        </Text>
        <View style={styles.actions}>
          {showLumia ? (
            <View
              ref={lumiaTour?.ref}
              collapsable={false}
              onLayout={lumiaTour?.onLayout}
              style={[
                highlighted('headerChat') && styles.tourTarget,
                headerTour && !highlighted('headerChat') && styles.tourDimmed,
              ]}
            >
              <Pressable
                style={styles.iconBtn}
                onPress={onPressLumia}
                accessibilityRole="button"
                accessibilityLabel={`Parler à ${LUMIA_NAME}`}
              >
                <Image source={LUMIA_AVATAR_LOCAL} style={styles.lumia} accessibilityIgnoresInvertColors />
              </Pressable>
            </View>
          ) : null}
          <View
            ref={notificationsTour?.ref}
            collapsable={false}
            onLayout={notificationsTour?.onLayout}
            style={[
              highlighted('headerNotifications') && styles.tourTarget,
              headerTour && !highlighted('headerNotifications') && styles.tourDimmed,
            ]}
          >
            <Pressable
              style={styles.iconBtn}
              onPress={onPressNotifications}
              accessibilityRole="button"
              accessibilityLabel={
                unreadNotifications > 0
                  ? `Notifications, ${unreadNotifications} non lue${unreadNotifications > 1 ? 's' : ''}`
                  : 'Notifications'
              }
            >
              <BrandIcon name="bell" size={22} />
              {unreadNotifications > 0 ? <View style={styles.badge} /> : null}
            </Pressable>
          </View>
        </View>
      </View>
      <Pressable style={styles.search} onPress={onSubmitSearch} accessibilityRole="button" accessibilityLabel="Rechercher un moment ou un lieu sur la carte">
        <BrandIcon name="search" size={22} />
        <Text style={styles.input}>Rechercher un moment ou un lieu</Text>
        <BrandIcon name="map" size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: colors.brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    ...typography.h5,
    color: colors.brand.text,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tourTarget: {
    borderWidth: 2,
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.surfaceMuted,
    borderRadius: 24,
  },
  tourDimmed: {
    opacity: 0.4,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 22,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  lumia: {
    width: 44,
    height: 44,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.error,
  },
  search: {
    minHeight: 48,
    borderRadius: 22,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.brand.text,
    paddingVertical: spacing.sm,
  },
});
