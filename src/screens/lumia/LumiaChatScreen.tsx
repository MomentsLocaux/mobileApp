import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { features } from '@/config/features';
import { LUMIA_NAME } from '@/constants/lumia';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import {
  askLumia,
  LUMIA_CHAT_WELCOME,
  type LumiaChatReply,
} from '@/services/lumia-chat.service';
import type { EventWithCreator } from '@/types/database';

type ChatMessage = {
  id: string;
  role: 'lumia' | 'user';
  text: string;
  events?: EventWithCreator[];
};

const INITIAL: ChatMessage[] = [
  { id: 'welcome', role: 'lumia', text: LUMIA_CHAT_WELCOME },
];

export default function LumiaChatScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    try {
      const reply: LumiaChatReply = await askLumia(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `l-${Date.now()}`,
          role: 'lumia',
          text: reply.text,
          events: reply.events,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'lumia',
          text: 'Je n’ai pas pu chercher pour le moment. Réessaie dans un instant, ou ouvre la carte.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [busy, draft]);

  if (!features.lumiaChat) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.root}>
      <AppBackground />
      <ScreenHeader title={LUMIA_NAME} onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleLumia]}>
              {item.role === 'lumia' ? (
                <View style={styles.lumiaTag}>
                  <Sparkles size={12} color={colors.brand.secondary} />
                  <Text style={styles.lumiaTagText}>{LUMIA_NAME}</Text>
                </View>
              ) : null}
              <Text style={item.role === 'user' ? styles.bubbleUserText : styles.bubbleText}>
                {item.text}
              </Text>
              {item.events?.map((event) => (
                <Pressable
                  key={event.id}
                  style={styles.eventChip}
                  onPress={() => router.push(`/events/${event.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir ${event.title}`}
                >
                  <Text style={styles.eventChipTitle} numberOfLines={2}>
                    {event.title}
                  </Text>
                  {event.city ? (
                    <Text style={styles.eventChipMeta} numberOfLines={1}>
                      {event.city}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Ex. comment ouvrir la carte, ou concert à Lyon"
            placeholderTextColor={colors.brand.textSecondary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => {
              void send();
            }}
            returnKeyType="send"
            editable={!busy}
          />
          <Pressable
            style={[styles.send, (!draft.trim() || busy) && styles.sendDisabled]}
            onPress={() => {
              void send();
            }}
            disabled={!draft.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
          >
            {busy ? (
              <ActivityIndicator color={colors.brand.onAccent} size="small" />
            ) : (
              <Text style={styles.sendText}>OK</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },
  bubble: {
    maxWidth: '92%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bubbleLumia: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand.secondary,
  },
  bubbleText: {
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 22,
  },
  bubbleUserText: {
    ...typography.body,
    color: colors.brand.onAccent,
    lineHeight: 22,
  },
  lumiaTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lumiaTagText: { ...typography.caption, color: colors.brand.textSecondary, fontWeight: '600' },
  eventChip: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.surfaceMuted,
  },
  eventChipTitle: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '600' },
  eventChipMeta: { ...typography.caption, color: colors.brand.textSecondary },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    color: colors.brand.text,
    fontSize: 16,
  },
  send: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { ...typography.bodyBold, color: colors.brand.onAccent },
});
