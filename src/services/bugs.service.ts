import { dataProvider } from '@/data-provider';
import { supabase } from '@/lib/supabase/client';

export type BugReportListItem = {
  id: string;
  category: string;
  description: string;
  page: string | null;
  status: string;
  created_at: string;
};

const formatError = (error: unknown, context: string) => {
  const raw =
    (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: string }).message === 'string'
      ? (error as { message: string }).message
      : null) ||
    (typeof error === 'string' ? error : null) ||
    'Erreur Supabase';
  return new Error(`[${context}] ${raw}`);
};

export const BugsService = {
  submit: (payload: {
    category: string;
    severity: string;
    page?: string;
    description: string;
    reporterId?: string;
    attachment?: { uri: string; mimeType?: string; fileName?: string | null } | null;
  }) => dataProvider.submitBug(payload),

  async listMine(limit = 50): Promise<BugReportListItem[]> {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw formatError(authError, 'listMyBugs-auth');
    const userId = auth.user?.id;
    if (!userId) throw formatError('Utilisateur non authentifié', 'listMyBugs-auth');

    const { data, error } = await (supabase.from('bug_reports') as any)
      .select('id, category, description, page, status, created_at')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw formatError(error, 'listMyBugs');
    return (data || []) as BugReportListItem[];
  },
};
