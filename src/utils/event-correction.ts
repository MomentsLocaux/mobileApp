import {
  EVENT_CORRECTION_COMMENT_MAX,
  EVENT_CORRECTION_DAILY_QUOTA,
  EVENT_CORRECTION_USER_FIELDS,
  pickCorrectionDiff,
  type EventCorrectionProposedFields,
  type EventCorrectionUserFieldKey,
} from '../types/event-correction';
import {
  eventScheduleModeToDb,
  operatingHoursFromDraft,
  type EventScheduleDraft,
} from './event-schedule';

export const CORRECTION_FIELD_GROUPS: {
  id: 'schedule' | 'place' | 'category' | 'price';
  label: string;
  keys: EventCorrectionUserFieldKey[];
}[] = [
  {
    id: 'schedule',
    label: 'Date et horaires',
    keys: ['starts_at', 'ends_at', 'operating_hours', 'schedule_mode'],
  },
  {
    id: 'place',
    label: 'Lieu',
    keys: ['address', 'city', 'postal_code', 'venue_name', 'latitude', 'longitude'],
  },
  {
    id: 'category',
    label: 'Catégorie et sous-catégorie',
    keys: ['category', 'subcategory'],
  },
  {
    id: 'price',
    label: 'Tarif',
    keys: ['is_free', 'price'],
  },
];

export type CorrectionTaxonomyLabels = {
  category: (id: string | null) => string;
  subcategory: (id: string | null) => string;
};

const sameValue = (before: unknown, after: unknown) => JSON.stringify(before ?? null) === JSON.stringify(after ?? null);

const formatDateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value) return 'non renseigné';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPrice = (isFree: unknown, price: unknown) => {
  if (isFree === true || price == null || price === '') return 'gratuit';
  const amount = typeof price === 'number' ? price : Number(String(price).replace(',', '.'));
  if (!Number.isFinite(amount)) return String(price);
  return `${amount} €`;
};

const formatPlace = (fields: EventCorrectionProposedFields) => {
  const parts = [fields.venue_name, fields.address, fields.postal_code, fields.city]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (fields.latitude != null && fields.longitude != null) {
    return `${Number(fields.latitude).toFixed(5)}, ${Number(fields.longitude).toFixed(5)}`;
  }
  return 'non renseigné';
};

const summarizeOperatingHours = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) return 'horaires non renseignés';
  const first = value[0] as { kind?: string; date?: string; slots?: { opens?: string; closes?: string }[]; open_days?: number[] };
  if (first?.kind === 'single_day') {
    const slot = first.slots?.[0];
    return slot?.opens && slot?.closes ? `${first.date || ''} ${slot.opens}–${slot.closes}`.trim() : 'journée unique';
  }
  if (first?.kind === 'fixed') {
    const slot = first.slots?.[0];
    const hours = slot?.opens && slot?.closes ? `${slot.opens}–${slot.closes}` : '';
    return `horaires fixes${hours ? ` ${hours}` : ''}`;
  }
  return `horaires particuliers (${value.length} jour${value.length > 1 ? 's' : ''})`;
};

export function changedCorrectionGroupIds(
  diff: EventCorrectionProposedFields,
): (typeof CORRECTION_FIELD_GROUPS)[number]['id'][] {
  const keys = Object.keys(diff) as EventCorrectionUserFieldKey[];
  return CORRECTION_FIELD_GROUPS.filter((group) => group.keys.some((key) => keys.includes(key))).map(
    (group) => group.id,
  );
}

export function changedCorrectionGroupLabels(diff: EventCorrectionProposedFields): string[] {
  const ids = changedCorrectionGroupIds(diff);
  return CORRECTION_FIELD_GROUPS.filter((group) => ids.includes(group.id)).map((group) => group.label);
}

export type CorrectionPlace = {
  latitude: number;
  longitude: number;
  addressLabel: string;
  city: string;
  postalCode: string;
  country: string;
};

export type CorrectionEventSnapshot = {
  starts_at?: string | null;
  ends_at?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  venue_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_free?: boolean | null;
  price?: number | null;
  category?: string | null;
  subcategory?: string | null;
};

export function eventLocationFromEvent(event: CorrectionEventSnapshot): CorrectionPlace | undefined {
  if (event.latitude == null || event.longitude == null || !Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) {
    return undefined;
  }
  return {
    latitude: event.latitude,
    longitude: event.longitude,
    addressLabel: event.address || '',
    city: event.city || '',
    postalCode: event.postal_code || '',
    country: 'FR',
  };
}

export function baselineCorrectionFields(event: CorrectionEventSnapshot, schedule: EventScheduleDraft): EventCorrectionProposedFields {
  return pickCorrectionDiff({
    starts_at: event.starts_at || null,
    ends_at: event.ends_at || null,
    operating_hours: operatingHoursFromDraft(schedule),
    schedule_mode: eventScheduleModeToDb(schedule.scheduleMode),
    address: event.address || null,
    city: event.city || null,
    postal_code: event.postal_code || null,
    venue_name: event.venue_name || null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    is_free: Boolean(event.is_free),
    price: event.price,
    category: event.category || null,
    subcategory: event.subcategory || null,
  });
}

