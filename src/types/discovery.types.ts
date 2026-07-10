type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

/** Keys are `event_category.id` UUID strings, not slugs. */
export type CategoryAffinityMap = Record<string, number>;

export type DiscoveryPlaceType =
  | 'probable_home'
  | 'probable_work'
  | 'recurring'
  | 'occasional'
  | 'discovered';

export type DiscoveryVisitSource = 'passive' | 'checkin' | 'inferred';

export type DiscoveryTransportMode =
  | 'stationary'
  | 'walking'
  | 'cycling'
  | 'driving'
  | 'transit'
  | 'unknown';

export type RecommendationType =
  | 'right_now'
  | 'for_you'
  | 'break_the_loop'
  | 'nearby_opportunity'
  | 'new_area'
  | 'weekly_pick';

export type RecommendationEventType =
  | 'generated'
  | 'eligible'
  | 'displayed'
  | 'opened'
  | 'dismissed'
  | 'saved'
  | 'interested'
  | 'route_requested'
  | 'probable_visit'
  | 'confirmed_checkin'
  | 'expired';

export type DiscoveryInsightType =
  | 'no_new_place_recently'
  | 'expanding_radius'
  | 'shrinking_radius'
  | 'repetitive_weekends'
  | 'unusual_day'
  | 'new_area'
  | 'high_variety_period';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'expired'
  | 'cancelled'
  | 'refunded';

export type SubscriptionProvider = 'apple' | 'google' | 'stripe' | 'revenuecat' | 'internal';

export interface DiscoveryNotificationPreferences {
  discovery_push_enabled: boolean;
  right_now_push_enabled: boolean;
  break_loop_push_enabled: boolean;
  life_insight_push_enabled: boolean;
  discovery_max_push_per_week: number;
}

export interface UserEntitlement {
  is_active: boolean;
  status: SubscriptionStatus | 'expired';
  entitlement: string;
  expires_at: string | null;
  auto_renew?: boolean;
}

export interface PurgeDiscoveryDataResult {
  success: boolean;
  user_id: string;
}

export interface UpsertDiscoveryConsentInput {
  enabled: boolean;
  location_enabled?: boolean;
  motion_enabled?: boolean;
  personalization_enabled?: boolean;
  consent_version?: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  provider: SubscriptionProvider;
  product_id: string;
  entitlement: string;
  status: SubscriptionStatus;
  started_at: string | null;
  expires_at: string | null;
  auto_renew: boolean;
  trial_ends_at: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryConsent {
  user_id: string;
  enabled: boolean;
  location_enabled: boolean;
  motion_enabled: boolean;
  personalization_enabled: boolean;
  consent_version: string;
  granted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryPlace {
  id: string;
  user_id: string;
  location: string | { type: 'Point'; coordinates: [number, number] };
  centroid_latitude: number;
  centroid_longitude: number;
  radius_meters: number;
  place_type: DiscoveryPlaceType;
  confidence: number;
  label: string | null;
  first_seen_at: string;
  last_seen_at: string;
  visit_count: number;
  total_duration_minutes: number;
  is_new: boolean;
  metadata: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryVisit {
  id: string;
  user_id: string;
  place_id: string | null;
  client_visit_id: string | null;
  arrived_at: string;
  departed_at: string | null;
  duration_minutes: number | null;
  transport_mode: DiscoveryTransportMode;
  confidence: number;
  probable_event_id: string | null;
  recommendation_id: string | null;
  source: DiscoveryVisitSource;
  metadata: JsonValue;
  created_at: string;
}

export interface MobilityProfile {
  user_id: string;
  weekday_radius_km: number | null;
  weekend_radius_km: number | null;
  median_trip_distance_km: number | null;
  max_typical_distance_km: number | null;
  preferred_activity_windows: JsonValue;
  active_days: JsonValue;
  dominant_transport_mode: DiscoveryTransportMode;
  calculated_at: string;
  confidence: number;
  model_version: string;
}

export interface DiscoveryProfile {
  user_id: string;
  category_affinities: CategoryAffinityMap;
  subcategory_affinities: CategoryAffinityMap;
  tag_affinities: CategoryAffinityMap;
  novelty_preference: number;
  typical_weekday_hours: JsonValue;
  typical_weekend_hours: JsonValue;
  exploration_score: number | null;
  autopilot_score: number | null;
  calculated_at: string;
  model_version: string;
}

export interface DiscoveryInsight {
  id: string;
  user_id: string;
  type: DiscoveryInsightType;
  title: string;
  body: string;
  score: number;
  confidence: number;
  valid_from: string;
  valid_until: string;
  metadata: JsonValue;
  created_at: string;
  seen_at: string | null;
}

export interface EventRecommendation {
  id: string;
  user_id: string;
  event_id: string;
  recommendation_type: RecommendationType;
  score: number;
  reason_codes: string[];
  context: JsonValue;
  generated_at: string;
  valid_until: string;
  displayed_at: string | null;
  opened_at: string | null;
  dismissed_at: string | null;
  route_requested_at: string | null;
  probable_visit_at: string | null;
  confirmed_checkin_at: string | null;
}

export interface RecommendationEvent {
  id: string;
  recommendation_id: string;
  user_id: string;
  event_type: RecommendationEventType;
  metadata: JsonValue;
  created_at: string;
}

export interface DiscoveryDailySummary {
  user_id: string;
  date: string;
  places_count: number;
  new_places_count: number;
  distance_km: number;
  radius_km: number | null;
  moving_minutes: number;
  stationary_minutes: number;
  variety_score: number | null;
  autopilot_score: number | null;
  metadata: JsonValue;
  created_at: string;
}

export interface DiscoveryLocationBatch {
  id: string;
  user_id: string;
  payload: JsonValue;
  received_at: string;
  processed_at: string | null;
  expires_at: string;
}

export interface TrackRecommendationEventInput {
  recommendation_id: string;
  event_type: RecommendationEventType;
  metadata?: JsonValue;
}
