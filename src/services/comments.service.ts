import { dataProvider } from '@/data-provider';
import type { CommentWithAuthor } from '@/types/database';

export const CommentsService = {
  list: (eventId: string): Promise<CommentWithAuthor[]> => dataProvider.listComments(eventId),
  create: (
    eventId: string,
    authorId: string,
    message: string,
    rating?: number | null,
    parentCommentId?: string | null,
  ): Promise<CommentWithAuthor | null> =>
    dataProvider.createComment({ eventId, authorId, message, rating, parentCommentId }),
  delete: (commentId: string): Promise<boolean> => dataProvider.deleteComment(commentId),
};
