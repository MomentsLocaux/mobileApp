import { useEffect } from 'react';
import { useTaxonomyStore } from '@/store/taxonomyStore';

export const useTaxonomy = () => {
  const load = useTaxonomyStore((s) => s.load);
  const loaded = useTaxonomyStore((s) => s.loaded);
  useEffect(() => {
    if (!loaded) {
      load();
    }
  }, [loaded, load]);
};
