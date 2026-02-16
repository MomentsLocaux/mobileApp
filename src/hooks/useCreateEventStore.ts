import { create } from 'zustand';
import type {
  EventScheduleModeMobile,
  EventTimeSlot,
  VariableSchedules,
} from '@/utils/event-schedule';

type CoverImage = {
  storagePath: string;
  publicUrl: string;
};

export type GalleryImage = {
  id?: string; // DB id if existing
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
  setCoverImage: (img: CoverImage | undefined) => void;
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

const initialState = {
  title: '',
  startDate: undefined,
  endDate: undefined,
  location: undefined,
  videoLink: undefined,
  description: '',
  coverImage: undefined,
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
};

export const useCreateEventStore = create<CreateEventState>((set) => ({
  ...initialState,
  setCoverImage: (coverImage) => set({ coverImage }),
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
  reset: () => set(initialState),
}));
