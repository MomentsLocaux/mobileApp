import { dataProvider } from '@/data-provider';

export const ReportService = {
  event: (eventId: string, payload: { reason: string; severity?: string; details?: string }) =>
    dataProvider.reportEvent(eventId, payload),
  comment: (commentId: string, payload: { reason: string; severity?: string; details?: string }) =>
    dataProvider.reportComment(commentId, payload),
};
