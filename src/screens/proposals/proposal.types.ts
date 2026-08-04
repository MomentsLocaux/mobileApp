import type { EventWithCreator } from '@/types/database';

export type ProposalRadiusKm = 5 | 10 | 25 | 50;
export type ProposalDateWindow = 'today' | 'weekend' | '7_days' | '30_days';

export type ProposalAnchor = {
  latitude: number;
  longitude: number;
  label: string;
};

export type ProposalPreferences = {
  categoryIds: string[];
  radiusKm: ProposalRadiusKm;
  anchor: ProposalAnchor | null;
  dateWindow: ProposalDateWindow;
};

export type ProposalPhase = 'wizard' | 'loading' | 'deck' | 'empty' | 'summary';
export type ProposalDecision = 'like' | 'pass';

export type ProposalSession = {
  pool: EventWithCreator[];
  currentIndex: number;
  likedEvents: EventWithCreator[];
  passedIds: string[];
  seenIds: string[];
};

