import { supabase } from '@/lib/supabase/client';
import { AuthService } from '@/services/auth.service';
import { isMissingSchemaError } from '@/utils/schema-missing';
import { sanitizeUgcText, UGC_LIMITS } from '@/utils/ugc-sanitize';
import { sanitizeIlikeFragment } from '@/utils/event-name-search';
import { canMessageProfile, normalizeProfileVisibility } from '@/utils/messaging-access';

export type DirectConversationPreview = {
  conversation_id: string;
  other_user_id: string;
  display_name: string;
  avatar_url: string | null;
  last_body: string | null;
  last_at: string | null;
  unread_count: number;
};

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
};

export type ShareRecipient = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
};

const asError = (error: unknown) => error as { code?: string; message?: string };

const toError = (error: unknown, fallback: string) => {
  const message = asError(error).message || fallback;
  return error instanceof Error ? error : new Error(message);
};

export const MessagingService = {
  async canMessage(targetId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('can_message_profile' as never, {
      p_target: targetId,
    } as never);
    if (error) {
      if (isMissingSchemaError(error)) return false;
      throw error;
    }
    return data === true;
  },

  async getUnreadCount(): Promise<number> {
    const session = await AuthService.ensureClientSession();
    if (!session) return 0;
    const { data, error } = await supabase.rpc('direct_messages_unread_count' as never);
    if (error) {
      if (isMissingSchemaError(error)) return 0;
      throw error;
    }
    return Number(data || 0);
  },

  async listConversations(): Promise<DirectConversationPreview[]> {
    const { data, error } = await supabase.rpc('list_my_direct_conversations' as never);
    if (error) {
      if (isMissingSchemaError(error)) return [];
      throw error;
    }
    return ((data || []) as DirectConversationPreview[]).map((row) => ({
      conversation_id: row.conversation_id,
      other_user_id: row.other_user_id,
      display_name: row.display_name || 'Membre',
      avatar_url: row.avatar_url ?? null,
      last_body: row.last_body ?? null,
      last_at: row.last_at ?? null,
      unread_count: Number(row.unread_count || 0),
    }));
  },

  /**
   * Members the signed-in user is allowed to message, matched by display name.
   * Public profiles, plus private profiles when the follow is mutual.
   */
  async searchRecipients(query: string): Promise<ShareRecipient[]> {
    const viewerId = (await supabase.auth.getUser()).data.user?.id;
    const fragment = sanitizeIlikeFragment(query);
    if (!viewerId || fragment.length < 2) return [];

    const [profiles, links] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, city, profile_visibility')
        .eq('status', 'active')
        .ilike('display_name', `%${fragment}%`)
        .order('display_name', { ascending: true })
        .limit(24),
      supabase
        .from('follows')
        .select('follower, following')
        .or(`follower.eq.${viewerId},following.eq.${viewerId}`),
    ]);
    if (profiles.error) throw profiles.error;
    if (links.error) throw links.error;

    const following = new Set(
      ((links.data || []) as { follower: string; following: string }[])
        .filter((row) => row.follower === viewerId)
        .map((row) => row.following),
    );
    const followers = new Set(
      ((links.data || []) as { follower: string; following: string }[])
        .filter((row) => row.following === viewerId)
        .map((row) => row.follower),
    );

    return ((profiles.data || []) as {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      city: string | null;
      profile_visibility: string | null;
    }[])
      .filter((row) => row.id && row.id !== viewerId && row.display_name)
      .filter((row) => canMessageProfile({
        viewerId,
        targetId: row.id,
        visibility: normalizeProfileVisibility(row.profile_visibility),
        viewerFollowsTarget: following.has(row.id),
        targetFollowsViewer: followers.has(row.id),
      }).allowed)
      .slice(0, 12)
      .map((row) => ({
        userId: row.id,
        displayName: row.display_name || 'Membre',
        avatarUrl: row.avatar_url,
        city: row.city,
      }));
  },

  async openConversation(targetId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation' as never, {
      p_target: targetId,
    } as never);
    if (error) {
      const message = asError(error).message || 'Impossible d’ouvrir la conversation.';
      throw new Error(message);
    }
    if (!data || typeof data !== 'string') {
      throw new Error('Impossible d’ouvrir la conversation.');
    }
    return data;
  },

  async listMessages(conversationId: string, limit = 80): Promise<DirectMessage[]> {
    const columns = 'id, conversation_id, sender_id, body, created_at, edited_at';
    const query = (supabase.from('direct_messages') as any)
      .select(columns)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    const { data, error } = await query;
    if (error && isMissingSchemaError(error)) {
      const fallback = await (supabase.from('direct_messages') as any)
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (fallback.error) {
        if (isMissingSchemaError(fallback.error)) return [];
        throw toError(fallback.error, 'Impossible de charger la conversation.');
      }
      return ((fallback.data || []) as Omit<DirectMessage, 'edited_at'>[]).map((row) => ({
        ...row,
        edited_at: null,
      }));
    }
    if (error) {
      throw toError(error, 'Impossible de charger la conversation.');
    }
    return (data || []) as DirectMessage[];
  },

  async sendMessage(conversationId: string, body: string): Promise<DirectMessage> {
    const sanitized = sanitizeUgcText(body, UGC_LIMITS.directMessage);
    if (!sanitized) {
      throw new Error('Écris un message avant d’envoyer.');
    }
    const { data, error } = await supabase.rpc('send_direct_message' as never, {
      p_conversation_id: conversationId,
      p_body: sanitized,
    } as never);
    if (error) {
      throw new Error(asError(error).message || 'Envoi impossible.');
    }
    return data as DirectMessage;
  },

  async editMessage(messageId: string, body: string): Promise<DirectMessage> {
    const sanitized = sanitizeUgcText(body, UGC_LIMITS.directMessage);
    if (!sanitized) {
      throw new Error('Écris un message avant d’enregistrer.');
    }
    const { data, error } = await supabase.rpc('edit_direct_message' as never, {
      p_message_id: messageId,
      p_body: sanitized,
    } as never);
    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error('La modification des messages n’est pas encore disponible.');
      }
      throw new Error(asError(error).message || 'Modification impossible.');
    }
    return data as DirectMessage;
  },

  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_direct_message' as never, {
      p_message_id: messageId,
    } as never);
    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error('La suppression des messages n’est pas encore disponible.');
      }
      throw new Error(asError(error).message || 'Suppression impossible.');
    }
  },

  async markRead(conversationId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_direct_conversation_read' as never, {
      p_conversation_id: conversationId,
    } as never);
    if (error && !isMissingSchemaError(error)) {
      console.warn('mark conversation read', error);
    }
  },

  subscribeToConversation(conversationId: string, onChange: () => void) {
    const channel = supabase
      .channel(`direct-messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },

  subscribeToInbox(userId: string, onChange: () => void) {
    const channel = supabase
      .channel(`direct-inbox:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
