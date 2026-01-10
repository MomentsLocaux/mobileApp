import { supabase } from '@/lib/supabase/client';
import type {
  ModerationActionType,
  ModerationComment,
  ModerationContestEntry,
  ModerationEvent,
  ModerationMediaSubmission,
  ModerationWarning,
  ReportRecord,
  ReportStatus,
  ReportSeverity,
} from '@/types/moderation';

type StatusFilter = 'all' | 'resolved' | 'unresolved';
type SeverityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';
type BugStatus = 'open' | 'triage' | 'in_progress' | 'done' | 'ignored';

export interface ModerationBug {
  id: string;
  category: string;
  severity: string;
  description: string;
  page: string | null;
  created_at: string;
  status: BugStatus;
}

export const ModerationService = {
  async createNotification(payload: {
    userId: string;
    type: 'event_published' | 'system' | 'lumo_reward' | 'mission_completed' | 'social_follow' | 'social_like';
    title: string;
    body?: string | null;
    data?: Record<string, unknown>;
  }) {
    const { error } = await supabase.from('notifications').insert({
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      data: payload.data ?? {},
    });
    if (error) {
      throw new Error(error.message || 'Impossible de créer la notification');
    }
  },

  async logAction(payload: {
    targetType: 'event' | 'comment' | 'user' | 'challenge';
    targetId: string;
    actionType: ModerationActionType;
    moderatorId: string;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await supabase.from('moderation_actions').insert({
      target_type: payload.targetType,
      target_id: payload.targetId,
      action_type: payload.actionType,
      moderator_id: payload.moderatorId,
      metadata: payload.metadata ?? {},
    });
    if (error) throw new Error(error.message || 'Impossible de journaliser l’action');
  },

  async listPendingEvents(params?: { limit?: number; category?: string; creatorId?: string }) {
    let query = supabase
      .from('events')
      .select('id, title, description, status, category, city, address, starts_at, ends_at, cover_url, creator_id, creator:profiles!events_creator_id_fkey(id, display_name, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (params?.category) query = query.eq('category', params.category);
    if (params?.creatorId) query = query.eq('creator_id', params.creatorId);
    if (params?.limit) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les événements');
    return (data || []) as ModerationEvent[];
  },

  async updateEventStatus(payload: {
    eventId: string;
    status: 'published' | 'refused' | 'draft' | 'archived' | 'pending';
    moderatorId: string;
    actionType: ModerationActionType;
    note?: string;
  }) {
    const { data, error } = await supabase
      .from('events')
      .update({ status: payload.status })
      .eq('id', payload.eventId)
      .select('id, title, description, status, category, city, address, starts_at, ends_at, cover_url, creator_id')
      .single();
    if (error) throw new Error(error.message || 'Impossible de mettre à jour l’événement');
    await ModerationService.logAction({
      targetType: 'event',
      targetId: payload.eventId,
      actionType: payload.actionType,
      moderatorId: payload.moderatorId,
      metadata: payload.note ? { note: payload.note } : {},
    });

    if (data?.creator_id) {
      const isApproved = payload.actionType === 'approve';
      const title = isApproved
        ? 'Événement approuvé'
        : payload.actionType === 'request_changes'
          ? 'Modifications demandées'
          : payload.actionType === 'archive'
            ? 'Événement archivé'
            : 'Événement refusé';
      const body = payload.note
        ? payload.note
        : isApproved
          ? 'Votre événement est maintenant visible.'
          : 'Votre événement a été mis à jour par la modération.';
      await ModerationService.createNotification({
        userId: data.creator_id,
        type: isApproved ? 'event_published' : 'system',
        title,
        body,
        data: { eventId: data.id, action: payload.actionType },
      });
    }

    return data as ModerationEvent;
  },

  async listReports(params?: {
    status?: ReportStatus;
    targetType?: 'event' | 'comment' | 'user' | 'challenge';
    severity?: ReportSeverity;
    limit?: number;
  }) {
    let query = supabase
      .from('reports')
      .select('id, target_type, target_id, reporter_id, reason, status, severity, created_at')
      .order('created_at', { ascending: false });
    if (params?.status) query = query.eq('status', params.status);
    if (params?.targetType) query = query.eq('target_type', params.targetType);
    if (params?.severity) query = query.eq('severity', params.severity);
    if (params?.limit) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les signalements');
    return (data || []) as ReportRecord[];
  },

  async updateReportStatus(reportId: string, status: ReportStatus) {
    const { data, error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', reportId)
      .select('id, target_type, target_id, reporter_id, reason, status, severity, created_at')
      .single();
    if (error) throw new Error(error.message || 'Impossible de mettre à jour le signalement');
    return data as ReportRecord;
  },

  async listReportedComments(params?: { status?: ReportStatus; severity?: ReportSeverity; limit?: number }) {
    const reports = await ModerationService.listReports({
      status: params?.status,
      severity: params?.severity,
      targetType: 'comment',
      limit: params?.limit,
    });
    const commentIds = Array.from(new Set(reports.map((r) => r.target_id)));
    if (!commentIds.length) return { reports, comments: [] as ModerationComment[] };

    const { data, error } = await supabase
      .from('event_comments')
      .select('id, event_id, author_id, message, created_at, author:profiles!event_comments_author_id_fkey(id, display_name, avatar_url), event:events(id, title)')
      .in('id', commentIds);
    if (error) throw new Error(error.message || 'Impossible de charger les commentaires');
    return { reports, comments: (data || []) as ModerationComment[] };
  },

  async removeComment(payload: { commentId: string; moderatorId: string; reason?: string; authorId?: string; eventId?: string }) {
    const { error } = await supabase.from('event_comments').delete().eq('id', payload.commentId);
    if (error) throw new Error(error.message || 'Impossible de supprimer le commentaire');
    await ModerationService.logAction({
      targetType: 'comment',
      targetId: payload.commentId,
      actionType: 'remove',
      moderatorId: payload.moderatorId,
      metadata: payload.reason ? { reason: payload.reason } : {},
    });

    if (payload.authorId) {
      await ModerationService.createNotification({
        userId: payload.authorId,
        type: 'system',
        title: 'Commentaire supprimé',
        body: payload.reason || 'Votre commentaire a été supprimé par la modération.',
        data: { eventId: payload.eventId, commentId: payload.commentId },
      });
    }
  },

  async warnUser(payload: { userId: string; level: number; reason?: string; moderatorId: string }) {
    const { data, error } = await supabase
      .from('warnings')
      .insert({
        user_id: payload.userId,
        level: payload.level,
        reason: payload.reason ?? null,
        moderator_id: payload.moderatorId,
      })
      .select('id, user_id, level, reason, moderator_id, created_at')
      .single();
    if (error) throw new Error(error.message || 'Impossible de créer l’avertissement');
    await ModerationService.logAction({
      targetType: 'user',
      targetId: payload.userId,
      actionType: 'warn',
      moderatorId: payload.moderatorId,
      metadata: payload.reason ? { reason: payload.reason, level: payload.level } : { level: payload.level },
    });
    await ModerationService.createNotification({
      userId: payload.userId,
      type: 'system',
      title: 'Avertissement',
      body: payload.reason || `Un avertissement a été émis (niveau ${payload.level}).`,
      data: { level: payload.level },
    });
    return data as ModerationWarning;
  },

  async banUser(payload: { userId: string; moderatorId: string; reason?: string }) {
    await ModerationService.logAction({
      targetType: 'user',
      targetId: payload.userId,
      actionType: 'ban',
      moderatorId: payload.moderatorId,
      metadata: payload.reason ? { reason: payload.reason } : {},
    });
    await ModerationService.createNotification({
      userId: payload.userId,
      type: 'system',
      title: 'Compte bloqué',
      body: payload.reason || 'Votre compte a été bloqué par la modération.',
      data: {},
    });
  },

  async listWarnings(params?: { limit?: number }) {
    let query = supabase
      .from('warnings')
      .select('id, user_id, level, reason, moderator_id, created_at, user:profiles!warnings_user_id_fkey(id, display_name, avatar_url, city, role)')
      .order('created_at', { ascending: false });
    if (params?.limit) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les avertissements');
    return (data || []) as ModerationWarning[];
  },

  async listContestEntries(params?: { status?: 'active' | 'hidden' | 'removed'; limit?: number }) {
    let query = supabase
      .from('contest_entries')
      .select('id, contest_id, user_id, content, media_url, status, created_at, contest:contests(id, title), user:profiles!contest_entries_user_id_fkey(id, display_name, avatar_url)')
      .order('created_at', { ascending: false });
    if (params?.status) query = query.eq('status', params.status);
    if (params?.limit) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les participations');
    return (data || []) as ModerationContestEntry[];
  },

  async listMediaSubmissions(params?: { status?: 'pending' | 'approved' | 'rejected'; limit?: number }) {
    let query = supabase
      .from('event_media_submissions')
      .select(
        'id, event_id, author_id, url, status, reviewed_by, reviewed_at, created_at, author:profiles!event_media_submissions_author_id_fkey(id, display_name, avatar_url), event:events(id, title, creator_id)'
      )
      .order('created_at', { ascending: false });
    if (params?.status) query = query.eq('status', params.status);
    if (params?.limit) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les photos de la communauté');
    return (data || []) as ModerationMediaSubmission[];
  },

  async approveMediaSubmission(payload: { submissionId: string; moderatorId: string }) {
    const { data, error } = await supabase
      .from('event_media_submissions')
      .update({
        status: 'approved',
        reviewed_by: payload.moderatorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', payload.submissionId)
      .select('id, event_id, author_id, url, status, created_at, event:events(id, title, creator_id)')
      .single();
    if (error) throw new Error(error.message || 'Impossible de valider la photo');

    const { error: insertError } = await supabase.from('event_media').insert({
      event_id: data.event_id,
      url: data.url,
      position: 0,
    });
    if (insertError) throw new Error(insertError.message || "Impossible d'ajouter la photo à l'événement");

    await ModerationService.logAction({
      targetType: 'event',
      targetId: data.event_id,
      actionType: 'approve',
      moderatorId: payload.moderatorId,
      metadata: { submissionId: data.id },
    });

    if (data.author_id) {
      await ModerationService.createNotification({
        userId: data.author_id,
        type: 'system',
        title: 'Photo approuvée',
        body: "Votre photo a été publiée sur l'événement.",
        data: { eventId: data.event_id, submissionId: data.id },
      });
    }
    if (data.event?.creator_id && data.event.creator_id !== data.author_id) {
      await ModerationService.createNotification({
        userId: data.event.creator_id,
        type: 'system',
        title: 'Photo de communauté approuvée',
        body: `Une nouvelle photo a été ajoutée à "${data.event.title}".`,
        data: { eventId: data.event_id, submissionId: data.id },
      });
    }

    return data as ModerationMediaSubmission;
  },

  async rejectMediaSubmission(payload: { submissionId: string; moderatorId: string; reason?: string }) {
    const { data, error } = await supabase
      .from('event_media_submissions')
      .update({
        status: 'rejected',
        reviewed_by: payload.moderatorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', payload.submissionId)
      .select('id, event_id, author_id, url, status, created_at, event:events(id, title)')
      .single();
    if (error) throw new Error(error.message || 'Impossible de refuser la photo');

    await ModerationService.logAction({
      targetType: 'event',
      targetId: data.event_id,
      actionType: 'refuse',
      moderatorId: payload.moderatorId,
      metadata: payload.reason ? { reason: payload.reason, submissionId: data.id } : { submissionId: data.id },
    });

    if (data.author_id) {
      await ModerationService.createNotification({
        userId: data.author_id,
        type: 'system',
        title: 'Photo refusée',
        body: payload.reason || "Votre photo n'a pas été validée.",
        data: { eventId: data.event_id, submissionId: data.id },
      });
    }

    return data as ModerationMediaSubmission;
  },

  async updateContestEntryStatus(payload: {
    entryId: string;
    status: 'active' | 'hidden' | 'removed';
    moderatorId: string;
    reason?: string;
  }) {
    const { data, error } = await supabase
      .from('contest_entries')
      .update({ status: payload.status })
      .eq('id', payload.entryId)
      .select('id, contest_id, user_id, content, media_url, status, created_at')
      .single();
    if (error) throw new Error(error.message || 'Impossible de mettre à jour la participation');
    await ModerationService.logAction({
      targetType: 'challenge',
      targetId: payload.entryId,
      actionType: payload.status === 'removed' ? 'remove' : 'approve',
      moderatorId: payload.moderatorId,
      metadata: payload.reason ? { reason: payload.reason } : {},
    });
    if (data?.user_id) {
      const title = payload.status === 'active' ? 'Participation validée' : 'Participation refusée';
      await ModerationService.createNotification({
        userId: data.user_id,
        type: 'system',
        title,
        body: payload.reason || 'La modération a mis à jour votre participation.',
        data: { entryId: payload.entryId, status: payload.status },
      });
    }
    return data as ModerationContestEntry;
  },

  async getAnalytics(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    const [actions, reports, warnings, events] = await Promise.all([
      supabase.from('moderation_actions').select('id, created_at').gte('created_at', sinceIso),
      supabase.from('reports').select('id, created_at, severity').gte('created_at', sinceIso),
      supabase.from('warnings').select('id, created_at, level').gte('created_at', sinceIso),
      supabase.from('events').select('id, status, created_at').gte('created_at', sinceIso),
    ]);

    if (actions.error) throw new Error(actions.error.message || 'Erreur analytics actions');
    if (reports.error) throw new Error(reports.error.message || 'Erreur analytics reports');
    if (warnings.error) throw new Error(warnings.error.message || 'Erreur analytics warnings');
    if (events.error) throw new Error(events.error.message || 'Erreur analytics events');

    return {
      actions7d: actions.data?.length || 0,
      reports7d: reports.data?.length || 0,
      warnings7d: warnings.data?.length || 0,
      pendingEvents7d: (events.data || []).filter((e: any) => e.status === 'pending').length,
      severeReports7d: (reports.data || []).filter((r: any) => r.severity === 'abusive' || r.severity === 'illegal').length,
    };
  },

  async listBugs(params: { status: StatusFilter; severity: SeverityFilter; limit: number }) {
    let query = supabase
      .from('bug_reports')
      .select('id, category, severity, description, page, status, created_at')
      .order('created_at', { ascending: false })
      .limit(params.limit);

    if (params.status === 'resolved') {
      query = query.eq('status', 'done');
    } else if (params.status === 'unresolved') {
      query = query.neq('status', 'done');
    }

    if (params.severity !== 'all') {
      query = query.eq('severity', params.severity);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message || 'Impossible de charger les bugs');
    }
    return (data || []) as ModerationBug[];
  },

  async updateBugStatus(id: string, status: BugStatus) {
    const { data, error } = await supabase
      .from('bug_reports')
      .update({ status })
      .eq('id', id)
      .select('id, category, severity, description, page, status, created_at')
      .single();

    if (error) {
      throw new Error(error.message || 'Impossible de mettre à jour le bug');
    }

    return data as ModerationBug;
  },
};
