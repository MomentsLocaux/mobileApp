import { EventsService } from '@/services/events.service';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { deriveScheduleStateFromEvent } from '@/utils/event-schedule';
import { isEventSubmissionSource } from '@/types/event-submission';
import { withoutNeedsChangesTag } from '@/constants/moderation-tags';
import type { EventWithCreator } from '@/types/database';

export const EDITABLE_EVENT_STATUSES = new Set(['draft', 'refused']);

const extractStoragePath = (url: string | null | undefined) => {
  if (!url) return '';
  const marker = '/storage/v1/object/public/event-media/';
  const idx = url.indexOf(marker);
  return idx !== -1 ? url.slice(idx + marker.length) : '';
};

export async function prefillCreateEventStore(
  eventId: string,
): Promise<{ ok: true; event: EventWithCreator } | { ok: false; reason: 'missing' | 'not_editable' }> {
  const evt = await EventsService.getById(eventId);
  if (!evt) return { ok: false, reason: 'missing' };
  if (!EDITABLE_EVENT_STATUSES.has(evt.status || '')) {
    return { ok: false, reason: 'not_editable' };
  }

  const store = useCreateEventStore.getState();
  store.reset();
  store.setTitle(evt.title || '');
  store.setDescription(evt.description || '');
  store.setStartDate(evt.starts_at || undefined);
  store.setEndDate(evt.ends_at || undefined);
  store.setCategory(evt.category || undefined);
  store.setSubcategory(evt.subcategory || undefined);
  store.setTags(withoutNeedsChangesTag(evt.tags));
  store.setVisibility(evt.visibility === 'prive' ? 'unlisted' : 'public');
  store.setPrice(evt.price ? String(evt.price) : undefined);
  store.setDuration(undefined);
  store.setContact(evt.contact_email || evt.contact_phone || undefined);
  store.setExternalLink(evt.external_url || undefined);
  store.setVideoLink(undefined);
  const scheduleState = deriveScheduleStateFromEvent(evt);
  store.setScheduleMode(scheduleState.mode);
  store.setScheduleOpenDays(scheduleState.openDays);
  store.setScheduleFixedSlots(scheduleState.fixedSlots);
  store.setScheduleVariableDays(scheduleState.variableSchedules);
  store.setCoverImage(evt.cover_url ? { publicUrl: evt.cover_url, storagePath: '' } : undefined);
  store.setGallery(
    (evt.media || [])
      .filter((m) => !!m.url && m.url !== evt.cover_url)
      .slice(0, 3)
      .map((m) => ({
        id: (m as { id?: string }).id,
        publicUrl: m.url as string,
        storagePath: extractStoragePath(m.url as string),
        status: 'existing' as const,
      })),
  );
  if (evt.latitude && evt.longitude) {
    store.setLocation({
      latitude: evt.latitude,
      longitude: evt.longitude,
      addressLabel: evt.address || '',
      city: evt.city || '',
      postalCode: evt.postal_code || '',
      country: '',
    });
  }
  if (isEventSubmissionSource(evt.submission_source)) {
    store.setSubmissionSource(evt.submission_source);
  }
  return { ok: true, event: evt };
}
