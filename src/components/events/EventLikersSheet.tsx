import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Heart, X } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { CommunityService, type EventLikerProfile } from '@/services/community.service';

type Props = {
  visible: boolean;
  eventId: string | null;
  onClose: () => void;
  onPressProfile: (userId: string) => void;
};

export function EventLikersSheet({ visible, eventId, onClose, onPressProfile }: Props) {
  const [loading, setLoading] = useState(false);
  const [likers, setLikers] = useState<EventLikerProfile[]>([]);

  useEffect(() => {
    if (!visible || !eventId) {
      setLikers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void CommunityService.listEventLikers(eventId, { limit: 50 })
      .then((rows) => {
        if (!cancelled) setLikers(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Heart size={18} color={colors.brand.secondary} fill={colors.brand.secondary} />
              <Text style={styles.title}>Ont aimé</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer">
              <X size={20} color={colors.brand.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brand.secondary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <FlatList
              data={likers}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={likers.length === 0 ? styles.emptyContainer : undefined}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Personne n’a encore aimé cet événement.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onPressProfile(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Profil de ${item.display_name}`}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>
                        {(item.display_name || '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
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
  },
  emptyContainer: {
    paddingVertical: spacing.lg,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: colors.neutral[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  name: {
    ...typography.body,
    color: colors.brand.text,
    flex: 1,
  },
});
