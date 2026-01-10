import { dataProvider } from '@/data-provider';
import { getReportReasonMeta, type ReportReasonCode } from '@/constants/report-reasons';

export const ReportService = {
  event: (eventId: string, payload: { reason: ReportReasonCode; details?: string }) => {
    const meta = getReportReasonMeta(payload.reason);
    return dataProvider.reportEvent(eventId, {
      reason: meta.code,
      severity: meta.severity,
      details: payload.details,
    });
  },
  comment: (commentId: string, payload: { reason: ReportReasonCode; details?: string }) => {
    const meta = getReportReasonMeta(payload.reason);
    return dataProvider.reportComment(commentId, {
      reason: meta.code,
      severity: meta.severity,
      details: payload.details,
    });
  },
};
