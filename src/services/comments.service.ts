import { supabase } from '../lib/supabase';
import type { EventComment, CommentWithAuthor } from '../types/database';

export class CommentsService {
  static async listComments(eventId: string): Promise<CommentWithAuthor[]> {
    try {
      const { data, error } = await supabase
        .from('event_comments')
        .select(
          `
          *,
          author:profiles!user_id(*)
        `
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error listing comments:', error);
        return [];
      }

      return (
        data?.map((comment) => ({
          ...comment,
          author: comment.author || {
            id: comment.user_id,
            display_name: 'Utilisateur supprimé',
            email: '',
            avatar_url: null,
            bio: null,
            role: 'denicheur' as const,
            onboarding_completed: false,
            created_at: '',
            updated_at: '',
          },
        })) || []
      );
    } catch (error) {
      console.error('Unexpected error listing comments:', error);
      return [];
    }
  }

  static async createComment(
    userId: string,
    eventId: string,
    content: string
  ): Promise<EventComment | null> {
    try {
      const { data, error } = await supabase
        .from('event_comments')
        .insert({
          user_id: userId,
          event_id: eventId,
          content,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating comment:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error creating comment:', error);
      return null;
    }
  }

  static async deleteComment(commentId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('event_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting comment:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error deleting comment:', error);
      return false;
    }
  }
}
