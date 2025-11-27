import { useEffect, useState } from 'react';
import type { MapboxFeature, MapboxGeocodingResponse } from '../types/mapbox';

export const useGeocoding = (query: string) => {
  const [results, setResults] = useState<MapboxFeature[]>([]);

  useEffect(() => {
    if (!query || query.length < 3) return;
    let isCancelled = false;

    const fetchData = async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?autocomplete=true&language=fr&types=address,poi&limit=5&access_token=${
          process.env.EXPO_PUBLIC_MAPBOX_TOKEN
        }`;

        const r = await fetch(url);
        const data = (await r.json()) as MapboxGeocodingResponse;
        if (!isCancelled) {
          setResults(data.features || []);
        }
      } catch (error) {
        if (!isCancelled) {
          setResults([]);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [query]);

  return results;
};
