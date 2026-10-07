import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/hooks';
import { MessagingService, type DirectConversationPreview, type ShareRecipient } from '@/services/messaging.service';
import { internalEventShareMessage, shareEventExternally, type ShareableEvent } from '@/utils/event-share';
import { registerEventShareOpener } from '@/utils/event-share-host';

type Row = {
  key: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  detail: string;
  conversationId?: string;
};

export function EventShareHost() {
  const [event, setEvent] = useState<ShareableEvent | null>(null);

  useEffect(() => {
    registerEventShareOpener(setEvent);
    return () => registerEventShareOpener(null);
  }, []);

  return (
    <EventShareSheet
      event={event}
      onClose={() => setEvent(null)}
      onShareExternally={(item) => {
        setEvent(null);
        setTimeout(() => {
          void shareEventExternally(item).catch(() => undefined);
        }, 280);
      }}
    />
  );
}

function EventShareSheet({
  event,
  onClose,
  onShareExternally,
}: {
  event: ShareableEvent | null;
  onClose: () => void;
  onShareExternally: (event: ShareableEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, session } = useAuth();
  const signedIn = Boolean(user?.id || session?.user?.id);
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<DirectConversationPreview[]>([]);
  const [results, setResults] = useState<ShareRecipient[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) {
      setQuery('');
      setResults([]);
      setError(null);
      setSendingId(null);
      return;
    }
    if (!signedIn) return;
    let cancelled = false;
    setLoadingList(true);
    void MessagingService.listConversations()
      .then((rows) => {
        if (!cancelled) setConversations(rows);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event, signedIn]);

  useEffect(() => {
    if (!event || !signedIn) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void MessagingService.searchRecipients(trimmed)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setError('Recherche indisponible pour le moment.');
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [event, query, signedIn]);

  const searchingNow = query.trim().length >= 2;
  const rows: Row[] = searchingNow
    ? results.map((person) => ({
        key: person.userId,
        userId: person.userId,
        name: person.displayName,
        avatarUrl: person.avatarUrl,
        detail: person.city || 'Membre',
      }))
    : conversations.map((row) => ({
        key: row.conversation_id,
        userId: row.other_user_id,
        name: row.display_name,
        avatarUrl: row.avatar_url,
        detail: 'Conversation',
        conversationId: row.conversation_id,
      }));

  const send = async (row: Row) => {
    if (!event || sendingId) return;
    setSendingId(row.userId);
    setError(null);
    try {
      const conversationId = row.conversationId || await MessagingService.openConversation(row.userId);
      await MessagingService.sendMessage(conversationId, internalEventShareMessage(event.title, event.id));
      onClose();
      const name = encodeURIComponent(row.name);
      setTimeout(() => {
        router.push(`/messages/${conversationId}?name=${name}` as never);
      }, 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Envoi impossible.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Modal visible={Boolean(event)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onPress={(press) => press.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Envoyer dans Moments Locaux</Text>
              {event ? <Text style={styles.subtitle} numberOfLines={1}>{event.title}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={8}>
              <X size={20} color={colors.brand.textSecondary} />
            </TouchableOpacity>
          </View>

          {signedIn ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Chercher un membre"
              placeholderTextColor={colors.brand.textSecondary}
              style={styles.search}
              autoCorrect={false}
              accessibilityLabel="Chercher un membre"
            />
          ) : (
            <Text style={styles.hint}>Connecte-toi pour envoyer ce moment dans une conversation.</Text>
          )}

          {signedIn ? (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {loadingList || searching ? (
                <ActivityIndicator color={colors.brand.secondary} style={styles.spinner} />
              ) : rows.length === 0 ? (
                <Text style={styles.hint}>
                  {searchingNow ? 'Aucun membre à qui écrire pour cette recherche.' : 'Aucune conversation. Cherche un membre par son nom.'}
                </Text>
              ) : (
                rows.map((row) => (
                  <TouchableOpacity
                    key={row.key}
                    style={styles.row}
                    onPress={() => void send(row)}
                    disabled={Boolean(sendingId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Envoyer à ${row.name}`}
                  >
                    <UserAvatar uri={row.avatarUrl} name={row.name} size={40} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                      <Text style={styles.detail} numberOfLines={1}>{row.detail}</Text>
                    </View>
                    {sendingId === row.userId ? <ActivityIndicator color={colors.brand.secondary} /> : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.external}
            onPress={() => event && onShareExternally(event)}
            accessibilityRole="button"
            accessibilityLabel="Partager autrement"
          >
            <Text style={styles.externalText}>Partager autrement</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 51, 41, 0.28)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.brand.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: '78%',
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleBlock: { flex: 1, gap: 2 },
  title: { ...typography.h4, color: colors.brand.text },
  subtitle: { ...typography.bodySmall, color: colors.brand.textSecondary },
  search: {
    minHeight: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.page,
    paddingHorizontal: spacing.md,
    color: colors.brand.text,
    ...typography.body,
  },
  list: { flexGrow: 0, maxHeight: 320 },
  spinner: { marginVertical: spacing.lg },
  hint: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  rowCopy: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.brand.text, fontWeight: '600' },
  detail: { ...typography.bodySmall, color: colors.brand.textSecondary },
  error: { ...typography.bodySmall, color: colors.brand.error },
  external: {
    minHeight: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.page,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
  },
  externalText: { ...typography.body, color: colors.brand.text, fontWeight: '700' },
});
