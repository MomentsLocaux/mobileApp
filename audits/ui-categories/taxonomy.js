// Isolated visual review: no backend client or personal data.
import { CATEGORY_VISUALS, CATEGORY_VISUAL_LABELS } from '../../src/constants/category-visuals';
const categories = Object.keys(CATEGORY_VISUALS).map((slug, index) => ({ id: `category-${index}`, slug, label: CATEGORY_VISUAL_LABELS[slug], color: CATEGORY_VISUALS[slug].fallbackColor }));
const state = { categories, subcategories: [{ id: 'theatre', category_id: 'category-0', label: 'Théâtre', slug: 'theatre' }], categoriesMap: Object.fromEntries(categories.flatMap(cat => [[cat.id, cat], [cat.slug, cat]])) };
export const useTaxonomyStore = selector => selector(state);
useTaxonomyStore.getState = () => state;
