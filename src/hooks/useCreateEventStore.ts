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
  coverImage?: CoverImage;
  title: string;
  startDate?: string;
  endDate?: string;
  location?: EventLocation;
  videoLink?: string;
  description?: string;
  category?: string;
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
  setTags: (tags: string[]) => void;
  setVisibility: (v: 'public' | 'unlisted') => void;
  setPrice: (price?: string) => void;
  setDuration: (duration?: string) => void;
  setContact: (contact?: string) => void;
  setExternalLink: (link?: string) => void;
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
  setCategory: (category) => set({ category }),
  setTags: (tags) => set({ tags }),
  setVisibility: (visibility) => set({ visibility }),
  setPrice: (price) => set({ price }),
  setDuration: (duration) => set({ duration }),
  setContact: (contact) => set({ contact }),
  setExternalLink: (externalLink) => set({ externalLink }),
  reset: () => set(initialState),
}));
