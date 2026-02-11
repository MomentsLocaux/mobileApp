export type ModerationTargetType = 'event' | 'comment' | 'user' | 'challenge' | 'media' | 'contest_entry';
export type ModerationActionType =
  | 'approve'
  | 'refuse'
  | 'remove'
  | 'warn'
  | 'ban'
  | 'request_changes'
  | 'archive';

export type ReportStatus = 'new' | 'in_review' | 'closed' | 'escalated';
export type ReportSeverity = 'minor' | 'harmful' | 'abusive' | 'illegal';

export type ReportRecord = {
  id: string;
  target_type: ModerationTargetType;
  target_id: string;
  reporter_id: string;
  reason: string | null;
  status: ReportStatus;
  severity: ReportSeverity;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

export type ModerationReportTargetPreview =
  | {
      type: 'event';
      id: string;
      title: string | null;
      city?: string | null;
      status?: string | null;
      starts_at?: string | null;
      creator_name?: string | null;
    }
  | {
      type: 'comment';
      id: string;
      message: string | null;
      event_id?: string | null;
      event_title?: string | null;
      author_name?: string | null;
    }
  | {
      type: 'user';
      id: string;
      display_name: string | null;
      role?: string | null;
      status?: 'active' | 'restricted' | 'suspended' | 'banned' | null;
      ban_until?: string | null;
    }
  | {
      type: 'media';
      id: string;
      url: string | null;
      status?: string | null;
      event_id?: string | null;
      event_title?: string | null;
      author_name?: string | null;
    }
  | {
      type: 'contest_entry';
      id: string;
      content?: string | null;
      status?: string | null;
      contest_id?: string | null;
      contest_title?: string | null;
      author_name?: string | null;
    }
  | {
      type: 'challenge';
      id: string;
      content?: string | null;
      status?: string | null;
      contest_id?: string | null;
      contest_title?: string | null;
      author_name?: string | null;
    }
  | {
      type: 'unknown';
      id: string;
    };

export type ReportRecordWithTarget = ReportRecord & {
  reporter?: {
    id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  reviewer?: {
    id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  target_preview?: ModerationReportTargetPreview | null;
};

export type ModerationEvent = {
  id: string;
  title: string;
  description: string;
  status: string | null;
  category?: string | null;
  city?: string | null;
  address?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  cover_url?: string | null;
  creator_id?: string | null;
  creator?: { id: string; display_name: string; avatar_url?: string | null } | null;
};

export type ModerationComment = {
  id: string;
  event_id: string;
  author_id: string;
  message: string;
  created_at: string;
  author?: { id: string; display_name: string; avatar_url?: string | null } | null;
  event?: { id: string; title: string } | null;
};

export type ModerationWarning = {
  id: string;
  user_id: string;
  level: number;
  reason?: string | null;
  moderator_id: string;
  created_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
    city?: string | null;
    role?: string | null;
    status?: 'active' | 'restricted' | 'suspended' | 'banned' | null;
    ban_until?: string | null;
  } | null;
};

export type ModerationContestEntry = {
  id: string;
  contest_id: string;
  user_id: string;
  content?: string | null;
  media_url?: string | null;
  status: 'active' | 'hidden' | 'removed';
  created_at: string;
  contest?: { id: string; title: string } | null;
  user?: { id: string; display_name: string; avatar_url?: string | null } | null;
};

export type ModerationMediaSubmission = {
  id: string;
  event_id: string;
  author_id: string;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  author?: { id: string; display_name: string; avatar_url?: string | null } | null;
  event?: { id: string; title: string; creator_id?: string | null } | null;
  report_count?: number;
  report_status?: ReportStatus | null;
  report_severity?: ReportSeverity | null;
  last_report_at?: string | null;
};
