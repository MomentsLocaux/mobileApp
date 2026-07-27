import { DiffuseurHomeService } from '@/services/diffuseur-home.service';
import { supabase } from '@/lib/supabase/client';
import { EventCardStatsService } from '@/services/event-card-stats.service';

export type DiffuseurAnalyticsWindow = '30d' | '90d';

export type AnalyticsDelta = {
  views: number | null;
  interests: number | null;
  checkins: number | null;
  presenceRate: number | null;
};

export type HeatmapCell = {
  /** 0=dim … 6=sam (JS getDay) */
  dow: number;
  /** morning | afternoon | evening | night */
  slot: 'morning' | 'afternoon' | 'evening' | 'night';
  count: number;
};

export type DiffuseurAnalyticsSnapshot = {
  window: DiffuseurAnalyticsWindow;
  views: number;
  interests: number;
  checkins: number;
  funnel: {
    viewsToInterests: number | null;
    interestsToCheckins: number | null;
  };
  presenceRate: number | null;
  previous: {
    views: number;
    interests: number;
    checkins: number;
    presenceRate: number | null;
  };
  delta: AnalyticsDelta;
  heatmap: HeatmapCell[];
  topByCheckins: { id: string; title: string; checkins: number; views: number }[];
  statusCounts: Awaited<ReturnType<typeof DiffuseurHomeService.getSnapshot>>['statusCounts'];
  upcoming14d: number;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function slotFromHour(hour: number): HeatmapCell['slot'] {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

async function countInRange(
  eventIds: string[],
  since: string,
  until?: string,
): Promise<{ views: number; interests: number; checkins: number }> {
  let viewsQ = supabase
    .from('event_views')
    .select('event_id', { count: 'exact', head: true })
    .in('event_id', eventIds)
    .gte('viewed_at', since);
  let interestsQ = supabase
    .from('event_interests')
    .select('event_id', { count: 'exact', head: true })
    .in('event_id', eventIds)
    .gte('created_at', since);
  let checkinsQ = supabase
    .from('event_checkins')
    .select('event_id', { count: 'exact', head: true })
    .in('event_id', eventIds)
    .gte('created_at', since);

  if (until) {
    viewsQ = viewsQ.lt('viewed_at', until);
    interestsQ = interestsQ.lt('created_at', until);
    checkinsQ = checkinsQ.lt('created_at', until);
  }

  const [viewsRes, interestsRes, checkinsRes] = await Promise.all([viewsQ, interestsQ, checkinsQ]);
  return {
    views: viewsRes.count ?? 0,
    interests: interestsRes.count ?? 0,
    checkins: checkinsRes.count ?? 0,
  };
}

/**
 * Analytics Pro — agrégats réels 30/90j + delta N vs N-1 + heatmap (DIFF-PRO).
 * Gate entitlement côté écran (isPro).
 */
export class DiffuseurAnalyticsService {
  static async getSnapshot(
    creatorId: string,
    window: DiffuseurAnalyticsWindow,
  ): Promise<DiffuseurAnalyticsSnapshot> {
    const days = window === '90d' ? 90 : 30;
    const since = daysAgoIso(days);
    const prevSince = daysAgoIso(days * 2);
    const home = await DiffuseurHomeService.getSnapshot(creatorId);

    const { data: events } = await supabase
      .from('events')
      .select('id, title, status')
      .eq('creator_id', creatorId)
      .limit(200);

    const eventIds = (events || []).map((e) => e.id);
    const emptyHeat: HeatmapCell[] = [];

    if (!eventIds.length) {
      return {
        window,
        views: 0,
        interests: 0,
        checkins: 0,
        funnel: { viewsToInterests: null, interestsToCheckins: null },
        presenceRate: null,
        previous: { views: 0, interests: 0, checkins: 0, presenceRate: null },
        delta: { views: null, interests: null, checkins: null, presenceRate: null },
        heatmap: emptyHeat,
        topByCheckins: [],
        statusCounts: home.statusCounts,
        upcoming14d: home.kpis.upcoming14d,
      };
    }

    const [current, previous, checkinsRows, stats] = await Promise.all([
      countInRange(eventIds, since),
      countInRange(eventIds, prevSince, since),
      supabase
        .from('event_checkins')
        .select('event_id, created_at')
        .in('event_id', eventIds)
        .gte('created_at', since),
      EventCardStatsService.getStatsForEvents(eventIds),
    ]);

    const views = current.views;
    const interests = current.interests;
    const checkins = current.checkins;
    const presenceRate = interests > 0 ? Math.round((checkins / interests) * 100) : null;
    const prevPresence =
      previous.interests > 0
        ? Math.round((previous.checkins / previous.interests) * 100)
        : null;

    const checkinByEvent = new Map<string, number>();
    const heatMap = new Map<string, HeatmapCell>();

    for (const row of checkinsRows.data || []) {
      checkinByEvent.set(row.event_id, (checkinByEvent.get(row.event_id) || 0) + 1);
      if (!row.created_at) continue;
      const d = new Date(row.created_at);
      const dow = d.getDay();
      const slot = slotFromHour(d.getHours());
      const key = `${dow}:${slot}`;
      const existing = heatMap.get(key);
      if (existing) existing.count += 1;
      else heatMap.set(key, { dow, slot, count: 1 });
    }

    const topByCheckins = (events || [])
      .map((ev) => ({
        id: ev.id,
        title: ev.title || 'Sans titre',
        checkins: checkinByEvent.get(ev.id) || 0,
        views: stats[ev.id]?.viewsCount || 0,
      }))
      .sort((a, b) => b.checkins - a.checkins || b.views - a.views)
      .slice(0, 5);

    return {
      window,
      views,
      interests,
      checkins,
      funnel: {
        viewsToInterests: views > 0 ? Math.round((interests / views) * 100) : null,
        interestsToCheckins: interests > 0 ? Math.round((checkins / interests) * 100) : null,
      },
      presenceRate,
      previous: {
        views: previous.views,
        interests: previous.interests,
        checkins: previous.checkins,
        presenceRate: prevPresence,
      },
      delta: {
        views: pctDelta(views, previous.views),
        interests: pctDelta(interests, previous.interests),
        checkins: pctDelta(checkins, previous.checkins),
        presenceRate:
          presenceRate == null || prevPresence == null
            ? null
            : presenceRate - prevPresence,
      },
      heatmap: [...heatMap.values()].sort((a, b) => b.count - a.count),
      topByCheckins,
      statusCounts: home.statusCounts,
      upcoming14d: home.kpis.upcoming14d,
    };
  }

  static toCsv(snap: DiffuseurAnalyticsSnapshot): string {
    const lines = [
      'metric,value,previous,delta_pct',
      `window,${snap.window},,`,
      `views,${snap.views},${snap.previous.views},${snap.delta.views ?? ''}`,
      `interests,${snap.interests},${snap.previous.interests},${snap.delta.interests ?? ''}`,
      `checkins,${snap.checkins},${snap.previous.checkins},${snap.delta.checkins ?? ''}`,
      `presence_rate,${snap.presenceRate ?? ''},${snap.previous.presenceRate ?? ''},${snap.delta.presenceRate ?? ''}`,
      `funnel_views_to_interests,${snap.funnel.viewsToInterests ?? ''},,`,
      `funnel_interests_to_checkins,${snap.funnel.interestsToCheckins ?? ''},,`,
      '',
      'event_id,title,checkins,views',
      ...snap.topByCheckins.map(
        (e) => `${e.id},"${(e.title || '').replace(/"/g, '""')}",${e.checkins},${e.views}`,
      ),
      '',
      'dow,slot,checkins',
      ...snap.heatmap.map((h) => `${h.dow},${h.slot},${h.count}`),
    ];
    return lines.join('\n');
  }
}
