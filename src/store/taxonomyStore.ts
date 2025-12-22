import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';

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

interface TaxonomyState {
  categories: Category[];
  subcategories: Subcategory[];
  tags: Tag[];
  categoriesMap: Record<string, Category>;
  subcategoriesMap: Record<string, Subcategory>;
  tagsMap: Record<string, Tag>;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
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
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const [catRes, subRes, tagRes] = await Promise.all([
        supabase.from('event_category').select('id, slug, label, icon, color, position').order('position', { ascending: true }),
        supabase.from('event_subcategory').select('id, category_id, slug, label, position').order('position', { ascending: true }),
        supabase.from('event_tag').select('id, slug, label').order('label', { ascending: true }),
      ]);

      if (catRes.error) throw catRes.error;
      if (subRes.error) throw subRes.error;
      if (tagRes.error) throw tagRes.error;

      const categories = catRes.data || [];
      const subcategories = subRes.data || [];
      const tags = tagRes.data || [];

      const categoriesMap = categories.reduce<Record<string, Category>>((acc, c) => {
        acc[c.id] = c;
        acc[c.slug] = c;
        return acc;
      }, {});
      const subcategoriesMap = subcategories.reduce<Record<string, Subcategory>>((acc, s) => {
        acc[s.id] = s;
        acc[s.slug] = s;
        return acc;
      }, {});
      const tagsMap = tags.reduce<Record<string, Tag>>((acc, t) => {
        acc[t.id] = t;
        acc[t.slug] = t;
        return acc;
      }, {});

      set({
        categories,
        subcategories,
        tags,
        categoriesMap,
        subcategoriesMap,
        tagsMap,
        loaded: true,
        loading: false,
      });
    } catch (e) {
      console.error('taxonomy load error', e);
      set({ loading: false });
    }
  },
}));
