import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BrandIcon } from '@/components/ui';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { features } from '@/config/features';
import { colors, spacing } from '@/constants/theme';
import { NotificationsService } from '@/services/notifications.service';
import { MessagingService } from '@/services/messaging.service';
import { haptics } from '@/utils/haptics';

type Props = {
  isGuest: boolean;
  top: number;
};

export function MapChromeActions({ isGuest, top }: Props) {
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = React.useState(0);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [guestGate, setGuestGate] = React.useState('');

  React.useEffect(() => {
    if (isGuest) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }
    let cancelled = false;
    void NotificationsService.getUnreadCount()
      .then((count) => {
        if (!cancelled) setUnreadNotifications(count);
      })
      .catch(() => {
        if (!cancelled) setUnreadNotifications(0);
      });
    if (features.socialPeers) {
      void MessagingService.getUnreadCount()
        .then((count) => {
          if (!cancelled) setUnreadMessages(count);
        })
        .catch(() => {
          if (!cancelled) setUnreadMessages(0);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const openOrGate = (title: string, href: string) => {
    haptics.selection();
    if (isGuest) {
      setGuestGate(title);
      return;
    }
    router.push(href as any);
  };

  return (
    <>
      <View style={[styles.stack, { top }]} pointerEvents="box-none">
        {features.socialPeers ? (
          <FloatingPressable
            style={styles.button}
            onPress={() => openOrGate('Accéder aux messages', '/messages')}
            accessibilityRole="button"
            accessibilityLabel={
              unreadMessages > 0 ? `Messages, ${unreadMessages} non lus` : 'Messages'
            }
            animateEntrance={false}
          >
            <BrandIcon name="mail" size={20} color={colors.brand.ink} />
            {unreadMessages > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
              </View>
            ) : null}
          </FloatingPressable>
        ) : null}
        <FloatingPressable
          style={styles.button}
          onPress={() => openOrGate('Accéder à votre agenda', '/agenda')}
          accessibilityRole="button"
          accessibilityLabel="Mon agenda"
          animateEntrance={false}
        >
          <BrandIcon name="calendar" size={20} color={colors.brand.ink} />
        </FloatingPressable>
        <FloatingPressable
          style={styles.button}
          onPress={() => openOrGate('Accéder aux notifications', '/notifications')}
          accessibilityRole="button"
          accessibilityLabel={
            unreadNotifications > 0
              ? `Notifications, ${unreadNotifications} non lues`
              : 'Notifications'
          }
          animateEntrance={false}
        >
          <BrandIcon name="bell" size={20} color={colors.brand.ink} />
          {unreadNotifications > 0 ? <View style={styles.dot} /> : null}
        </FloatingPressable>
      </View>
      <GuestGateModal
        visible={!!guestGate}
        title={guestGate}
        onClose={() => setGuestGate('')}
        onSignUp={() => {
          setGuestGate('');
          router.push('/auth/register' as any);
        }}
        onSignIn={() => {
          setGuestGate('');
          router.push('/auth/login' as any);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 8,
    elevation: 0,
    gap: spacing.sm,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.error,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.error,
    borderWidth: 1.5,
    borderColor: colors.brand.surface,
  },
});
