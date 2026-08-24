import type { EventLocation } from '@/hooks/useCreateEventStore';
import { MapboxService } from '@/services/mapbox.service';
import type { Category, Subcategory, Tag } from '@/store/taxonomyStore';
import type { ConfidentField, PosterExtractionFields, PosterPrefillSummary } from '@/types/poster-extract';

export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_MEDIUM = 0.6;

export type PosterStoreDraft = {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: EventLocation;
  category?: string;
  subcategory?: string;
  tags: string[];
  price?: string;
  contact?: string;
  externalLink?: string;
};

function pickValue<T>(field: ConfidentField<T | null>, fieldKey: string, summary: PosterPrefillSummary): T | null {
  if (field.value == null || field.value === '') return null;
  if (field.confidence >= CONFIDENCE_HIGH) {
    summary.appliedFields.push(fieldKey);
    return field.value;
  }
  if (field.confidence >= CONFIDENCE_MEDIUM) {
    summary.appliedFields.push(fieldKey);
    summary.uncertainFields.push(fieldKey);
    return field.value;
  }
  return null;
}

function pickString(field: ConfidentField<string | null>, fieldKey: string, summary: PosterPrefillSummary): string | undefined {
  const value = pickValue(field, fieldKey, summary);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function mergeDateTime(dateStr: string, timeStr?: string | null, fallbackTime = '19:00'): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : fallbackTime;
  const [hours, minutes] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return dt.toISOString();
}

function resolveCategoryIds(
  fields: PosterExtractionFields,
  summary: PosterPrefillSummary,
  categories: Category[],
  subcategories: Subcategory[],
): { category?: string; subcategory?: string } {
  const categorySlug = pickString(fields.category_slug, 'category_slug', summary);
  if (!categorySlug) return {};

  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) return {};

  const subSlug = pickString(fields.subcategory_slug, 'subcategory_slug', summary);
  const sub = subSlug
    ? subcategories.find((s) => s.slug === subSlug && s.category_id === category.id)
    : undefined;

  return {
    category: category.id,
    subcategory: sub?.id,
  };
}

function resolveTagIds(
  fields: PosterExtractionFields,
  summary: PosterPrefillSummary,
  tags: Tag[],
): string[] {
  if (fields.tag_slugs.confidence < CONFIDENCE_MEDIUM) return [];
  const slugs = fields.tag_slugs.value ?? [];
  if (!slugs.length) return [];

  const ids = slugs
    .map((slug) => tags.find((t) => t.slug === slug)?.id)
    .filter((id): id is string => Boolean(id));

  if (ids.length) summary.appliedFields.push('tag_slugs');
  return ids;
}

async function resolveLocation(
  fields: PosterExtractionFields,
  summary: PosterPrefillSummary,
): Promise<EventLocation | undefined> {
  const venue = pickString(fields.venue_name, 'venue_name', summary);
  const address = pickString(fields.address_text, 'address_text', summary);
  const city = pickString(fields.city_hint, 'city_hint', summary);
  const postal = pickString(fields.postal_code_hint, 'postal_code_hint', summary);

  const queryParts = [venue, address, city, postal].filter(Boolean);
  if (!queryParts.length) return undefined;

  const query = queryParts.join(', ');
  const results = await MapboxService.search(query, { types: 'poi,address,place' });
  const best = results[0];
  if (!best) {
    if (venue || address || city) summary.uncertainFields.push('location');
    return undefined;
  }

  summary.appliedFields.push('location');
  return {
    latitude: best.latitude,
    longitude: best.longitude,
    addressLabel: best.label,
    city: best.city || city || '',
    postalCode: best.postalCode || postal || '',
    country: best.country || 'FR',
  };
}

function resolvePrice(
  fields: PosterExtractionFields,
  summary: PosterPrefillSummary,
): string | undefined {
  const isFree = pickValue(fields.is_free, 'is_free', summary);
  if (isFree === true) return '0';

  const amount = pickValue(fields.price_amount, 'price_amount', summary);
  if (typeof amount === 'number' && amount >= 0) {
    return String(amount);
  }
  return undefined;
}

