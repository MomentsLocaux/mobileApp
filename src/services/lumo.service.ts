import { dataProvider } from '@/data-provider';

export const LumoService = {
  earn: (payload: { amount?: number; reason?: string; item_type?: string; item_id?: string }) =>
    dataProvider.earnLumo(payload),
  spend: (payload: { amount: number; item_type?: string; item_id?: string }) => dataProvider.spendLumo(payload),
};