export function proposedCorrectionFields(input: {
  schedule: EventScheduleDraft;
  location?: CorrectionPlace;
  venueName: string;
  isFree: boolean;
  price: string;
  category: string;
  subcategory: string;
}): EventCorrectionProposedFields {
  const priceTrimmed = input.price.trim();
  const price =
    input.isFree || !priceTrimmed
      ? null
      : Number.isFinite(Number(priceTrimmed.replace(',', '.')))
        ? Number(priceTrimmed.replace(',', '.'))
        : null;

  return pickCorrectionDiff({
    starts_at: input.schedule.startDate || null,
    ends_at: input.schedule.endDate || null,
    operating_hours: operatingHoursFromDraft(input.schedule),
    schedule_mode: eventScheduleModeToDb(input.schedule.scheduleMode),
    address: input.location?.addressLabel?.trim() || null,
    city: input.location?.city?.trim() || null,
    postal_code: input.location?.postalCode?.trim() || null,
    venue_name: input.venueName.trim() || null,
    latitude: input.location?.latitude ?? null,
    longitude: input.location?.longitude ?? null,
    is_free: input.isFree,
    price: input.isFree ? null : price,
    category: input.category.trim() || null,
    subcategory: input.subcategory.trim() || null,
  });
}

export function diffCorrectionFields(
  baseline: EventCorrectionProposedFields,
  next: EventCorrectionProposedFields,
): EventCorrectionProposedFields {
  const diff: EventCorrectionProposedFields = {};
  for (const key of EVENT_CORRECTION_USER_FIELDS) {
    const before = baseline[key] ?? null;
    const after = next[key] ?? null;
    if (!sameValue(before, after)) diff[key] = after;
  }
  return diff;
}

export function buildFieldCorrectionComment(input: {
  diff: EventCorrectionProposedFields;
  baseline: EventCorrectionProposedFields;
  labels?: CorrectionTaxonomyLabels;
}): string {
  const { diff, baseline, labels } = input;
  const groups = CORRECTION_FIELD_GROUPS.filter((group) => group.keys.some((key) => key in diff));
  if (groups.length === 0) return '';

  const parts = groups.map((group) => {
    if (group.id === 'schedule') {
      const before = `${formatDateTime(baseline.starts_at)} → ${formatDateTime(baseline.ends_at)}`;
      const after = `${formatDateTime(diff.starts_at ?? baseline.starts_at)} → ${formatDateTime(diff.ends_at ?? baseline.ends_at)}`;
      const hours = diff.operating_hours != null ? ` (${summarizeOperatingHours(diff.operating_hours)})` : '';
      return `${group.label} : ${before} devient ${after}${hours}`;
    }
    if (group.id === 'place') {
      return `${group.label} : ${formatPlace(baseline)} devient ${formatPlace({ ...baseline, ...diff })}`;
    }
    if (group.id === 'category') {
      const cat = labels?.category ?? ((id: string | null) => id || 'non renseigné');
      const sub = labels?.subcategory ?? ((id: string | null) => id || 'aucune');
      const beforeCat = typeof baseline.category === 'string' ? baseline.category : null;
      const afterCat = typeof (diff.category ?? baseline.category) === 'string' ? String(diff.category ?? baseline.category) : null;
      const beforeSub = typeof baseline.subcategory === 'string' ? baseline.subcategory : null;
      const afterSub = 'subcategory' in diff
        ? typeof diff.subcategory === 'string'
          ? diff.subcategory
          : null
        : beforeSub;
      return `${group.label} : ${cat(beforeCat)} / ${sub(beforeSub)} devient ${cat(afterCat)} / ${sub(afterSub)}`;
    }
    const before = formatPrice(baseline.is_free, baseline.price);
    const after = formatPrice(diff.is_free ?? baseline.is_free, 'price' in diff || 'is_free' in diff ? diff.price : baseline.price);
    return `${group.label} : ${before} devient ${after}`;
  });

  return `Correction proposée — ${parts.join(' ; ')}.`;
}

export function startOfUtcDayIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export function formatCorrectionQuotaLabel(
  used: number,
  limit = EVENT_CORRECTION_DAILY_QUOTA,
): string {
  const safeUsed = Math.max(0, used);
  return `${safeUsed} / ${limit} propositions aujourd’hui`;
}

export function countTodayCorrectionProposals(
  items: { kind: string; createdAt?: string | null }[],
  now = new Date(),
): number {
  const start = Date.parse(startOfUtcDayIso(now));
  return items.filter((item) => {
    if (item.kind !== 'field_correction' && item.kind !== 'duplicate') return false;
    const ts = item.createdAt ? Date.parse(item.createdAt) : NaN;
    return Number.isFinite(ts) && ts >= start;
  }).length;
}

/** Append both event UUIDs so the web console can open the pair from the comment. */
export function buildDuplicateCorrectionComment(input: {
  comment: string;
  sourceEventId: string;
  duplicateEventId?: string | null;
}): string {
  const duplicateId = input.duplicateEventId?.trim() || 'non identifiée';
  const suffix = `\n\nIdentifiants :\nfiche signalée : ${input.sourceEventId}\nfiche présumée doublon : ${duplicateId}`;
  const body = input.comment.trim();
  const maxBody = EVENT_CORRECTION_COMMENT_MAX - suffix.length;
  const clipped = maxBody > 0 && body.length > maxBody ? body.slice(0, maxBody).trimEnd() : body;
  return `${clipped}${suffix}`;
}
