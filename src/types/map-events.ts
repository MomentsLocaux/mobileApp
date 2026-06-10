export type MapBounds = {
  ne: [number, number];
  sw: [number, number];
};

export type EventMapFeature = {
  properties?: {
    id?: string;
  };
};

export type EventMapFeatureCollection = {
  type: 'FeatureCollection';
  features: EventMapFeature[];
};

export function extractEventIdsFromFeatureCollection(
  collection: EventMapFeatureCollection | null | undefined
): string[] {
  const ids =
    collection?.features
      ?.map((feature) => feature.properties?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0) ?? [];
  return Array.from(new Set(ids));
}

export function filterFeatureCollectionByEventIds(
  collection: EventMapFeatureCollection,
  eventIds: Set<string>
): EventMapFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.filter((feature) => {
      const id = feature.properties?.id;
      return typeof id === 'string' && eventIds.has(id);
    }),
  };
}
