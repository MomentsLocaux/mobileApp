import { supabase } from '@/lib/supabase/client';

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
