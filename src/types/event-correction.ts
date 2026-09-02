/**
 * SCRUM-120 / SCRUM-152 / SCRUM-156 — Community proposals to correct published event fields or flag duplicates.
 * Applied to `events` only after WebConsole / service_role accept (ADR 001).
 */

export const EVENT_CORRECTION_KINDS = ['field_correction', 'duplicate'] as const;
export type EventCorrectionKind = (typeof EVENT_CORRECTION_KINDS)[number];

export const EVENT_CORRECTION_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type EventCorrectionStatus = (typeof EVENT_CORRECTION_STATUSES)[number];

/** Fields the mobile form may submit today. */
export const EVENT_CORRECTION_USER_FIELDS = [
  'starts_at',
  'ends_at',
  'operating_hours',
  'schedule_mode',
  'address',
  'city',
  'postal_code',
  'venue_name',
  'latitude',
  'longitude',
  'is_free',
  'price',
  'category',
  'subcategory',
] as const;

/** Older proposals may still contain these keys; the form no longer sends them. */
export const EVENT_CORRECTION_LEGACY_FIELDS = [
  'title',
  'description',
  'cover_url',
  'external_url',
] as const;

/** Whitelist mirrored by validate_event_correction_proposal() trigger (user + legacy). */
export const EVENT_CORRECTION_ALLOWED_FIELDS = [
  ...EVENT_CORRECTION_USER_FIELDS,
  ...EVENT_CORRECTION_LEGACY_FIELDS,
] as const;

export type EventCorrectionUserFieldKey = (typeof EVENT_CORRECTION_USER_FIELDS)[number];
export type EventCorrectionFieldKey = (typeof EVENT_CORRECTION_ALLOWED_FIELDS)[number];
export type EventCorrectionFieldValue =
  | string
  | number
  | boolean
  | null
  | EventCorrectionFieldValue[]
  | { [key: string]: EventCorrectionFieldValue | undefined };

export type EventCorrectionProposedFields = Partial<Record<EventCorrectionFieldKey, EventCorrectionFieldValue>>;

export type EventCorrectionProposal = {
  id: string;
  event_id: string;
  proposer_id: string;
  kind: EventCorrectionKind;
  proposed_fields: EventCorrectionProposedFields | null;
  duplicate_of_event_id: string | null;
  duplicate_hint: string | null;
  source_hint: string | null;
  comment: string;
  status: EventCorrectionStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Present when listed with the events embed (Mes suggestions). */
  event?: { id: string; title: string | null } | null;
};

export type CreateFieldCorrectionInput = {
  eventId: string;
  kind: 'field_correction';
  proposedFields: EventCorrectionProposedFields;
  comment: string;
  sourceHint?: string | null;
};

export type CreateDuplicateCorrectionInput = {
  eventId: string;
  kind: 'duplicate';
  comment: string;
  duplicateOfEventId?: string | null;
  duplicateHint?: string | null;
  sourceHint?: string | null;
};

export type CreateEventCorrectionInput = CreateFieldCorrectionInput | CreateDuplicateCorrectionInput;

export function isAllowedCorrectionField(key: string): key is EventCorrectionFieldKey {
  return (EVENT_CORRECTION_ALLOWED_FIELDS as readonly string[]).includes(key);
}

export function isUserCorrectionField(key: string): key is EventCorrectionUserFieldKey {
  return (EVENT_CORRECTION_USER_FIELDS as readonly string[]).includes(key);
}

export function pickCorrectionDiff(
  fields: EventCorrectionProposedFields,
): EventCorrectionProposedFields {
  const next: EventCorrectionProposedFields = {};
  for (const key of EVENT_CORRECTION_USER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key) && fields[key] !== undefined) {
      next[key] = fields[key] ?? null;
    }
  }
  return next;
}
