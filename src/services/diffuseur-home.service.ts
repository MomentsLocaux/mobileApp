import { supabase } from '@/lib/supabase/client';

export type DiffuseurStatusCounts = {
  draft: number;
  pending: number;
  published: number;
  refused: number;
  archived: number;
};

export type DiffuseurHomeKpis = {
  views7d: number;
  interests7d: number;
  checkins7d: number;
  presenceRate: number | null;
  upcoming14d: number;
};

export type DiffuseurActionEvent = {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  updated_at: string | null;
};

export type DiffuseurHomeSnapshot = {
  statusCounts: DiffuseurStatusCounts;
  kpis: DiffuseurHomeKpis;
  actionEvents: DiffuseurActionEvent[];
};

const EMPTY: DiffuseurHomeSnapshot = {
  statusCounts: { draft: 0, pending: 0, published: 0, refused: 0, archived: 0 },
  kpis: {
    views7d: 0,
    interests7d: 0,
    checkins7d: 0,
    presenceRate: null,
    upcoming14d: 0,
  },
  actionEvents: [],
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysAheadIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Free dashboard snapshot — last 7 days engagement on creator's events.
 * DIFF-HOME / ADR_006.
 */
export class DiffuseurHomeService {
  static async getSnapshot(creatorId: string): Promise<DiffuseurHomeSnapshot> {
    if (!creatorId) return EMPTY;

    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, status, starts_at, updated_at')
      .eq('creator_id', creatorId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error || !events?.length) {
      if (error) console.warn('DiffuseurHomeService events', error.message);
      return EMPTY;
    }

    const statusCounts: DiffuseurStatusCounts = {
      draft: 0,
      pending: 0,
      published: 0,
      refused: 0,
      archived: 0,
    };

    for (const ev of events) {
      const s = (ev.status || '') as keyof DiffuseurStatusCounts;
      if (s in statusCounts) statusCounts[s] += 1;
    }

    const now = Date.now();
    const upcoming14d = events.filter((ev) => {
      if (ev.status !== 'published' || !ev.starts_at) return false;
      const t = new Date(ev.starts_at).getTime();
      return t >= now && t <= new Date(daysAheadIso(14)).getTime();
    }).length;

    const actionEvents: DiffuseurActionEvent[] = [...events]
      .sort((a, b) => {
        const rank = (s: string) => (s === 'refused' ? 0 : s === 'pending' ? 1 : 2);
        const d = rank(a.status) - rank(b.status);
        if (d !== 0) return d;
        return (
          new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        );
      })
      .slice(0, 5)
      .map((ev) => ({
        id: ev.id,
        title: ev.title || 'Sans titre',
        status: ev.status || 'draft',
        starts_at: ev.starts_at,
        updated_at: ev.updated_at,
      }));

    const eventIds = events.map((e) => e.id);
    const since = daysAgoIso(7);

    const [viewsRes, interestsRes, checkinsRes] = await Promise.all([
      supabase
        .from('event_views')
        .select('event_id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .gte('viewed_at', since),
      supabase
        .from('event_interests')
        .select('event_id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .gte('created_at', since),
      supabase
        .from('event_checkins')
        .select('event_id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .gte('created_at', since),
    ]);

    const views7d = viewsRes.count ?? 0;
    const interests7d = interestsRes.count ?? 0;
    const checkins7d = checkinsRes.count ?? 0;
    const presenceRate =
      interests7d > 0 ? Math.round((checkins7d / interests7d) * 100) : null;

    return {
      statusCounts,
      kpis: { views7d, interests7d, checkins7d, presenceRate, upcoming14d },
      actionEvents,
    };
  }
}
