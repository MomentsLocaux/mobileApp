/** Mirrors supabase/functions/suggest-event-from-poster response shapes (SCRUM-107). */

export type ConfidentField<T> = {
  value: T;
  confidence: number;
};

export type PosterExtractionFields = {
  title: ConfidentField<string | null>;
  description: ConfidentField<string | null>;
  start_date: ConfidentField<string | null>;
  start_time: ConfidentField<string | null>;
  end_date: ConfidentField<string | null>;
  end_time: ConfidentField<string | null>;
  year_inferred: ConfidentField<boolean>;
  venue_name: ConfidentField<string | null>;
  address_text: ConfidentField<string | null>;
  city_hint: ConfidentField<string | null>;
  postal_code_hint: ConfidentField<string | null>;
  price_amount: ConfidentField<number | null>;
  is_free: ConfidentField<boolean | null>;
  contact_email: ConfidentField<string | null>;
  contact_phone: ConfidentField<string | null>;
  external_url: ConfidentField<string | null>;
  organizer_name: ConfidentField<string | null>;
  category_slug: ConfidentField<string | null>;
  subcategory_slug: ConfidentField<string | null>;
  tag_slugs: ConfidentField<string[]>;
};

export type PosterExtractQuota = {
  limit: number;
  remaining: number | null;
  period: string;
};

export type PosterExtractSuccess = {
  ok: true;
  detected_event: true;
  fields: PosterExtractionFields;
  warnings: string[];
  model?: string;
  quota?: PosterExtractQuota;
};

export type PosterExtractErrorCode =
  | 'no_event_detected'
  | 'image_unreadable'
  | 'quota_exceeded'
  | 'service_error';

export type PosterExtractFailure = {
  ok: false;
  code: PosterExtractErrorCode;
  message: string;
  detected_event?: boolean;
  warnings?: string[];
  quota?: PosterExtractQuota;
};

export type PosterExtractResult = PosterExtractSuccess | PosterExtractFailure;

export type PosterPrefillSummary = {
  uncertainFields: string[];
  appliedFields: string[];
};
