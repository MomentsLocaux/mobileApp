import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { CommunityService, type EventLikerProfile } from '@/services/community.service';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { mutualFriendIds, orderLikersFriendsFirst } from '@/utils/event-likers';
import { supabase } from '@/lib/supabase/client';

type OrderedLiker = EventLikerProfile & { isFriend: boolean };

type Props = {
  visible: boolean;
  eventId: string | null;
  onClose: () => void;
  onPressProfile: (userId: string) => void;
};

export function EventLikersSheet({ visible, eventId, onClose, onPressProfile }: Props) {
  const [loading, setLoading] = useState(false);
  const [likers, setLikers] = useState<OrderedLiker[]>([]);

  useEffect(() => {
    if (!visible || !eventId) {
      setLikers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const currentUser = (await supabase.auth.getUser()).data.user?.id ?? null;
      const [rows, followingIds, followers] = await Promise.all([
        CommunityService.listEventLikers(eventId, { limit: 100 }),
        currentUser ? CommunityService.getFollowingIds(currentUser).catch(() => [] as string[]) : [],
        currentUser ? CommunityService.listMyFollowers().catch(() => []) : [],
      ]);
      const friends = mutualFriendIds(followingIds, followers.map((person) => person.id));
      return orderLikersFriendsFirst(rows, friends);
    })()
      .then((rows) => {
        if (!cancelled) setLikers(rows);
      })
      .catch(() => {
        if (!cancelled) setLikers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, visible]);

  const sections = useMemo(() => {
    const friends = likers.filter((person) => person.isFriend);
    const others = likers.filter((person) => !person.isFriend);
    if (friends.length > 0 && others.length > 0) {
      return [
        { title: 'Amis', data: friends },
        { title: 'Autres', data: others },
      ];
    }
    if (friends.length > 0) return [{ title: 'Amis', data: friends }];
    return [{ title: '', data: others }];
  }, [likers]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <BrandIcon name="heart" size={18} active />
              <Text style={styles.title}>Ont aimé</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer">
              <X size={20} color={colors.brand.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brand.secondary} style={{ marginVertical: spacing.lg }} />
          ) : likers.length === 0 ? (
            <Text style={styles.emptyText}>Personne n’a encore aimé cet événement.</Text>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              style={styles.list}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) =>
                section.title ? <Text style={styles.section}>{section.title}</Text> : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onPressProfile(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={item.isFriend ? `Ami, ${item.display_name}` : `Profil de ${item.display_name}`}
                >
                  <UserAvatar uri={item.avatar_url} name={item.display_name} size={40} />
                  <Text style={styles.name} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.brand.page,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  section: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  name: {
    ...typography.body,
    color: colors.brand.text,
    flex: 1,
  },
});
