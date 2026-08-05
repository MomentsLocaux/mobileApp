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

export type ProposalPhase = 'entry' | 'wizard' | 'loading' | 'deck' | 'empty' | 'summary' | 'history';
export type ProposalDecision = 'like' | 'pass';

export type ProposalSessionDecision = {
  event: EventWithCreator;
  decision: ProposalDecision;
  decidedAt: string;
  heartCreatedBySession?: boolean;
};

export type ProposalSessionStatus = 'in_progress' | 'completed';

export type ProposalSession = {
  id: string;
  status: ProposalSessionStatus;
  preferences: ProposalPreferences;
  pool: EventWithCreator[];
  currentIndex: number;
  decisions: ProposalSessionDecision[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
