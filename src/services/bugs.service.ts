import { dataProvider } from '@/data-provider';

export const BugsService = {
  submit: (payload: { category: string; severity: string; page?: string; description: string; reporterId?: string }) =>
    dataProvider.submitBug(payload),
};
