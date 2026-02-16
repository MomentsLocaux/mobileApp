import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/state/auth';
import type { CommentWithAuthor } from '@/types/database';
import { CommentsService } from '@/services/comments.service';

export function useComments(eventId: string) {
  const { user, session } = useAuthStore();
  const currentUserId = user?.id ?? session?.user?.id ?? null;
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await CommentsService.list(eventId);
      setComments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement commentaires');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const addComment = useCallback(
    async (message: string, rating?: number | null, parentCommentId?: string | null) => {
      if (!currentUserId) throw new Error('Non authentifié');
      const newComment = await CommentsService.create(
        eventId,
        currentUserId,
        message,
        rating,
        parentCommentId ?? null,
      );
      if (newComment) {
        setComments((prev) => [newComment, ...prev]);
      }
    },
    [currentUserId, eventId],
  );

  const replyToComment = useCallback(
    async (parentCommentId: string, message: string) => {
      await addComment(message, null, parentCommentId);
    },
    [addComment],
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!currentUserId) throw new Error('Non authentifié');
      await CommentsService.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [currentUserId],
  );

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  return { comments, loading, error, reload: loadComments, addComment, replyToComment, removeComment };
}
