import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/state/auth';
import type { CommentWithAuthor } from '@/types/database';
import { CommentsService } from '@/services/comments.service';

export function useComments(eventId: string) {
  const { user } = useAuthStore();
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
    async (message: string, rating?: number | null) => {
      if (!user) throw new Error('Non authentifié');
      const newComment = await CommentsService.create(eventId, user.id, message, rating);
      if (newComment) {
        setComments((prev) => [newComment, ...prev]);
      }
    },
    [eventId, user],
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!user) throw new Error('Non authentifié');
      await CommentsService.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [user],
  );

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  return { comments, loading, error, reload: loadComments, addComment, removeComment };
}
