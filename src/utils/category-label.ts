import {
  CATEGORY_VISUAL_LABELS,
  isCategoryVisualSlug,
  pickCategoryMetaSlug,
} from '../constants/category-visuals';
import { isInternalTagId } from './event-card-display';

export const UNRESOLVED_CATEGORY_LABEL = 'Catégorie';

export function resolveCategoryLabel(options: {
  category?: string | null;
  categoryMeta?: unknown;
  taxonomyLabel?: string | null;
  taxonomySlug?: string | null;
}): string {
  const category = options.category?.trim() ?? '';
  const slug =
    options.taxonomySlug?.trim() ||
    pickCategoryMetaSlug(options.categoryMeta) ||
    (isCategoryVisualSlug(category) ? category : null);
  const taxonomyLabel = options.taxonomyLabel?.trim();
  if (taxonomyLabel) return taxonomyLabel;
  if (isCategoryVisualSlug(slug)) return CATEGORY_VISUAL_LABELS[slug];
  if (!category || isInternalTagId(category)) return UNRESOLVED_CATEGORY_LABEL;
  return category;
}
