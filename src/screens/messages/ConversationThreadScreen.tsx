import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
import { UGC_LIMITS } from '@/utils/ugc-sanitize';

export default function ConversationThreadScreen() {
  const router = useRouter();
  const { id: rawId, name } = useLocalSearchParams<{ id: string | string[]; name?: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { user, profile } = useAuth();
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger la conversation.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!id) return;
    return MessagingService.subscribeToConversation(id, () => {
      void load();
    });
  }, [id, load]);

  const send = async () => {
    if (!id || busy || !draft.trim()) return;
    setBusy(true);
    try {
      const sent = await MessagingService.sendMessage(id, draft);
      setDraft('');
      setError(null);
      setMessages((current) =>
        current.some((row) => row.id === sent.id) ? current : [...current, sent],
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Envoi impossible.');
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
              return (
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.bubbleMineText : styles.bubbleText}>{item.body}</Text>
                </View>
              );
            }}
          />
        )}
        {error && messages.length > 0 ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Écrire un message"
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
            accessibilityLabel="Envoyer"
          >
            <Text style={styles.sendText}>Envoyer</Text>
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
