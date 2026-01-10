export type ReportReasonCode =
  | 'spam'
  | 'inappropriate'
  | 'harassment'
  | 'false_info'
  | 'dangerous'
  | 'other';

export type ReportReasonMeta = {
  code: ReportReasonCode;
  label: string;
  severity: 'minor' | 'harmful' | 'abusive' | 'illegal';
};

export const REPORT_REASONS: Record<ReportReasonCode, ReportReasonMeta> = {
  spam: {
    code: 'spam',
    label: 'Spam ou promotion non pertinente',
    severity: 'minor',
  },
  inappropriate: {
    code: 'inappropriate',
    label: 'Contenu inapproprié / offensant',
    severity: 'abusive',
  },
  harassment: {
    code: 'harassment',
    label: 'Harcèlement ou discours haineux',
    severity: 'harmful',
  },
  false_info: {
    code: 'false_info',
    label: 'Informations fausses ou trompeuses',
    severity: 'minor',
  },
  dangerous: {
    code: 'dangerous',
    label: 'Activité dangereuse ou illégale',
    severity: 'illegal',
  },
  other: {
    code: 'other',
    label: 'Autre motif',
    severity: 'minor',
  },
};

export const getReportReasonMeta = (reason?: string | null): ReportReasonMeta => {
  if (!reason) return REPORT_REASONS.other;
  const key = reason as ReportReasonCode;
  return REPORT_REASONS[key] || REPORT_REASONS.other;
};
