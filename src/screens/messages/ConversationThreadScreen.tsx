import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { MessagingService, type DirectMessage } from '@/services/messaging.service';
import { NotificationsService } from '@/services/notifications.service';
import { setActiveDirectConversation } from '@/services/push.service';
import { UGC_LIMITS } from '@/utils/ugc-sanitize';
import { parseSharedEventMessage } from '@/utils/event-share';

export default function ConversationThreadScreen() {
  const router = useRouter();
  const { id: rawId, name } = useLocalSearchParams<{ id: string | string[]; name?: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { user, profile } = useAuth();
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const myId = profile?.id || user?.id || null;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const rows = await MessagingService.listMessages(id);
      setMessages(rows);
      setError(null);
      await MessagingService.markRead(id);
      NotificationsService.invalidateInboxCache();
      void NotificationsService.getUnreadCount().catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger la conversation.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) setActiveDirectConversation(id);
      void load();
      return () => setActiveDirectConversation(null);
    }, [id, load]),
  );

  useEffect(() => {
    if (!id) return;
    return MessagingService.subscribeToConversation(id, () => {
      void load();
    });
  }, [id, load]);

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const beginEdit = (message: DirectMessage) => {
    setEditingId(message.id);
    setDraft(message.body);
    setError(null);
  };

  const confirmDelete = (message: DirectMessage) => {
    Alert.alert(
      'Supprimer ce message ?',
      'Il disparaîtra pour vous et pour l’autre personne.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => void removeMessage(message),
        },
      ],
    );
  };

  const removeMessage = async (message: DirectMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await MessagingService.deleteMessage(message.id);
      if (editingId === message.id) cancelEdit();
      setMessages((current) => current.filter((row) => row.id !== message.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };

  const openOwnMessageActions = (message: DirectMessage) => {
    Alert.alert('Message', undefined, [
      { text: 'Modifier', onPress: () => beginEdit(message) },
      { text: 'Supprimer', style: 'destructive', onPress: () => confirmDelete(message) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const send = async () => {
    if (!id || busy || !draft.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        const updated = await MessagingService.editMessage(editingId, draft);
        setMessages((current) =>
          current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
        );
        cancelEdit();
      } else {
        const sent = await MessagingService.sendMessage(id, draft);
        setDraft('');
        setMessages((current) =>
          current.some((row) => row.id === sent.id) ? current : [...current, sent],
        );
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : editingId ? 'Modification impossible.' : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppBackground />
      <ScreenHeader title={name || 'Conversation'} onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand.secondary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {error || 'Écris le premier message de cette conversation.'}
              </Text>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === myId;
              const shared = parseSharedEventMessage(item.body);
              return (
                <Pressable
                  disabled={!mine && !shared}
                  onPress={shared ? () => router.push(`/events/${shared.eventId}` as never) : undefined}
                  onLongPress={mine ? () => openOwnMessageActions(item) : undefined}
                  delayLongPress={280}
                  accessibilityRole={shared ? 'button' : 'text'}
                  accessibilityLabel={shared ? `Voir ${shared.title}` : item.body}
                  accessibilityHint={mine ? 'Maintien pour modifier ou supprimer' : undefined}
                  accessibilityActions={
                    mine
                      ? [
                          { name: 'edit', label: 'Modifier' },
                          { name: 'delete', label: 'Supprimer' },
                        ]
                      : undefined
                  }
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'edit') beginEdit(item);
                    if (event.nativeEvent.actionName === 'delete') confirmDelete(item);
                  }}
                  style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                >
                  {shared ? (
                    <>
                      {shared.note ? (
                        <Text style={mine ? styles.bubbleMineText : styles.bubbleText}>{shared.note}</Text>
                      ) : null}
                      <Text style={[styles.shareTitle, shared.note ? styles.shareTitleSpaced : null, mine ? styles.bubbleMineText : styles.bubbleText]}>{shared.title}</Text>
                      <Text style={[styles.shareCta, mine ? styles.editedMine : styles.shareCtaTheirs]}>Voir le moment</Text>
                    </>
                  ) : (
                    <Text style={mine ? styles.bubbleMineText : styles.bubbleText}>{item.body}</Text>
                  )}
                  {item.edited_at ? (
                    <Text style={[styles.edited, mine ? styles.editedMine : styles.editedTheirs]}>
                      Modifié
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
        {error && messages.length > 0 ? <Text style={styles.error}>{error}</Text> : null}
        {editingId ? (
          <View style={styles.editBanner}>
            <Text style={styles.editBannerText}>Modification du message</Text>
            <TouchableOpacity onPress={cancelEdit} accessibilityRole="button" accessibilityLabel="Annuler la modification">
              <Text style={styles.editCancel}>Annuler</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={editingId ? 'Modifier le message' : 'Écrire un message'}
            placeholderTextColor={colors.brand.textSecondary}
            style={styles.input}
            maxLength={UGC_LIMITS.directMessage}
            multiline
          />
          <TouchableOpacity
            style={[styles.send, (!draft.trim() || busy) && styles.sendDisabled]}
            onPress={() => void send()}
            disabled={!draft.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel={editingId ? 'Enregistrer la modification' : 'Envoyer'}
          >
            <Text style={styles.sendText}>{editingId ? 'Enregistrer' : 'Envoyer'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand.secondary,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  bubbleText: { ...typography.body, color: colors.brand.text },
  bubbleMineText: { ...typography.body, color: colors.brand.onAccent },
  shareTitle: { ...typography.body, fontWeight: '700' },
  shareTitleSpaced: { marginTop: 6 },
  shareCta: { ...typography.caption, marginTop: 4, fontWeight: '700' },
  shareCtaTheirs: { color: colors.brand.secondary },
  edited: { ...typography.caption, marginTop: 2, fontWeight: '700' },
  editedMine: { color: colors.brand.onAccent, opacity: 0.72 },
  editedTheirs: { color: colors.brand.textSecondary },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  editBannerText: { ...typography.caption, color: colors.brand.textSecondary, fontWeight: '700' },
  editCancel: { ...typography.caption, color: colors.brand.secondary, fontWeight: '800' },
  error: {
    ...typography.caption,
    color: colors.brand.error,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.brand.surface,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    color: colors.brand.text,
    ...typography.body,
  },
  send: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { ...typography.bodySmall, color: colors.brand.onAccent, fontWeight: '800' },
});