function resolveContact(
  fields: PosterExtractionFields,
  summary: PosterPrefillSummary,
): string | undefined {
  const email = pickString(fields.contact_email, 'contact_email', summary);
  const phone = pickString(fields.contact_phone, 'contact_phone', summary);
  if (email && phone) return `${email} · ${phone}`;
  return email || phone;
}

export async function mapPosterExtractionToStoreDraft(
  fields: PosterExtractionFields,
  taxonomy: {
    categories: Category[];
    subcategories: Subcategory[];
    tags: Tag[];
  },
): Promise<{ draft: PosterStoreDraft; summary: PosterPrefillSummary }> {
  const summary: PosterPrefillSummary = { uncertainFields: [], appliedFields: [] };

  const startDateStr = pickString(fields.start_date, 'start_date', summary);
  const startTimeStr = fields.start_time.value;
  const endDateStr = pickString(fields.end_date, 'end_date', summary);
  const endTimeStr = fields.end_time.value;

  let startDate: string | undefined;
  let endDate: string | undefined;

  if (startDateStr) {
    startDate = mergeDateTime(startDateStr, startTimeStr, '19:00');
    if (fields.year_inferred.value && fields.year_inferred.confidence >= CONFIDENCE_MEDIUM) {
      summary.uncertainFields.push('year_inferred');
    }
  }

  if (endDateStr) {
    endDate = mergeDateTime(endDateStr, endTimeStr, '22:00');
  } else if (startDate) {
    const auto = new Date(startDate);
    auto.setUTCHours(auto.getUTCHours() + 2);
    endDate = auto.toISOString();
  }

  const { category, subcategory } = resolveCategoryIds(
    fields,
    summary,
    taxonomy.categories,
    taxonomy.subcategories,
  );

  const location = await resolveLocation(fields, summary);

  const draft: PosterStoreDraft = {
    title: pickString(fields.title, 'title', summary),
    description: pickString(fields.description, 'description', summary),
    startDate,
    endDate,
    location,
    category,
    subcategory,
    tags: resolveTagIds(fields, summary, taxonomy.tags),
    price: resolvePrice(fields, summary),
    contact: resolveContact(fields, summary),
    externalLink: pickString(fields.external_url, 'external_url', summary),
  };

  return { draft, summary };
}

export function applyPosterDraftToCreateStore(
  draft: PosterStoreDraft,
  setters: {
    setTitle: (v: string) => void;
    setDescription: (v?: string) => void;
    setStartDate: (v?: string) => void;
    setEndDate: (v?: string) => void;
    setLocation: (v?: EventLocation) => void;
    setCategory: (v?: string) => void;
    setSubcategory: (v?: string) => void;
    setTags: (v: string[]) => void;
    setPrice: (v?: string) => void;
    setContact: (v?: string) => void;
    setExternalLink: (v?: string) => void;
    setCoverImage: (v: { storagePath: string; publicUrl: string }) => void;
  },
  cover: { storagePath: string; publicUrl: string },
): void {
  setters.setCoverImage(cover);
  if (draft.title) setters.setTitle(draft.title);
  if (draft.description) setters.setDescription(draft.description);
  if (draft.startDate) setters.setStartDate(draft.startDate);
  if (draft.endDate) setters.setEndDate(draft.endDate);
  if (draft.location) setters.setLocation(draft.location);
  if (draft.category) setters.setCategory(draft.category);
  if (draft.subcategory) setters.setSubcategory(draft.subcategory);
  if (draft.tags.length) setters.setTags(draft.tags);
  if (draft.price != null) setters.setPrice(draft.price);
  if (draft.contact) setters.setContact(draft.contact);
  if (draft.externalLink) setters.setExternalLink(draft.externalLink);
}
