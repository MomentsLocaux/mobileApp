import { create } from 'zustand';
import { EVENT_COVER_GENERATE_MAX_TRIES } from '@/constants/cover-generate-quota';
import { EVENT_POSTER_ANALYZE_MAX_TRIES } from '@/constants/poster-analyze-quota';
import type { EventSubmissionSource } from '@/types/event-submission';
import type {
  EventScheduleModeMobile,
  EventTimeSlot,
  VariableSchedules,
} from '@/utils/event-schedule';

function newCoverDraftId(): string {
  try {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (typeof uuid === 'string' && uuid.length > 0) return uuid;
  } catch {
    // fallback below
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export type CoverImage = {
  storagePath: string;
  publicUrl: string;
};

export type CoverOrigin = 'none' | 'user' | 'ai';

export type GalleryImage = {
  id?: string;
  storagePath: string;
  publicUrl: string;
  status: 'existing' | 'added' | 'removed';
};

export type EventLocation = {
  latitude: number;
  longitude: number;
  addressLabel: string;
  city: string;
  postalCode: string;
  country: string;
};

interface CreateEventState {
  coverImage?: CoverImage;
  /** Original user/poster photo kept as AI reference even after a generated cover. */
  userReferenceCover?: CoverImage;
  coverOrigin: CoverOrigin;
  /** Stable id sent to generate-event-cover so the 2-try quota is per draft, not per app session. */
  coverDraftId: string;
  /** AI results for this draft (max 2). User picks one as cover. */
  aiCoverCandidates: CoverImage[];
  /** AI poster analyses already used for this draft (max 2). */
  posterAnalyzeAttempts: number;
  title: string;
  startDate?: string;
  endDate?: string;
  location?: EventLocation;
  videoLink?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  tags: string[];
  gallery: GalleryImage[];
  visibility: 'public' | 'unlisted';
  price?: string;
  duration?: string;
  contact?: string;
  externalLink?: string;
  scheduleMode: EventScheduleModeMobile;
  scheduleOpenDays: number[];
  scheduleFixedSlots: EventTimeSlot[];
  scheduleVariableDays: VariableSchedules;
  privateAudienceIds: string[];
  /** Intent at publish time → events.submission_source */
  submissionSource: EventSubmissionSource;
  setSubmissionSource: (source: EventSubmissionSource) => void;
  setCoverImage: (img: CoverImage | undefined, origin?: Exclude<CoverOrigin, 'none'>) => void;
  setCoverDraftId: (id: string) => void;
  addAiCoverCandidate: (img: CoverImage) => void;
  selectAiCoverCandidate: (img: CoverImage) => void;
  incrementPosterAnalyzeAttempts: () => void;
  decrementPosterAnalyzeAttempts: () => void;
  markPosterAnalyzeQuotaReached: () => void;
  setTitle: (title: string) => void;
  setStartDate: (date?: string) => void;
  setEndDate: (date?: string) => void;
  setLocation: (loc?: EventLocation) => void;
  setVideoLink: (link?: string) => void;
  setDescription: (desc?: string) => void;
  setCategory: (cat?: string) => void;
  setSubcategory: (cat?: string) => void;
  setTags: (tags: string[]) => void;
  addGalleryImage: (img: GalleryImage) => void;
  markGalleryImageRemoved: (publicUrl: string) => void;
  setGallery: (imgs: GalleryImage[]) => void;
  setVisibility: (v: 'public' | 'unlisted') => void;
  setPrice: (price?: string) => void;
  setDuration: (duration?: string) => void;
  setContact: (contact?: string) => void;
  setExternalLink: (link?: string) => void;
  setScheduleMode: (mode: EventScheduleModeMobile) => void;
  setScheduleOpenDays: (days: number[]) => void;
  setScheduleFixedSlots: (slots: EventTimeSlot[]) => void;
  setScheduleVariableDays: (days: VariableSchedules) => void;
  setPrivateAudienceIds: (ids: string[]) => void;
  reset: () => void;
}

const createInitialState = () => ({
  title: '',
  startDate: undefined,
  endDate: undefined,
  location: undefined,
  videoLink: undefined,
  description: '',
  coverImage: undefined,
  userReferenceCover: undefined,
  coverOrigin: 'none' as CoverOrigin,
  coverDraftId: newCoverDraftId(),
  aiCoverCandidates: [] as CoverImage[],
  posterAnalyzeAttempts: 0,
  category: undefined,
  subcategory: undefined,
  tags: [],
  gallery: [],
  visibility: 'public' as const,
  price: undefined,
  duration: undefined,
  contact: undefined,
  externalLink: undefined,
  scheduleMode: 'single_day' as EventScheduleModeMobile,
  scheduleOpenDays: [1, 2, 3, 4, 5, 6, 7],
  scheduleFixedSlots: [{ start: '09:00', end: '18:00' }] as EventTimeSlot[],
  scheduleVariableDays: {} as VariableSchedules,
  privateAudienceIds: [] as string[],
  submissionSource: 'organizer_create' as EventSubmissionSource,
});

export const useCreateEventStore = create<CreateEventState>((set) => ({
  ...createInitialState(),
  setSubmissionSource: (submissionSource) => set({ submissionSource }),
  setCoverImage: (coverImage, origin = 'user') => {
    if (!coverImage) {
      set({ coverImage: undefined, userReferenceCover: undefined, coverOrigin: 'none' });
      return;
    }
    if (origin === 'ai') {
      set({ coverImage, coverOrigin: 'ai' });
      return;
    }
    set({ coverImage, userReferenceCover: coverImage, coverOrigin: 'user' });
  },
  setCoverDraftId: (coverDraftId) => set({ coverDraftId }),
  addAiCoverCandidate: (img) =>
    set((state) => {
      if (state.aiCoverCandidates.length >= EVENT_COVER_GENERATE_MAX_TRIES) return state;
      if (state.aiCoverCandidates.some((candidate) => candidate.storagePath === img.storagePath)) {
        return state;
      }
      const next = [...state.aiCoverCandidates, img];
      const selectNew = state.aiCoverCandidates.length === 0 || !state.coverImage;
      return {
        aiCoverCandidates: next,
        ...(selectNew ? { coverImage: img, coverOrigin: 'ai' as const } : {}),
      };
    }),
  selectAiCoverCandidate: (img) => set({ coverImage: img, coverOrigin: 'ai' }),
  incrementPosterAnalyzeAttempts: () =>
    set((state) => ({
      posterAnalyzeAttempts: Math.min(
        EVENT_POSTER_ANALYZE_MAX_TRIES,
        state.posterAnalyzeAttempts + 1,
      ),
    })),
  decrementPosterAnalyzeAttempts: () =>
    set((state) => ({
      posterAnalyzeAttempts: Math.max(0, state.posterAnalyzeAttempts - 1),
    })),
  markPosterAnalyzeQuotaReached: () => set({ posterAnalyzeAttempts: EVENT_POSTER_ANALYZE_MAX_TRIES }),
  setTitle: (title) => set({ title }),
  setStartDate: (startDate) => set({ startDate }),
  setEndDate: (endDate) => set({ endDate }),
  setLocation: (location) => set({ location }),
  setVideoLink: (videoLink) => set({ videoLink }),
  setDescription: (description) => set({ description }),
  setCategory: (category) => set({ category, subcategory: undefined }),
  setSubcategory: (subcategory) => set({ subcategory }),
  setTags: (tags) => set({ tags }),
  addGalleryImage: (img) =>
    set((state) => {
      const activeCount = state.gallery.filter((g) => g.status !== 'removed').length;
      if (activeCount >= 3) return state;
      if (state.gallery.find((g) => g.publicUrl === img.publicUrl)) return state;
      return { gallery: [...state.gallery, { ...img, status: 'added' }] };
    }),
  markGalleryImageRemoved: (publicUrl) =>
    set((state) => ({
      gallery: state.gallery.map((g) =>
        g.publicUrl === publicUrl ? { ...g, status: 'removed' } : g
      ),
    })),
  setGallery: (gallery) =>
    set(() => {
      const deduped = gallery
        .filter((g) => !!g.publicUrl && g.publicUrl.trim().length > 0)
        .reduce((acc: GalleryImage[], curr) => {
          if (!acc.find((item) => item.publicUrl === curr.publicUrl)) {
            acc.push({ ...curr, status: curr.status || 'existing' });
          }
          return acc;
        }, [])
        .slice(0, 3);
      return { gallery: deduped };
    }),
  setVisibility: (visibility) => set({ visibility }),
  setPrice: (price) => set({ price }),
  setDuration: (duration) => set({ duration }),
  setContact: (contact) => set({ contact }),
  setExternalLink: (externalLink) => set({ externalLink }),
  setScheduleMode: (scheduleMode) => set({ scheduleMode }),
  setScheduleOpenDays: (scheduleOpenDays) => set({ scheduleOpenDays }),
  setScheduleFixedSlots: (scheduleFixedSlots) => set({ scheduleFixedSlots }),
  setScheduleVariableDays: (scheduleVariableDays) => set({ scheduleVariableDays }),
  setPrivateAudienceIds: (privateAudienceIds) => set({ privateAudienceIds }),
  reset: () => set(createInitialState()),
}));

export function hasCreateEventDraft(state: CreateEventState): boolean {
  return Boolean(
    state.title.trim() ||
      state.description?.trim() ||
      state.startDate ||
      state.endDate ||
      state.location ||
      state.coverImage ||
      state.category ||
      state.subcategory ||
      state.tags.length > 0 ||
      state.gallery.some((image) => image.status !== 'removed') ||
      state.contact?.trim() ||
      state.price?.trim() ||
      state.externalLink?.trim() ||
      state.videoLink?.trim(),
  );
}
