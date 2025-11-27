export interface MapboxContextItem {
  id: string;
  text: string;
  wikidata?: string;
  short_code?: string;
}

export interface MapboxFeature {
  id: string;
  type: string;
  place_type: string[];
  text: string;
  place_name: string;
  center: [number, number]; // [lon, lat]
  context?: MapboxContextItem[];
  properties?: Record<string, unknown>;
}

export interface MapboxGeocodingResponse {
  type: string;
  query: string[];
  features: MapboxFeature[];
}
