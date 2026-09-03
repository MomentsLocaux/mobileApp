import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LUMIA_CHAT_WELCOME } from '@/constants/lumia';
import type { LumiaAction } from '@/services/lumia-chat.service';
import { persistStorage } from './persistStorage';

export type LumiaChatStoredEvent = {
  id: string;
  title: string;
  city: string | null;
};

export type LumiaChatStoredMessage = {
  id: string;
  role: 'lumia' | 'user';
  text: string;
  events?: LumiaChatStoredEvent[];
  actions?: LumiaAction[];
};

const MAX_STORED_MESSAGES = 40;

const welcomeMessage = (): LumiaChatStoredMessage => ({
  id: 'welcome',
  role: 'lumia',
  text: LUMIA_CHAT_WELCOME,
});

type LumiaChatState = {
  userId: string | null;
  messages: LumiaChatStoredMessage[];
  hydrateForUser: (userId: string | null) => void;
  appendMessage: (message: LumiaChatStoredMessage) => void;
  replaceMessages: (messages: LumiaChatStoredMessage[]) => void;
  clearConversation: () => void;
};

function capMessages(messages: LumiaChatStoredMessage[]): LumiaChatStoredMessage[] {
  if (messages.length <= MAX_STORED_MESSAGES) return messages;
  const welcome = messages.find((item) => item.id === 'welcome') ?? welcomeMessage();
  const rest = messages.filter((item) => item.id !== 'welcome').slice(-(MAX_STORED_MESSAGES - 1));
  return [welcome, ...rest];
}

export const useLumiaChatStore = create<LumiaChatState>()(
  persist(
    (set, get) => ({
      userId: null,
      messages: [welcomeMessage()],
      hydrateForUser: (userId) => {
        const current = get().userId;
        if (current === userId && get().messages.length) return;
        if (current && userId && current !== userId) {
          set({ userId, messages: [welcomeMessage()] });
          return;
        }
        if (!get().messages.length) {
          set({ userId, messages: [welcomeMessage()] });
          return;
        }
        set({ userId });
      },
      appendMessage: (message) =>
        set((state) => ({
          messages: capMessages([...state.messages, message]),
        })),
      replaceMessages: (messages) => set({ messages: capMessages(messages) }),
      clearConversation: () => set({ messages: [welcomeMessage()], userId: null }),
    }),
    {
      name: 'lumia-chat-store',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({
        userId: state.userId,
        messages: capMessages(state.messages),
      }),
    },
  ),
);
