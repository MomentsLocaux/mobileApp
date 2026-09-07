import { supabase } from '@/lib/supabase/client';

export type AccountExportStatus = 'pending' | 'ready' | 'failed' | 'expired';

export type AccountExportRequest = {
  id: string;
  status: AccountExportStatus;
  created_at: string;
  ready_at: string | null;
  expires_at: string | null;
};

export type AccountExportResult = {
  success: boolean;
  message?: string;
  requestId?: string;
  status?: AccountExportStatus;
  downloadUrl?: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  reused?: boolean;
};

const isExpired = (expiresAt?: string | null) => {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
};

export const AccountExportService = {
  async listMine(): Promise<AccountExportRequest[]> {
    const { data, error } = await supabase
      .from('account_export_requests' as never)
      .select('id, status, created_at, ready_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) throw new Error(error.message || 'Impossible de charger les exports');
    return ((data || []) as AccountExportRequest[]).map((row) => ({
      ...row,
      status: isExpired(row.expires_at) && row.status === 'ready' ? 'expired' : row.status,
    }));
  },

  async requestExport(): Promise<AccountExportResult> {
    const { data, error } = await supabase.functions.invoke('export-account', { body: {} });

    if (error) {
      let message = error.message;
      const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
            message = body.message;
          }
        } catch {
          // keep supabase message
        }
      }
      return { success: false, message };
    }

    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Réponse d’export invalide.' };
    }

    const payload = data as {
      success?: boolean;
      message?: string;
      request_id?: string;
      status?: AccountExportStatus;
      download_url?: string;
      expires_at?: string;
      created_at?: string;
      reused?: boolean;
    };

    if (payload.success === false) {
      return { success: false, message: payload.message || 'Export impossible' };
    }

    return {
      success: true,
      requestId: payload.request_id,
      status: payload.status,
      downloadUrl: payload.download_url,
      expiresAt: payload.expires_at ?? null,
      createdAt: payload.created_at ?? null,
      reused: payload.reused,
    };
  },
};
