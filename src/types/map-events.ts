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

export function mergeFeatureCollections(
  ...collections: Array<EventMapFeatureCollection | null | undefined>
): EventMapFeatureCollection {
  const seen = new Set<string>();
  const features: EventMapFeatureCollection['features'] = [];

  for (const collection of collections) {
    for (const feature of collection?.features ?? []) {
      const id = feature.properties?.id;
      if (typeof id !== 'string' || !id.length || seen.has(id)) continue;
      seen.add(id);
      features.push(feature);
    }
  }

  return { type: 'FeatureCollection', features };
}
