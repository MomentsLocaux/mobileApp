import { supabase } from '@/lib/supabase/client';
import type {
  ModerationActionType,
  ModerationComment,
  ModerationContestEntry,
  ModerationEvent,
  ModerationMediaSubmission,
  ModerationReportTargetPreview,
  ModerationTargetType,
  ModerationWarning,
  ReportRecord,
  ReportRecordWithTarget,
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

type ModerationNotificationType =
  | 'event_published'
  | 'event_soon'
  | 'lumo_reward'
  | 'mission_completed'
  | 'boost_expired'
  | 'social_follow'
  | 'social_like'
  | 'system'
  | 'event_refused'
  | 'event_request_changes'
  | 'warning_received'
  | 'user_banned'
  | 'media_approved'
  | 'media_rejected'
  | 'contest_entry_refused'
  | 'moderation_escalation';

const firstOrNull = <T>(value: any): T | null => {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return (value ?? null) as T | null;
};

const clampWarningLevel = (value: number) => Math.min(3, Math.max(1, Math.trunc(value)));

const addDaysIso = (days: number) => {
  const at = new Date();
  at.setDate(at.getDate() + days);
  return at.toISOString();
};

const generateEventQrToken = () => {
  try {
    const uuid = (globalThis as any)?.crypto?.randomUUID?.();
    if (typeof uuid === 'string' && uuid.length > 0) {
      return uuid.replace(/-/g, '');
    }
  } catch {
    // fallback below
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
};

const getWarningSanction = (level: number): {
  profileStatus: 'active' | 'restricted' | 'banned';
  banUntil: string | null;
  notificationType: ModerationNotificationType;
  notificationTitle: string;
  notificationBody: string;
} => {
  if (level >= 3) {
    const banUntil = addDaysIso(30);
    return {
      profileStatus: 'banned',
      banUntil,
      notificationType: 'user_banned',
      notificationTitle: 'Compte bloqué temporairement',
      notificationBody: `Votre compte est bloqué jusqu'au ${new Date(banUntil).toLocaleDateString('fr-FR')}.`,
    };
  }
  if (level === 2) {
    const banUntil = addDaysIso(3);
    return {
      profileStatus: 'restricted',
      banUntil,
      notificationType: 'warning_received',
      notificationTitle: 'Avertissement niveau 2',
      notificationBody: `Votre compte est restreint jusqu'au ${new Date(banUntil).toLocaleDateString('fr-FR')}.`,
    };
  }
  return {
    profileStatus: 'active',
    banUntil: null,
    notificationType: 'warning_received',
    notificationTitle: 'Avertissement',
    notificationBody: 'Un avertissement a été émis sur votre compte.',
  };
};

export const ModerationService = {
  async createNotification(payload: {
    userId: string;
    type: ModerationNotificationType;
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
    targetType: ModerationTargetType;
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
    const normalized = ((data || []) as any[]).map((row) => ({
      ...row,
      creator: firstOrNull(row.creator),
    }));
    return normalized as unknown as ModerationEvent[];
  },

  async updateEventStatus(payload: {
    eventId: string;
    status: 'published' | 'refused' | 'draft' | 'archived' | 'pending';
    moderatorId: string;
    actionType: ModerationActionType;
    note?: string;
  }) {
    let updateData: { status: string; qr_token?: string; qr_generated_at?: string } = { status: payload.status };

    if (payload.status === 'published') {
      const { data: existing } = await supabase
        .from('events')
        .select('qr_token')
        .eq('id', payload.eventId)
        .maybeSingle();

      if (!existing?.qr_token) {
        updateData = {
          ...updateData,
          qr_token: generateEventQrToken(),
          qr_generated_at: new Date().toISOString(),
        };
      }
    }

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
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

    return data as ModerationEvent;
  },

  async listReports(params?: {
    status?: ReportStatus;
    targetType?: ModerationTargetType;
    severity?: ReportSeverity;
    limit?: number;
  }) {
    let query = supabase
      .from('reports')
      .select('id, target_type, target_id, reporter_id, reason, status, severity, reviewed_by, reviewed_at, created_at')
      .order('created_at', { ascending: false });
    if (params?.status) query = query.eq('status', params.status);
    if (params?.targetType) query = query.eq('target_type', params.targetType);
    if (params?.severity) query = query.eq('severity', params.severity);
    if (params?.limit) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les signalements');
    return (data || []) as unknown as ReportRecord[];
  },

  async listReportsWithTargets(params?: {
    status?: ReportStatus;
    targetType?: ModerationTargetType;
    severity?: ReportSeverity;
    limit?: number;
    excludeClosed?: boolean;
  }) {
    let query = supabase
      .from('reports')
      .select(
        'id, target_type, target_id, reporter_id, reason, status, severity, reviewed_by, reviewed_at, created_at, reporter:profiles!reports_reporter_id_fkey(id, display_name, avatar_url), reviewer:profiles!reports_reviewed_by_fkey(id, display_name, avatar_url)'
      )
      .order('created_at', { ascending: false });
    if (params?.excludeClosed) query = query.neq('status', 'closed');
    if (params?.status) query = query.eq('status', params.status);
    if (params?.targetType) query = query.eq('target_type', params.targetType);
    if (params?.severity) query = query.eq('severity', params.severity);
    if (params?.limit) query = query.limit(params.limit);

    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les signalements');

    const reports = ((data || []) as any[]).map((row) => ({
      ...row,
      reporter: firstOrNull(row.reporter),
      reviewer: firstOrNull(row.reviewer),
    })) as ReportRecordWithTarget[];

    const eventIds = new Set<string>();
    const commentIds = new Set<string>();
    const userIds = new Set<string>();
    const mediaIds = new Set<string>();
    const contestEntryIds = new Set<string>();

    for (const report of reports) {
      if (!report?.target_id) continue;
      if (report.target_type === 'event') eventIds.add(report.target_id);
      if (report.target_type === 'comment') commentIds.add(report.target_id);
      if (report.target_type === 'user') userIds.add(report.target_id);
      if (report.target_type === 'media') mediaIds.add(report.target_id);
      if (report.target_type === 'contest_entry' || report.target_type === 'challenge') {
        contestEntryIds.add(report.target_id);
      }
    }

    const previewByKey = new Map<string, ModerationReportTargetPreview>();
    const toKey = (type: string, id: string) => `${type}:${id}`;

    if (eventIds.size > 0) {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, city, status, starts_at, creator:profiles!events_creator_id_fkey(display_name)')
        .in('id', Array.from(eventIds));
      if (eventsError) throw new Error(eventsError.message || 'Impossible de charger le détail des événements signalés');

      for (const row of (eventsData || []) as any[]) {
        const creator = firstOrNull<{ display_name?: string | null }>(row.creator);
        previewByKey.set(toKey('event', row.id), {
          type: 'event',
          id: row.id,
          title: row.title ?? null,
          city: row.city ?? null,
          status: row.status ?? null,
          starts_at: row.starts_at ?? null,
          creator_name: creator?.display_name ?? null,
        });
      }
    }

    if (commentIds.size > 0) {
      const { data: commentsData, error: commentsError } = await supabase
        .from('event_comments')
        .select(
          'id, message, event_id, event:events(id, title), author:profiles!event_comments_author_id_fkey(display_name)'
        )
        .in('id', Array.from(commentIds));
      if (commentsError) throw new Error(commentsError.message || 'Impossible de charger le détail des commentaires signalés');

      for (const row of (commentsData || []) as any[]) {
        const event = firstOrNull<{ id?: string; title?: string | null }>(row.event);
        const author = firstOrNull<{ display_name?: string | null }>(row.author);
        previewByKey.set(toKey('comment', row.id), {
          type: 'comment',
          id: row.id,
          message: row.message ?? null,
          event_id: event?.id ?? row.event_id ?? null,
          event_title: event?.title ?? null,
          author_name: author?.display_name ?? null,
        });
      }
    }

    if (userIds.size > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, display_name, role, status, ban_until')
        .in('id', Array.from(userIds));
      if (usersError) throw new Error(usersError.message || 'Impossible de charger le détail des utilisateurs signalés');

      for (const row of (usersData || []) as any[]) {
        previewByKey.set(toKey('user', row.id), {
          type: 'user',
          id: row.id,
          display_name: row.display_name ?? null,
          role: row.role ?? null,
          status: row.status ?? null,
          ban_until: row.ban_until ?? null,
        });
      }
    }

    if (mediaIds.size > 0) {
      const { data: mediaData, error: mediaError } = await supabase
        .from('event_media_submissions')
        .select(
          'id, url, status, event_id, event:events(id, title), author:profiles!event_media_submissions_author_id_fkey(display_name)'
        )
        .in('id', Array.from(mediaIds));
      if (mediaError) throw new Error(mediaError.message || 'Impossible de charger le détail des médias signalés');

      for (const row of (mediaData || []) as any[]) {
        const event = firstOrNull<{ id?: string; title?: string | null }>(row.event);
        const author = firstOrNull<{ display_name?: string | null }>(row.author);
        previewByKey.set(toKey('media', row.id), {
          type: 'media',
          id: row.id,
          url: row.url ?? null,
          status: row.status ?? null,
          event_id: event?.id ?? row.event_id ?? null,
          event_title: event?.title ?? null,
          author_name: author?.display_name ?? null,
        });
      }
    }

    if (contestEntryIds.size > 0) {
      const { data: entriesData, error: entriesError } = await supabase
        .from('contest_entries')
        .select(
          'id, content, status, contest_id, contest:contests(id, title), user:profiles!contest_entries_user_id_fkey(display_name)'
        )
        .in('id', Array.from(contestEntryIds));
      if (entriesError) throw new Error(entriesError.message || 'Impossible de charger le détail des participations signalées');

      for (const row of (entriesData || []) as any[]) {
        const contest = firstOrNull<{ id?: string; title?: string | null }>(row.contest);
        const user = firstOrNull<{ display_name?: string | null }>(row.user);
        const previewBase = {
          id: row.id,
          content: row.content ?? null,
          status: row.status ?? null,
          contest_id: contest?.id ?? row.contest_id ?? null,
          contest_title: contest?.title ?? null,
          author_name: user?.display_name ?? null,
        };

        previewByKey.set(toKey('contest_entry', row.id), {
          type: 'contest_entry',
          ...previewBase,
        });
        previewByKey.set(toKey('challenge', row.id), {
          type: 'challenge',
          ...previewBase,
        });
      }
    }

    return reports.map((report) => {
      const exactKey = toKey(report.target_type, report.target_id);
      const fallbackKey =
        report.target_type === 'challenge' ? toKey('contest_entry', report.target_id) : undefined;
      const targetPreview =
        previewByKey.get(exactKey) ||
        (fallbackKey ? previewByKey.get(fallbackKey) : undefined) ||
        ({ type: 'unknown', id: report.target_id } as ModerationReportTargetPreview);

      return {
        ...report,
        target_preview: targetPreview,
      } as ReportRecordWithTarget;
    });
  },

  async updateReportStatus(payload: { reportId: string; status: ReportStatus; moderatorId: string }) {
    const updateData: { status: ReportStatus; reviewed_by: string; reviewed_at: string } = {
      status: payload.status,
      reviewed_by: payload.moderatorId,
      reviewed_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', payload.reportId)
      .select('id, target_type, target_id, reporter_id, reason, status, severity, reviewed_by, reviewed_at, created_at')
      .single();
    if (error) throw new Error(error.message || 'Impossible de mettre à jour le signalement');
    return data as unknown as ReportRecord;
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
    const comments = ((data || []) as any[]).map((row) => ({
      ...row,
      author: firstOrNull(row.author),
      event: firstOrNull(row.event),
    }));
    return { reports, comments: comments as unknown as ModerationComment[] };
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

  async warnUser(payload: { userId: string; level?: number; reason?: string; moderatorId: string }) {
    const { data: latestWarning, error: latestWarningError } = await supabase
      .from('warnings')
      .select('level')
      .eq('user_id', payload.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestWarningError) throw new Error(latestWarningError.message || 'Impossible de calculer le niveau d’avertissement');

    const computedLevel = clampWarningLevel(
      typeof payload.level === 'number' ? payload.level : (latestWarning?.level || 0) + 1
    );

    const { data, error } = await supabase
      .from('warnings')
      .insert({
        user_id: payload.userId,
        level: computedLevel,
        reason: payload.reason ?? null,
        moderator_id: payload.moderatorId,
      })
      .select('id, user_id, level, reason, moderator_id, created_at')
      .single();
    if (error) throw new Error(error.message || 'Impossible de créer l’avertissement');

    const sanction = getWarningSanction(computedLevel);
    if (sanction.profileStatus !== 'active') {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          status: sanction.profileStatus,
          ban_until: sanction.banUntil,
        })
        .eq('id', payload.userId);
      if (profileError) throw new Error(profileError.message || 'Impossible de mettre à jour la sanction utilisateur');
    }

    await ModerationService.logAction({
      targetType: 'user',
      targetId: payload.userId,
      actionType: 'warn',
      moderatorId: payload.moderatorId,
      metadata: payload.reason
        ? {
            reason: payload.reason,
            level: computedLevel,
            sanction_status: sanction.profileStatus,
            ban_until: sanction.banUntil,
          }
        : {
            level: computedLevel,
            sanction_status: sanction.profileStatus,
            ban_until: sanction.banUntil,
          },
    });

    if (sanction.profileStatus === 'banned') {
      await ModerationService.logAction({
        targetType: 'user',
        targetId: payload.userId,
        actionType: 'ban',
        moderatorId: payload.moderatorId,
        metadata: {
          source: 'warning_escalation',
          level: computedLevel,
          banUntil: sanction.banUntil,
        },
      });
    }

    return data as unknown as ModerationWarning;
  },

  async banUser(payload: { userId: string; moderatorId: string; reason?: string; banUntil?: string | null }) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'banned',
        ban_until: payload.banUntil ?? null,
      })
      .eq('id', payload.userId);
    if (profileError) throw new Error(profileError.message || 'Impossible de bannir cet utilisateur');

    await ModerationService.logAction({
      targetType: 'user',
      targetId: payload.userId,
      actionType: 'ban',
      moderatorId: payload.moderatorId,
      metadata: {
        ...(payload.reason ? { reason: payload.reason } : {}),
        ...(payload.banUntil ? { banUntil: payload.banUntil } : {}),
      },
    });
  },

  async liftUserRestriction(payload: { userId: string; moderatorId: string; reason?: string }) {
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from('profiles')
      .select('id, status, ban_until')
      .eq('id', payload.userId)
      .maybeSingle();
    if (currentProfileError) {
      throw new Error(currentProfileError.message || "Impossible de vérifier l'état du profil");
    }
    if (!currentProfile) {
      throw new Error('Profil introuvable');
    }
    if (currentProfile.status !== 'restricted') {
      throw new Error('Seuls les utilisateurs restreints peuvent être débloqués ici.');
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'active',
        ban_until: null,
      })
      .eq('id', payload.userId);
    if (profileError) {
      throw new Error(profileError.message || "Impossible de lever la restriction de l'utilisateur");
    }

    await ModerationService.logAction({
      targetType: 'user',
      targetId: payload.userId,
      actionType: 'approve',
      moderatorId: payload.moderatorId,
      metadata: {
        operation: 'lift_restriction',
        previous_status: currentProfile.status,
        previous_ban_until: currentProfile.ban_until,
        ...(payload.reason ? { reason: payload.reason } : {}),
      },
    });

    await ModerationService.createNotification({
      userId: payload.userId,
      type: 'system',
      title: 'Restriction levée',
      body: payload.reason || 'La restriction de votre compte a été levée par la modération.',
      data: {
        status: 'active',
      },
    });
  },

  async listWarnings(params?: { limit?: number; uniqueByUser?: boolean }) {
    const shouldUniqueByUser = params?.uniqueByUser ?? false;
    const requestedLimit = params?.limit;
    const fetchLimit =
      shouldUniqueByUser && requestedLimit
        ? Math.max(requestedLimit * 3, requestedLimit)
        : requestedLimit;

    let query = supabase
      .from('warnings')
      .select('id, user_id, level, reason, moderator_id, created_at, user:profiles!warnings_user_id_fkey(id, display_name, avatar_url, city, role, status, ban_until)')
      .order('created_at', { ascending: false });
    if (fetchLimit) query = query.limit(fetchLimit);
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Impossible de charger les avertissements');
    const normalized = ((data || []) as any[]).map((row) => ({
      ...row,
      user: firstOrNull(row.user),
    }));

    if (!shouldUniqueByUser) {
      return normalized as unknown as ModerationWarning[];
    }

    const bestWarningByUser = new Map<string, any>();
    for (const warning of normalized) {
      if (!warning.user_id) continue;
      const existing = bestWarningByUser.get(warning.user_id);
      if (!existing) {
        bestWarningByUser.set(warning.user_id, warning);
        continue;
      }

      const warningLevel = Number(warning.level || 0);
      const existingLevel = Number(existing.level || 0);
      if (warningLevel > existingLevel) {
        bestWarningByUser.set(warning.user_id, warning);
        continue;
      }
      if (warningLevel < existingLevel) continue;

      const warningTime = warning.created_at ? new Date(warning.created_at).getTime() : 0;
      const existingTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
      if (warningTime > existingTime) {
        bestWarningByUser.set(warning.user_id, warning);
      }
    }

    const uniqueWarnings = Array.from(bestWarningByUser.values()).sort((a, b) => {
      const levelDiff = Number(b.level || 0) - Number(a.level || 0);
      if (levelDiff !== 0) return levelDiff;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    return (requestedLimit ? uniqueWarnings.slice(0, requestedLimit) : uniqueWarnings) as unknown as ModerationWarning[];
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
    const normalized = ((data || []) as any[]).map((row) => ({
      ...row,
      contest: firstOrNull(row.contest),
      user: firstOrNull(row.user),
    }));
    return normalized as unknown as ModerationContestEntry[];
  },

  async listMediaSubmissions(params?: {
    status?: 'pending' | 'approved' | 'rejected';
    limit?: number;
    includeReported?: boolean;
  }) {
    const { status, limit, includeReported } = params || {};

    let baseQuery = supabase
      .from('event_media_submissions')
      .select(
        'id, event_id, author_id, url, status, reviewed_by, reviewed_at, created_at, author:profiles!event_media_submissions_author_id_fkey(id, display_name, avatar_url), event:events(id, title, creator_id)'
      )
      .order('created_at', { ascending: false });
    if (status) baseQuery = baseQuery.eq('status', status);
    if (limit) baseQuery = baseQuery.limit(limit);

    const { data: baseRows, error: baseError } = await baseQuery;
    if (baseError) throw new Error(baseError.message || 'Impossible de charger les photos de la communauté');

    const rows = [...((baseRows || []) as any[])];

    let activeReportsByMediaId = new Map<
      string,
      { count: number; status: ReportStatus; severity: ReportSeverity; latestAt: string | null }
    >();

    if (includeReported) {
      const { data: reportRows, error: reportsError } = await supabase
        .from('reports')
        .select('target_id, status, severity, created_at')
        .eq('target_type', 'media')
        .in('status', ['new', 'in_review', 'escalated'])
        .order('created_at', { ascending: false })
        .limit(500);
      if (reportsError) throw new Error(reportsError.message || 'Impossible de charger les signalements médias');

      for (const report of reportRows || []) {
        if (!report.target_id) continue;
        const prev = activeReportsByMediaId.get(report.target_id);
        if (!prev) {
          activeReportsByMediaId.set(report.target_id, {
            count: 1,
            status: report.status as ReportStatus,
            severity: report.severity as ReportSeverity,
            latestAt: report.created_at || null,
          });
        } else {
          activeReportsByMediaId.set(report.target_id, {
            ...prev,
            count: prev.count + 1,
          });
        }
      }

      const reportedIds = Array.from(activeReportsByMediaId.keys()).filter(Boolean);
      const missingReportedIds = reportedIds.filter((id) => !rows.some((row) => row.id === id));

      if (missingReportedIds.length) {
        const { data: reportedRows, error: reportedRowsError } = await supabase
          .from('event_media_submissions')
          .select(
            'id, event_id, author_id, url, status, reviewed_by, reviewed_at, created_at, author:profiles!event_media_submissions_author_id_fkey(id, display_name, avatar_url), event:events(id, title, creator_id)'
          )
          .in('id', missingReportedIds);
        if (reportedRowsError) throw new Error(reportedRowsError.message || 'Impossible de charger les médias signalés');
        rows.push(...((reportedRows || []) as any[]));
      }
    }

    const normalized = rows.map((row) => {
      const reportMeta = activeReportsByMediaId.get(row.id);
      return {
        ...row,
        author: firstOrNull(row.author),
        event: firstOrNull(row.event),
        report_count: reportMeta?.count || 0,
        report_status: reportMeta?.status || null,
        report_severity: reportMeta?.severity || null,
        last_report_at: reportMeta?.latestAt || null,
      };
    });

    normalized.sort((a: any, b: any) => {
      const aReports = a.report_count || 0;
      const bReports = b.report_count || 0;
      if (aReports !== bReports) return bReports - aReports;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const capped = limit ? normalized.slice(0, limit) : normalized;
    return capped as unknown as ModerationMediaSubmission[];
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
    const event = firstOrNull<{ id: string; title: string; creator_id?: string | null }>((data as any).event);

    const { error: insertError } = await supabase.from('event_media').insert({
      event_id: data.event_id,
      url: data.url,
      position: 0,
    });
    if (insertError) throw new Error(insertError.message || "Impossible d'ajouter la photo à l'événement");

    await ModerationService.logAction({
      targetType: 'media',
      targetId: data.id,
      actionType: 'approve',
      moderatorId: payload.moderatorId,
      metadata: { submissionId: data.id, eventId: data.event_id },
    });

    if (event?.creator_id && event.creator_id !== data.author_id) {
      await ModerationService.createNotification({
        userId: event.creator_id,
        type: 'system',
        title: 'Photo de communauté approuvée',
        body: `Une nouvelle photo a été ajoutée à "${event.title}".`,
        data: { eventId: data.event_id, submissionId: data.id },
      });
    }

    return { ...(data as any), event } as unknown as ModerationMediaSubmission;
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
    const event = firstOrNull<{ id: string; title: string }>((data as any).event);

    await ModerationService.logAction({
      targetType: 'media',
      targetId: data.id,
      actionType: 'refuse',
      moderatorId: payload.moderatorId,
      metadata: payload.reason
        ? { reason: payload.reason, submissionId: data.id, eventId: data.event_id }
        : { submissionId: data.id, eventId: data.event_id },
    });

    return { ...(data as any), event } as unknown as ModerationMediaSubmission;
  },

  async escalateMediaReports(payload: { submissionId: string; moderatorId: string; reason?: string }) {
    const updateData: {
      status: ReportStatus;
      reviewed_by: string;
      reviewed_at: string;
      reason?: string;
    } = {
      status: 'escalated',
      reviewed_by: payload.moderatorId,
      reviewed_at: new Date().toISOString(),
    };
    if (payload.reason) updateData.reason = payload.reason;

    const { data, error } = await supabase
      .from('reports')
      .update(updateData)
      .eq('target_type', 'media')
      .eq('target_id', payload.submissionId)
      .in('status', ['new', 'in_review'])
      .select('id, reporter_id')
      .limit(50);
    if (error) throw new Error(error.message || 'Impossible d’escalader les signalements média');

    await ModerationService.logAction({
      targetType: 'media',
      targetId: payload.submissionId,
      actionType: 'warn',
      moderatorId: payload.moderatorId,
      metadata: payload.reason ? { escalation: true, reason: payload.reason } : { escalation: true },
    });

    return data || [];
  },

  async warnMediaAuthor(payload: { submissionId: string; moderatorId: string; reason?: string }) {
    const { data, error } = await supabase
      .from('event_media_submissions')
      .select('id, author_id')
      .eq('id', payload.submissionId)
      .maybeSingle();
    if (error) throw new Error(error.message || "Impossible de charger l'auteur du média");
    if (!data?.author_id) throw new Error('Auteur introuvable pour ce média');

    return ModerationService.warnUser({
      userId: data.author_id,
      moderatorId: payload.moderatorId,
      reason: payload.reason || 'Contenu média signalé ou non conforme.',
    });
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
      targetType: 'contest_entry',
      targetId: payload.entryId,
      actionType: payload.status === 'removed' ? 'remove' : payload.status === 'hidden' ? 'refuse' : 'approve',
      moderatorId: payload.moderatorId,
      metadata: payload.reason ? { reason: payload.reason } : {},
    });
    return data as unknown as ModerationContestEntry;
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
