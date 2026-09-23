import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppBackground, EmptyState, ScreenHeader, UserAvatar } from '@/components/ui';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { MessagingService, type DirectConversationPreview } from '@/services/messaging.service';
import { formatTimeAgo } from '@/utils/relative-time';
import { CONTRIBUTION_FAB_STACK_SPACE } from '@/utils/contribution-fab';

export default function ConversationsInboxScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [rows, setRows] = useState<DirectConversationPreview[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setRows([]);
      return;
    }
    try {
      const data = await MessagingService.listConversations();
      setRows(data);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
      setRows([]);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!session) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <GuestGateModal
          visible
          title="Accéder aux messages"
          onClose={() => router.back()}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppBackground />
      <ScreenHeader title="Messages" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brand.secondary}
          />
        }
      >
        {unavailable ? (
          <EmptyState
            title="Messages indisponibles"
            subtitle="Le module sera actif après la mise à jour serveur. En attendant, tu peux suivre des membres."
            ctaLabel="Voir les membres"
            onCtaPress={() => router.push('/(tabs)/community' as any)}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Pas encore de conversation"
            subtitle="Écris à un profil public, ou à un ami (suivi mutuel) si le profil est privé."
            ctaLabel="Trouver des membres"
            onCtaPress={() => router.push('/(tabs)/community' as any)}
          />
        ) : (
          rows.map((row) => (
            <TouchableOpacity
              key={row.conversation_id}
              style={styles.row}
              onPress={() =>
                router.push(
                  `/messages/${row.conversation_id}?name=${encodeURIComponent(row.display_name)}` as any,
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Conversation avec ${row.display_name}`}
            >
              <UserAvatar uri={row.avatar_url} name={row.display_name} size={52} />
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.display_name}
                  </Text>
                  {row.last_at ? <Text style={styles.time}>{formatTimeAgo(row.last_at)}</Text> : null}
                </View>
                <Text style={[styles.preview, row.unread_count > 0 && styles.previewUnread]} numberOfLines={1}>
                  {row.last_body || 'Nouvelle conversation'}
                </Text>
              </View>
              {row.unread_count > 0 ? (
                <View style={styles.unread}>
                  <Text style={styles.unreadText}>{row.unread_count > 9 ? '9+' : row.unread_count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxxl + CONTRIBUTION_FAB_STACK_SPACE,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.body, flex: 1, color: colors.brand.text, fontWeight: '700' },
  time: { ...typography.caption, color: colors.brand.textSecondary },
  preview: { ...typography.bodySmall, color: colors.brand.textSecondary },
  previewUnread: { color: colors.brand.text, fontWeight: '600' },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.secondary,
  },
  unreadText: { ...typography.caption, color: colors.brand.onAccent, fontWeight: '800' },
});
