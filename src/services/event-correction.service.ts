import { supabase } from '@/lib/supabase/client';
import {
  EVENT_CORRECTION_DAILY_QUOTA,
  pickCorrectionDiff,
  type CreateEventCorrectionInput,
  type EventCorrectionProposal,
} from '@/types/event-correction';
import { startOfUtcDayIso } from '@/utils/event-correction';

const formatError = (error: unknown, context: string) => {
  const raw =
    (typeof error === 'object' && error && 'message' in error && typeof (error as any).message === 'string'
      ? (error as any).message
      : null) ||
    (typeof error === 'string' ? error : null) ||
    'Erreur Supabase';
  const code =
    typeof error === 'object' && error && 'code' in error ? String((error as any).code || '') : '';
  const details =
    typeof error === 'object' && error && 'details' in error ? String((error as any).details || '') : '';
  const hint =
    typeof error === 'object' && error && 'hint' in error ? String((error as any).hint || '') : '';
  const suffix = [code, details, hint].filter(Boolean).join(' | ');
  return new Error(`[${context}] ${raw}${suffix ? ` (${suffix})` : ''}`);
};

const requireUserId = async (context: string) => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw formatError(error, `${context}-auth`);
  const userId = data.user?.id;
  if (!userId) throw formatError('Utilisateur non authentifié', `${context}-auth`);
  return userId;
};

const normalizeComment = (comment: string) => comment.trim();

export const EventCorrectionService = {
  async create(input: CreateEventCorrectionInput): Promise<EventCorrectionProposal> {
    const proposerId = await requireUserId('createEventCorrection');
    const comment = normalizeComment(input.comment);
    if (comment.length < 3) {
      throw new Error('[createEventCorrection] Commentaire trop court (min. 3 caractères).');
    }

    const base = {
      event_id: input.eventId,
      proposer_id: proposerId,
      kind: input.kind,
      comment,
      source_hint: input.sourceHint?.trim() || null,
      status: 'pending' as const,
    };

    const row =
      input.kind === 'field_correction'
        ? {
            ...base,
            proposed_fields: pickCorrectionDiff(input.proposedFields),
            duplicate_of_event_id: null,
            duplicate_hint: null,
          }
        : {
            ...base,
            proposed_fields: null,
            duplicate_of_event_id: input.duplicateOfEventId || null,
            duplicate_hint: input.duplicateHint?.trim() || null,
          };

    if (input.kind === 'field_correction' && Object.keys(row.proposed_fields || {}).length === 0) {
      throw new Error('[createEventCorrection] Aucun champ modifié à proposer.');
    }

    const { data, error } = await (supabase.from('event_correction_proposals') as any)
      .insert(row)
      .select('*')
      .single();

    if (error) throw formatError(error, 'createEventCorrection');
    return data as EventCorrectionProposal;
  },

  async listMine(limit = 50): Promise<EventCorrectionProposal[]> {
    const proposerId = await requireUserId('listMyEventCorrections');

    const embedded = await (supabase.from('event_correction_proposals') as any)
      .select('*, event:events!event_correction_proposals_event_id_fkey(id, title)')
      .eq('proposer_id', proposerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!embedded.error) {
      return (embedded.data || []) as EventCorrectionProposal[];
    }

    const fallback = await (supabase.from('event_correction_proposals') as any)
      .select('*')
      .eq('proposer_id', proposerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (fallback.error) throw formatError(fallback.error, 'listMyEventCorrections');
    return (fallback.data || []) as EventCorrectionProposal[];
  },

  async countMineToday(): Promise<{ used: number; limit: number }> {
    const proposerId = await requireUserId('countMyEventCorrectionsToday');
    const { count, error } = await (supabase.from('event_correction_proposals') as any)
      .select('id', { count: 'exact', head: true })
      .eq('proposer_id', proposerId)
      .gte('created_at', startOfUtcDayIso());
    if (error) throw formatError(error, 'countMyEventCorrectionsToday');
    return { used: count ?? 0, limit: EVENT_CORRECTION_DAILY_QUOTA };
  },
};
