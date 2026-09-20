import React, { useMemo } from 'react';
import Mapbox from '@rnmapbox/maps';
import { Users, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import {
  CATEGORY_VISUAL_SLUGS,
  CATEGORY_VISUALS,
  categoryClusterMarkerImageKey,
  DEFAULT_CLUSTER_MAP_MARKER,
  DEFAULT_MAP_MARKER,
  type CategoryVisualSlug,
} from '@/constants/category-visuals';
import { CategoryEventMarker } from './CategoryEventMarker';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { MAP_MARKER_IMAGES } from '@/constants/map-marker-assets';

export type CategoryMarkerVisual = {
  color: string;
  iconColor?: string;
  Icon: LucideIcon;
};

export function useCategoryMarkerVisuals(): Record<CategoryVisualSlug, CategoryMarkerVisual> {
  const categoriesMap = useTaxonomyStore((state) => state.categoriesMap);
  return useMemo(() => {
    const visuals = {} as Record<CategoryVisualSlug, CategoryMarkerVisual>;
    CATEGORY_VISUAL_SLUGS.forEach((slug) => {
      const base = CATEGORY_VISUALS[slug];
      const categoryColor = categoriesMap[slug]?.color;
      const color =
        typeof categoryColor === 'string' && categoryColor.trim().length > 0
          ? categoryColor
          : base.fallbackColor;
      visuals[slug] = {
        color,
        iconColor: base.iconColor,
        Icon: base.Icon,
      };
    });
    return visuals;
  }, [categoriesMap]);
}

/** Registers shared category silhouettes and the existing cluster artwork. */
export const CategoryMarkerImages = React.memo(function CategoryMarkerImages({
  visuals,
}: {
  visuals: Record<CategoryVisualSlug, CategoryMarkerVisual>;
}) {
  return (
    <Mapbox.Images images={MAP_MARKER_IMAGES}>
      {CATEGORY_VISUAL_SLUGS.map((slug) => {
        const visual = visuals[slug];
        return (
          <Mapbox.Image key={`${slug}-cluster`} name={categoryClusterMarkerImageKey(slug)}>
            <CategoryEventMarker color={visual.color} Icon={visual.Icon} variant="cluster" />
          </Mapbox.Image>
        );
      })}
      <Mapbox.Image name={DEFAULT_MAP_MARKER}>
        <CategoryEventMarker color={colors.brand.secondary} Icon={Users} variant="symbol" size={48} />
      </Mapbox.Image>
      <Mapbox.Image name={DEFAULT_CLUSTER_MAP_MARKER}>
        <CategoryEventMarker color={colors.brand.secondary} Icon={Users} variant="cluster" />
      </Mapbox.Image>
    </Mapbox.Images>
  );
});
