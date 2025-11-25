import type { EventCategory, EventVisibility } from './database';

export interface AddressDetails {
  streetNumber: string;
  streetName: string;
  city: string;
  postalCode: string;
}

export interface DailyScheduleSlot {
  date: string;
  opensAt: string;
  closesAt: string;
}

export type ScheduleMode = 'uniform' | 'daily';

export interface EventFormData {
  title: string;
  description: string;
  category: EventCategory;
  tags: string[];
  startsAt: string;
  endsAt: string;
  scheduleMode: ScheduleMode;
  uniformOpening: string;
  uniformClosing: string;
  dailySchedule: DailyScheduleSlot[];
  latitude: number;
  longitude: number;
  address: AddressDetails;
  visibility: EventVisibility;
  isFree: boolean;
  price: number | null;
  coverUrl: string;
  gallery: string[];
}

export interface EventFormErrors {
  title?: string;
  description?: string;
  category?: string;
  startsAt?: string;
  endsAt?: string;
  schedule?: string;
  location?: string;
  address?: string;
  coverUrl?: string;
  general?: string;
}

export interface LocationState {
  latitude: number;
  longitude: number;
  isLocked: boolean;
  savedLocation: { latitude: number; longitude: number } | null;
}
