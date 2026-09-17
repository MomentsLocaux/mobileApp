import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';

export const TAXONOMY_STORAGE_KEY = 'taxonomy-cache-v1';

export type Category = {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  color: string | null;
  position: number;
};

export type Subcategory = {
  id: string;
  category_id: string;
  slug: string;
  label: string;
  position: number;
};

export type Tag = {
  id: string;
  slug: string;
  label: string;
};

export type TaxonomyCache = {
  categories: Category[];
  subcategories: Subcategory[];
  tags: Tag[];
};

interface TaxonomyState extends TaxonomyCache {
  categoriesMap: Record<string, Category>;
  subcategoriesMap: Record<string, Subcategory>;
  tagsMap: Record<string, Tag>;
  loaded: boolean;
  loading: boolean;
  loadError: boolean;
  synced: boolean;
  load: () => Promise<void>;
}

const buildMaps = (payload: TaxonomyCache) => {
  const categoriesMap = payload.categories.reduce<Record<string, Category>>((acc, category) => {
    acc[category.id] = category;
    acc[category.slug] = category;
    return acc;
  }, {});
  const subcategoriesMap = payload.subcategories.reduce<Record<string, Subcategory>>(
    (acc, subcategory) => {
      acc[subcategory.id] = subcategory;
      acc[subcategory.slug] = subcategory;
      return acc;
    },
    {},
  );
  const tagsMap = payload.tags.reduce<Record<string, Tag>>((acc, tag) => {
    acc[tag.id] = tag;
    acc[tag.slug] = tag;
    return acc;
  }, {});
  return { categoriesMap, subcategoriesMap, tagsMap };
};

export function isTaxonomyCache(value: unknown): value is TaxonomyCache {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<TaxonomyCache>;
  return (
    Array.isArray(payload.categories) &&
    Array.isArray(payload.subcategories) &&
    Array.isArray(payload.tags)
  );
}

export function applyTaxonomyCache(payload: TaxonomyCache): void {
  if (!payload.categories.length) return;
  useTaxonomyStore.setState({
    ...payload,
    ...buildMaps(payload),
    loaded: true,
    loadError: false,
  });
}

export function getTaxonomyCacheSnapshot(): TaxonomyCache | null {
  const state = useTaxonomyStore.getState();
  if (!state.loaded || !state.categories.length) return null;
  return {
    categories: state.categories,
    subcategories: state.subcategories,
    tags: state.tags,
  };
}

export const useTaxonomyStore = create<TaxonomyState>((set, get) => ({
  categories: [],
  subcategories: [],
  tags: [],
  categoriesMap: {},
  subcategoriesMap: {},
  tagsMap: {},
  loaded: false,
  loading: false,
  loadError: false,
  synced: false,
  load: async () => {
    if (get().loading || get().synced) return;
    set({ loading: true, loadError: false });

    try {
      const [catRes, subRes, tagRes] = await Promise.all([
        supabase
          .from('event_category')
          .select('id, slug, label, icon, color, position')
          .order('position', { ascending: true }),
        supabase
          .from('event_subcategory')
          .select('id, category_id, slug, label, position')
          .order('position', { ascending: true }),
        supabase.from('event_tag').select('id, slug, label').order('label', { ascending: true }),
      ]);

      if (catRes.error) throw catRes.error;
      if (subRes.error) throw subRes.error;
      if (tagRes.error) throw tagRes.error;

      const payload: TaxonomyCache = {
        categories: catRes.data || [],
        subcategories: subRes.data || [],
        tags: tagRes.data || [],
      };

      applyTaxonomyCache(payload);
      set({ loading: false, synced: true, loadError: false });
    } catch (error) {
      console.error('taxonomy load error', error);
      set({ loading: false, loadError: !get().loaded });
    }
  },
}));
