import { supabase } from '@/lib/supabase/client';
import type { EventMediaSubmission } from '@/types/database';

const MAX_SUBMISSIONS_PER_EVENT = 5;

const formatError = (error: any, context: string) => {
  if (
    (error?.code === '42501' || `${error?.message || ''}`.includes('row-level security')) &&
    `${error?.message || ''}`.includes('event_media_submissions')
  ) {
    return new Error(
      "[submit] Check-in requis: vous devez faire un check-in (ou être admin/modérateur) pour proposer une photo."
    );
  }
  const message =
    (typeof error?.message === 'string' && error.message) || (typeof error === 'string' && error) || 'Erreur Supabase';
  return new Error(`[${context}] ${message}`);
};

export const EventMediaSubmissionsService = {
  listApproved: async (eventId: string) => {
    const { data, error } = await supabase
      .from('event_media_submissions')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) throw formatError(error, 'listApproved');
    return (data || []) as EventMediaSubmission[];
  },

  listPendingForEvent: async (eventId: string) => {
    const { data, error } = await supabase
      .from('event_media_submissions')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw formatError(error, 'listPendingForEvent');
    return (data || []) as EventMediaSubmission[];
  },

  submit: async (payload: {
    eventId: string;
    authorId: string;
    url: string;
    maxPerEvent?: number;
  }) => {
    const maxPerEvent = payload.maxPerEvent ?? MAX_SUBMISSIONS_PER_EVENT;
    const { count, error: countError } = await supabase
      .from('event_media_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', payload.eventId)
      .eq('author_id', payload.authorId)
      .in('status', ['pending', 'approved']);
    if (countError) throw formatError(countError, 'submit-count');
    if (typeof count === 'number' && count >= maxPerEvent) {
      return {
        success: false,
        message: `Limite atteinte: ${maxPerEvent} photos max pour cet événement.`,
      };
    }

    const { data, error } = await supabase
      .from('event_media_submissions')
      .insert({
        event_id: payload.eventId,
        author_id: payload.authorId,
        url: payload.url,
        status: 'pending',
      })
      .select('*')
      .single();
    if (error) throw formatError(error, 'submit');
    return { success: true, submission: data as EventMediaSubmission };
  },

  updateStatus: async (payload: {
    submissionId: string;
    status: 'approved' | 'rejected';
    reviewerId?: string | null;
  }) => {
    const { data, error } = await supabase
      .from('event_media_submissions')
      .update({
        status: payload.status,
        reviewed_by: payload.reviewerId ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', payload.submissionId)
      .select('*')
      .single();
    if (error) throw formatError(error, 'updateStatus');
    return data as EventMediaSubmission;
  },
};
