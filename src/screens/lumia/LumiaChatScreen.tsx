import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { LumiaRichText } from '@/components/lumia/LumiaRichText';
import { features } from '@/config/features';
import { LUMIA_AVATAR_LOCAL, LUMIA_NAME } from '@/constants/lumia';
import { isAllowedLumiaHref } from '@/constants/lumia-deeplinks';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import {
  askLumia,
  type LumiaAction,
  type LumiaChatReply,
} from '@/services/lumia-chat.service';
import { useLumiaChatStore } from '@/store/lumiaChatStore';
import type { LumiaHistoryTurn } from '@/utils/lumia-conversation';
import type { EventWithCreator } from '@/types/database';

type ChatMessage = {
  id: string;
  role: 'lumia' | 'user';
  text: string;
  events?: Pick<EventWithCreator, 'id' | 'title' | 'city'>[];
  actions?: LumiaAction[];
};

export default function LumiaChatScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const messages = useLumiaChatStore((state) => state.messages);
  const hydrateForUser = useLumiaChatStore((state) => state.hydrateForUser);
  const appendMessage = useLumiaChatStore((state) => state.appendMessage);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{
    limit: number;
    remaining: number | null;
    period: string;
  } | null>(null);

  useEffect(() => {
    hydrateForUser(user?.id ?? null);
  }, [hydrateForUser, user?.id]);

  const openHref = useCallback(
    (href: string) => {
      if (!isAllowedLumiaHref(href)) return;
      router.push(href as any);
    },
    [router],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    const history: LumiaHistoryTurn[] = messages
      .filter((item) => item.id !== 'welcome' && item.text.trim().length > 0)
      .map((item) => ({ role: item.role, text: item.text }));
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
    appendMessage(userMsg);
    setBusy(true);
    try {
      const reply: LumiaChatReply = await askLumia(text, {
        history,
        city: profile?.city ?? null,
      });
      if (reply.quota) {
        setQuota(reply.quota);
      }
      appendMessage({
        id: `l-${Date.now()}`,
        role: 'lumia',
        text: reply.text,
        events: reply.events.map((event) => ({
          id: event.id,
          title: event.title,
          city: event.city,
        })),
        actions: reply.actions,
      });
    } catch {
      appendMessage({
        id: `e-${Date.now()}`,
        role: 'lumia',
        text: 'Je n’ai pas pu chercher pour le moment. Réessaie dans un instant, ou ouvre la carte.',
      });
    } finally {
      setBusy(false);
    }
  }, [appendMessage, busy, draft, messages, profile?.city]);

  const quotaLabel =
    quota && typeof quota.remaining === 'number'
      ? quota.remaining === 0
        ? `Quota atteint (${quota.limit}/mois)`
        : `${quota.remaining} message${quota.remaining > 1 ? 's' : ''} restant${quota.remaining > 1 ? 's' : ''} ce mois`
      : null;

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
                  <Image source={LUMIA_AVATAR_LOCAL} style={styles.lumiaTagAvatar} />
                  <Text style={styles.lumiaTagText}>{LUMIA_NAME}</Text>
                </View>
              ) : null}
              {item.role === 'lumia' ? (
                <LumiaRichText style={styles.bubbleText} onLinkPress={openHref}>
                  {item.text}
                </LumiaRichText>
              ) : (
                <Text style={styles.bubbleUserText}>{item.text}</Text>
              )}
              {item.actions?.length ? (
                <View style={styles.actionsRow}>
                  {item.actions.map((action) => (
                    <Pressable
                      key={action.href}
                      style={styles.actionChip}
                      onPress={() => openHref(action.href)}
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                    >
                      <Text style={styles.actionChipText} numberOfLines={1}>
                        {action.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {item.events?.map((event) => (
                <Pressable
                  key={event.id}
                  style={styles.eventChip}
                  onPress={() => openHref(`/events/${event.id}`)}
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
        <View style={styles.composerWrap}>
          {quotaLabel ? <Text style={styles.quotaHint}>{quotaLabel}</Text> : null}
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
              editable={!busy && quota?.remaining !== 0}
            />
            <Pressable
              style={[
                styles.send,
                (!draft.trim() || busy || quota?.remaining === 0) && styles.sendDisabled,
              ]}
              onPress={() => {
                void send();
              }}
              disabled={!draft.trim() || busy || quota?.remaining === 0}
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
  lumiaTagAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  lumiaTagText: { ...typography.caption, color: colors.brand.textSecondary, fontWeight: '600' },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.secondary,
  },
  actionChipText: {
    ...typography.caption,
    color: colors.brand.onAccent,
    fontWeight: '700',
  },
  eventChip: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.surfaceMuted,
  },
  eventChipTitle: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '600' },
  eventChipMeta: { ...typography.caption, color: colors.brand.textSecondary },
  composerWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  quotaHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
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
