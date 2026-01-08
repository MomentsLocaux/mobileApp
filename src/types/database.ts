export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      events: {
        Row: Event;
        Insert: Omit<Event, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Event, 'id'>>;
      };
      event_media: {
        Row: EventMedia;
        Insert: Omit<EventMedia, 'id' | 'created_at'>;
        Update: Partial<Omit<EventMedia, 'id'>>;
      };
      event_comments: {
        Row: EventComment;
        Insert: Omit<EventComment, 'id' | 'created_at'>;
        Update: Partial<Omit<EventComment, 'id'>>;
      };
      event_likes: {
        Row: EventLike;
        Insert: Omit<EventLike, 'created_at'>;
        Update: never;
      };
      event_interests: {
        Row: EventInterest;
        Insert: Omit<EventInterest, 'created_at'>;
        Update: never;
      };
      event_checkins: {
        Row: EventCheckin;
        Insert: Omit<EventCheckin, 'id' | 'created_at'>;
        Update: never;
      };
      favorites: {
        Row: Favorite;
        Insert: Omit<Favorite, 'created_at'>;
        Update: never;
      };
      wallets: {
        Row: Wallet;
        Insert: Omit<Wallet, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Wallet, 'user_id'>>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at'>;
        Update: never;
      };
      user_xp_levels: {
        Row: UserXPLevel;
        Insert: Omit<UserXPLevel, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserXPLevel, 'user_id'>>;
      };
      badges: {
        Row: Badge;
        Insert: Omit<Badge, 'id' | 'created_at'>;
        Update: Partial<Omit<Badge, 'id'>>;
      };
      user_badges: {
        Row: UserBadge;
        Insert: Omit<UserBadge, 'id' | 'created_at'>;
        Update: never;
      };
      missions: {
        Row: Mission;
        Insert: Omit<Mission, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Mission, 'id'>>;
      };
      user_missions: {
        Row: UserMission;
        Insert: Omit<UserMission, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserMission, 'id'>>;
      };
      leaderboard: {
        Row: LeaderboardEntry;
        Insert: never;
        Update: never;
      };
    };
  };
}

export type UserRole =
  | 'invite'
  | 'particulier'
  | 'professionnel'
  | 'institutionnel'
  | 'moderateur'
  | 'admin';
export type EventCategory = string;
export type EventVisibility = 'public' | 'prive';
export type ScheduleMode = 'ponctuel' | 'recurrent' | 'permanent';
export type TransactionType = 'earn' | 'spend' | 'refund';
export type MissionStatus = 'active' | 'completed' | 'expired';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  cover_url?: string | null;
  bio: string | null;
  role: UserRole;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  city: string | null;
  region: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
}

export interface Event {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string | null;
  subcategory?: string | null;
  tags: string[];
  starts_at: string;
  ends_at: string;
  schedule_mode: string | null;
  recurrence_rule: string | null;
  latitude: number;
  longitude: number;
  location?:
    | {
        type: string;
        coordinates: [number, number]; // [lon, lat]
      }
    | string
    | null;
  address: string;
  city: string | null;
  postal_code: string | null;
  venue_name: string | null;
  visibility: EventVisibility;
  is_free: boolean;
  price: number | null;
  cover_url: string | null;
  max_participants: number | null;
  registration_required: boolean | null;
  external_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  operating_hours: Json | null;
  comments_count: number;
  media_count: number;
  rating_count: number;
  rating_avg: number;
  created_at: string;
  updated_at: string;
  status: string | null;
  ambiance: string | null;
}

export interface EventMedia {
  id: string;
  event_id: string;
  url: string;
  type: 'image' | 'video';
  order: number;
  created_at: string;
}

export interface EventComment {
  id: string;
  event_id: string;
  author_id: string;
  message: string;
  rating?: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventLike {
  user_id: string;
  event_id: string;
  created_at: string;
}

export interface EventInterest {
  user_id: string;
  event_id: string;
  created_at: string;
}

export interface EventCheckin {
  id: string;
  user_id: string;
  event_id: string;
  lat: number;
  lon: number;
  validated_radius: number;
  source: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  profile_id: string;
  event_id: string;
  created_at: string;
}

export interface Wallet {
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  metadata: Json | null;
  created_at: string;
}

export interface UserXPLevel {
  user_id: string;
  xp: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  requirement: Json;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  created_at: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: string;
  requirement: Json;
  reward_xp: number;
  reward_lumo: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserMission {
  id: string;
  user_id: string;
  mission_id: string;
  status: MissionStatus;
  progress: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  rank: number;
}

export interface EventWithCreator extends Event {
  creator: Profile;
  media: EventMedia[];
  likes_count: number;
  interests_count: number;
  checkins_count: number;
  is_liked?: boolean;
  is_interested?: boolean;
  is_favorited?: boolean;
}

export interface CommentWithAuthor extends EventComment {
  author: Profile;
}
