/**
 * SCRUM-120 / SCRUM-152 — Community proposals to correct published event fields or flag duplicates.
 * Applied to `events` only after WebConsole / service_role accept (ADR 001).
 */

export const EVENT_CORRECTION_KINDS = ['field_correction', 'duplicate'] as const;
export type EventCorrectionKind = (typeof EVENT_CORRECTION_KINDS)[number];

export const EVENT_CORRECTION_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type EventCorrectionStatus = (typeof EVENT_CORRECTION_STATUSES)[number];

/** Whitelist mirrored by validate_event_correction_proposal() trigger. */
export const EVENT_CORRECTION_ALLOWED_FIELDS = [
  'title',
  'description',
  'starts_at',
  'ends_at',
  'address',
  'city',
  'postal_code',
  'venue_name',
  'latitude',
  'longitude',
  'is_free',
  'price',
  'cover_url',
  'external_url',
  'category',
  'subcategory',
] as const;

export type EventCorrectionFieldKey = (typeof EVENT_CORRECTION_ALLOWED_FIELDS)[number];

export type EventCorrectionProposedFields = Partial<
  Record<EventCorrectionFieldKey, string | number | boolean | null>
>;

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

export function pickCorrectionDiff(
  fields: EventCorrectionProposedFields,
): EventCorrectionProposedFields {
  const next: EventCorrectionProposedFields = {};
  for (const key of EVENT_CORRECTION_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key) && fields[key] !== undefined) {
      next[key] = fields[key] ?? null;
    }
  }
  return next;
}
