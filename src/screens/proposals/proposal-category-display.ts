import type { Category } from '@/store/taxonomyStore';

const PROPOSAL_CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  'fetes-animations': 'Fêtes & Animations',
};

export function getProposalCategoryLabel(
  category: Pick<Category, 'slug' | 'label' | 'icon'>,
): string {
  const slug = category.slug.trim().toLowerCase();
  return PROPOSAL_CATEGORY_LABEL_OVERRIDES[slug] || category.label.trim() || 'Catégorie';
}
