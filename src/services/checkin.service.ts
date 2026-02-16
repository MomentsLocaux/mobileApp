import { supabase } from '@/lib/supabase/client';
import type { CheckInResult } from '@/data-provider/types';

export const CheckinService = {
  checkIn: async (
    eventId: string,
    lat: number,
    lon: number,
    token?: string,
    options?: { qrToken?: string; source?: 'mobile' | 'qr_scan' },
  ) => {
    const { data, error } = await supabase.functions.invoke<CheckInResult>('event-checkin', {
      body: {
        eventId,
        lat,
        lon,
        qrToken: options?.qrToken,
        source: options?.source,
      },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    console.log('[CheckIn] response', { data, error });

    if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
        try {
          const payload = (await response.json()) as CheckInResult;
          if (payload?.message) {
            return { success: false, message: payload.message };
          }
        } catch (err) {
          // Fall back to error message below.
        }
      }
      throw new Error(error.message || 'Check-in failed');
    }

    return data ?? { success: false, message: 'Check-in failed' };
  },
};
