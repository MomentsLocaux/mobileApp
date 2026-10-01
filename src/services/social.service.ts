import { dataProvider } from '@/data-provider';
import { supabase } from '@/lib/supabase/client';

export class SocialService {
  static async getHeartState(userId: string, eventId: string) {
    const [like, favorite] = await Promise.all([
      supabase.from('event_likes').select('event_id').eq('user_id', userId).eq('event_id', eventId).maybeSingle(),
      supabase.from('favorites').select('event_id').eq('profile_id', userId).eq('event_id', eventId).maybeSingle(),
    ]);
    if (like.error) throw like.error;
    if (favorite.error) throw favorite.error;
    return { isLiked: !!like.data, isFavorite: !!favorite.data };
  }

  static async toggleFavorite(_userId: string, eventId: string): Promise<boolean> {
    return dataProvider.toggleFavorite(eventId);
  }

  static async removeFavorite(userId: string, eventId: string): Promise<void> {
    // Keep the initiating account fixed even if the session changes mid-request.
    const { error } = await supabase.from('favorites').delete()
      .eq('profile_id', userId).eq('event_id', eventId);
    if (error) throw error;
  }

  static async toggleInterest(_userId: string, eventId: string): Promise<boolean> {
    return dataProvider.toggleInterest(eventId);
  }

  static async like(_userId: string, eventId: string): Promise<boolean> {
    return dataProvider.like(eventId);
  }

  static async unlike(userId: string, eventId: string): Promise<void> {
    const { error } = await supabase.from('event_likes').delete()
      .eq('user_id', userId).eq('event_id', eventId);
    if (error) throw error;
  }

  static async likeComment(_userId: string, commentId: string): Promise<boolean> {
    return dataProvider.likeComment(commentId);
  }

  static async likeMedia(_userId: string, mediaId: string): Promise<boolean> {
    return dataProvider.likeMedia(mediaId);
  }
}
