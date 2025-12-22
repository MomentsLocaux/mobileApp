import { create } from 'zustand';

type CoverImage = {
  storagePath: string;
  publicUrl: string;
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
  editingEventId?: string;
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
  visibility: 'public' | 'unlisted';
  price?: string;
  duration?: string;
  contact?: string;
  externalLink?: string;
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
  setVisibility: (v: 'public' | 'unlisted') => void;
  setPrice: (price?: string) => void;
  setDuration: (duration?: string) => void;
  setContact: (contact?: string) => void;
  setExternalLink: (link?: string) => void;
  setEditingEvent: (id?: string) => void;
  loadFromEvent: (event: any) => void;
  reset: () => void;
}

const initialState = {
  editingEventId: undefined as string | undefined,
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
  visibility: 'public' as const,
  price: undefined,
  duration: undefined,
  contact: undefined,
  externalLink: undefined,
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
  setVisibility: (visibility) => set({ visibility }),
  setPrice: (price) => set({ price }),
  setDuration: (duration) => set({ duration }),
  setContact: (contact) => set({ contact }),
  setExternalLink: (externalLink) => set({ externalLink }),
  setEditingEvent: (editingEventId) => set({ editingEventId }),
  loadFromEvent: (event) =>
    set(() => {
      const priceValue =
        typeof event.price === 'number' && !Number.isNaN(event.price) ? String(event.price) : undefined;
      return {
        editingEventId: event.id,
        coverImage: event.cover_url
          ? {
              publicUrl: event.cover_url,
              storagePath: event.cover_url,
            }
          : undefined,
        title: event.title || '',
        startDate: event.starts_at || undefined,
        endDate: event.ends_at || undefined,
        location:
          event.latitude && event.longitude
            ? {
                latitude: event.latitude,
                longitude: event.longitude,
                addressLabel: event.address || '',
                city: event.city || '',
                postalCode: event.postal_code || '',
                country: '',
              }
            : undefined,
        description: event.description || '',
        category: event.category || event.category_old || undefined,
        subcategory: event.subcategory || undefined,
        tags: Array.isArray(event.tags) ? event.tags : [],
        visibility: event.visibility === 'public' ? 'public' : 'unlisted',
        price: priceValue,
        externalLink: event.external_url || undefined,
        contact: event.contact_email || event.contact_phone || undefined,
      };
    }),
  reset: () => set(initialState),
}));
