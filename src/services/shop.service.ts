import { dataProvider } from '@/data-provider';

export const ShopService = {
  purchase: (payload: { itemId: string; method: 'lumo' | 'eur'; userId: string }) =>
    dataProvider.purchaseItem(payload),
};
