/** OpenAI Structured Outputs schema for poster field extraction (strict mode). */

export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'detected_event',
    'title',
    'title_confidence',
    'description',
    'description_confidence',
    'start_date',
    'start_date_confidence',
    'start_time',
    'start_time_confidence',
    'end_date',
    'end_date_confidence',
    'end_time',
    'end_time_confidence',
    'year_inferred',
    'year_inferred_confidence',
    'venue_name',
    'venue_name_confidence',
    'address_text',
    'address_text_confidence',
    'city_hint',
    'city_hint_confidence',
    'postal_code_hint',
    'postal_code_hint_confidence',
    'price_amount',
    'price_amount_confidence',
    'is_free',
    'is_free_confidence',
    'contact_email',
    'contact_email_confidence',
    'contact_phone',
    'contact_phone_confidence',
    'external_url',
    'external_url_confidence',
    'organizer_name',
    'organizer_name_confidence',
    'category_slug',
    'category_slug_confidence',
    'subcategory_slug',
    'subcategory_slug_confidence',
    'tag_slugs',
    'tag_slugs_confidence',
    'warnings',
  ],
  properties: {
    detected_event: { type: 'boolean' },
    title: { type: ['string', 'null'] },
    title_confidence: { type: 'number' },
    description: { type: ['string', 'null'] },
    description_confidence: { type: 'number' },
    start_date: { type: ['string', 'null'] },
    start_date_confidence: { type: 'number' },
    start_time: { type: ['string', 'null'] },
    start_time_confidence: { type: 'number' },
    end_date: { type: ['string', 'null'] },
    end_date_confidence: { type: 'number' },
    end_time: { type: ['string', 'null'] },
    end_time_confidence: { type: 'number' },
    year_inferred: { type: 'boolean' },
    year_inferred_confidence: { type: 'number' },
    venue_name: { type: ['string', 'null'] },
    venue_name_confidence: { type: 'number' },
    address_text: { type: ['string', 'null'] },
    address_text_confidence: { type: 'number' },
    city_hint: { type: ['string', 'null'] },
    city_hint_confidence: { type: 'number' },
    postal_code_hint: { type: ['string', 'null'] },
    postal_code_hint_confidence: { type: 'number' },
    price_amount: { type: ['number', 'null'] },
    price_amount_confidence: { type: 'number' },
    is_free: { type: ['boolean', 'null'] },
    is_free_confidence: { type: 'number' },
    contact_email: { type: ['string', 'null'] },
    contact_email_confidence: { type: 'number' },
    contact_phone: { type: ['string', 'null'] },
    contact_phone_confidence: { type: 'number' },
    external_url: { type: ['string', 'null'] },
    external_url_confidence: { type: 'number' },
    organizer_name: { type: ['string', 'null'] },
    organizer_name_confidence: { type: 'number' },
    category_slug: { type: ['string', 'null'] },
    category_slug_confidence: { type: 'number' },
    subcategory_slug: { type: ['string', 'null'] },
    subcategory_slug_confidence: { type: 'number' },
    tag_slugs: { type: 'array', items: { type: 'string' } },
    tag_slugs_confidence: { type: 'number' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const;

export type RawExtraction = {
  detected_event: boolean;
  title: string | null;
  title_confidence: number;
  description: string | null;
  description_confidence: number;
  start_date: string | null;
  start_date_confidence: number;
  start_time: string | null;
  start_time_confidence: number;
  end_date: string | null;
  end_date_confidence: number;
  end_time: string | null;
  end_time_confidence: number;
  year_inferred: boolean;
  year_inferred_confidence: number;
  venue_name: string | null;
  venue_name_confidence: number;
  address_text: string | null;
  address_text_confidence: number;
  city_hint: string | null;
  city_hint_confidence: number;
  postal_code_hint: string | null;
  postal_code_hint_confidence: number;
  price_amount: number | null;
  price_amount_confidence: number;
  is_free: boolean | null;
  is_free_confidence: number;
  contact_email: string | null;
  contact_email_confidence: number;
  contact_phone: string | null;
  contact_phone_confidence: number;
  external_url: string | null;
  external_url_confidence: number;
  organizer_name: string | null;
  organizer_name_confidence: number;
  category_slug: string | null;
  category_slug_confidence: number;
  subcategory_slug: string | null;
  subcategory_slug_confidence: number;
  tag_slugs: string[];
  tag_slugs_confidence: number;
  warnings: string[];
};

export type ConfidentField<T> = { value: T; confidence: number };

export type ExtractionFields = {
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

function clampConfidence(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function field<T>(value: T, confidence: unknown): ConfidentField<T> {
  return { value, confidence: clampConfidence(confidence) };
}

export function mapRawToFields(raw: RawExtraction): ExtractionFields {
  return {
    title: field(raw.title, raw.title_confidence),
    description: field(raw.description, raw.description_confidence),
    start_date: field(raw.start_date, raw.start_date_confidence),
    start_time: field(raw.start_time, raw.start_time_confidence),
    end_date: field(raw.end_date, raw.end_date_confidence),
    end_time: field(raw.end_time, raw.end_time_confidence),
    year_inferred: field(raw.year_inferred ?? false, raw.year_inferred_confidence),
    venue_name: field(raw.venue_name, raw.venue_name_confidence),
    address_text: field(raw.address_text, raw.address_text_confidence),
    city_hint: field(raw.city_hint, raw.city_hint_confidence),
    postal_code_hint: field(raw.postal_code_hint, raw.postal_code_hint_confidence),
    price_amount: field(raw.price_amount, raw.price_amount_confidence),
    is_free: field(raw.is_free, raw.is_free_confidence),
    contact_email: field(raw.contact_email, raw.contact_email_confidence),
    contact_phone: field(raw.contact_phone, raw.contact_phone_confidence),
    external_url: field(raw.external_url, raw.external_url_confidence),
    organizer_name: field(raw.organizer_name, raw.organizer_name_confidence),
    category_slug: field(raw.category_slug, raw.category_slug_confidence),
    subcategory_slug: field(raw.subcategory_slug, raw.subcategory_slug_confidence),
    tag_slugs: field(Array.isArray(raw.tag_slugs) ? raw.tag_slugs : [], raw.tag_slugs_confidence),
  };
}
