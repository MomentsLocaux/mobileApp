import { dataProvider } from '@/data-provider';

/**
 * Lumo wallet helpers (Habitué layer).
 * Credits are server-only via `credit_lumo_by_rule` after validated triggers.
 * Client `earn` is intentionally unavailable (CLIENT_EARN_FORBIDDEN).
 */
export const LumoService = {
  earn: async (_payload: {
    amount?: number;
    reason?: string;
    item_type?: string;
    item_id?: string;
  }) => {
    throw new Error('CLIENT_EARN_FORBIDDEN: Lumo credits are server-side only');
  },
  spend: (payload: { amount: number; item_type?: string; item_id?: string }) =>
    dataProvider.spendLumo({
      amount: payload.amount,
      reason: payload.item_type,
      item_type: payload.item_type,
      item_id: payload.item_id,
    }),
};
