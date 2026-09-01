import { dataProvider } from '@/data-provider';

export const BugsService = {
  submit: (payload: {
    category: string;
    severity: string;
    page?: string;
    description: string;
    reporterId?: string;
    attachment?: { uri: string; mimeType?: string; fileName?: string | null } | null;
  }) => dataProvider.submitBug(payload),
};
