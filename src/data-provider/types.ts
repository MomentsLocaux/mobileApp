import type { FeatureCollection } from 'geojson';
import type { CommentWithAuthor, Event, EventWithCreator, Profile } from '@/types/database';

export interface CheckInResult {
  success: boolean;
  message?: string;
  rewards?: { lumo?: number };
}

export interface IDataProvider {
  listEvents(filters?: Record<string, unknown>): Promise<EventWithCreator[]>;
  getEventById(id: string): Promise<EventWithCreator | null>;
  listEventsByCreator?(creatorId: string): Promise<EventWithCreator[]>;
  createEvent(payload: Partial<Event>): Promise<Event>;
  updateEvent?(id: string, payload: Partial<Event>): Promise<EventWithCreator>;
  setEventMedia?(eventId: string, urls: string[]): Promise<void>;
  deleteEvent(id: string): Promise<boolean>;

  listComments(eventId: string): Promise<CommentWithAuthor[]>;
  createComment(payload: {
    eventId: string;
    authorId: string;
    message: string;
    rating?: number | null;
  }): Promise<CommentWithAuthor | null>;
  deleteComment(id: string): Promise<boolean>;

  checkInEvent(eventId: string, lat: number, lon: number, token?: string): Promise<CheckInResult>;

  reportEvent(
    eventId: string,
    payload: { reason: string; severity?: string; details?: string; token?: string },
    token?: string,
  ): Promise<boolean>;
  reportComment(
    commentId: string,
    payload: { reason: string; severity?: string; details?: string; token?: string },
    token?: string,
  ): Promise<boolean>;

  purchaseItem(
    payload: { itemId: string; method: 'lumo' | 'eur'; userId: string; token?: string },
    token?: string,
  ): Promise<boolean>;

  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(
    userId: string,
    payload: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Profile | null>;

  earnLumo(payload: { amount?: number; reason?: string; item_type?: string; item_id?: string }): Promise<any>;
  spendLumo(payload: { amount: number; reason?: string; item_type?: string; item_id?: string }): Promise<any>;

  toggleFavorite(eventId: string): Promise<boolean>;
  toggleInterest(eventId: string): Promise<boolean>;
  like(eventId: string): Promise<boolean>;

  submitBug(payload: {
    category: string;
    severity: string;
    page?: string;
    description: string;
    reporterId?: string;
  }): Promise<boolean>;

  uploadAvatar(userId: string, uri: string): Promise<string | null>;
  uploadEventCover?(userId: string, uri: string): Promise<string | null>;

  listEventsByBBox?(params: {
    ne: [number, number];
    sw: [number, number];
    limit?: number;
    includePast?: boolean;
  }): Promise<FeatureCollection>;
  getEventsByIds?(ids: string[]): Promise<EventWithCreator[]>;
}

export interface IAuthProvider {
  signIn(email: string, password: string): Promise<{ session: any; user: any }>;
  signUp(email: string, password: string): Promise<{ session: any; user: any }>;
  signOut(): Promise<void>;
  getSession(): Promise<any>;
  getUser(): Promise<any>;
  ensureProfile(userId: string, email: string): Promise<Profile | null>;
  onAuthStateChange(callback: (session: any | null) => void): { unsubscribe: () => void };
}

export interface IBugsProvider {
  submitBug(payload: {
    category: string;
    severity: string;
    page?: string;
    description: string;
    reporterId?: string;
  }): Promise<boolean>;
}
