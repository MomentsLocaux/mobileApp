import type { RoadtripCandidate, RoadtripWaypoint } from './roadtrip.types';

export type TimelineSection = {
  key: string;
  title: string;
  subtitle?: string;
  candidates: RoadtripCandidate[];
};

export type TimelineDay = {
  /** YYYY-MM-DD in local timezone */
  dayKey: string;
  title: string;
  sections: TimelineSection[];
};

const dayKeyOf = (iso: string): string => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dayTitle = (dayKey: string): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const sectionFor = (
  candidate: RoadtripCandidate,
  waypoints: RoadtripWaypoint[],
): { key: string; title: string; subtitle?: string } => {
  if (candidate.origin.kind === 'stop') {
    return {
      key: `stop:${candidate.origin.stopLabel}`,
      title: `À ${candidate.origin.stopLabel}`,
      subtitle: 'Pendant votre étape',
    };
  }
  const from = waypoints[candidate.origin.legIndex];
  const to = waypoints[candidate.origin.legIndex + 1];
  const fromLabel = from?.label ?? `Tronçon ${candidate.origin.legIndex + 1}`;
  const toLabel = to?.label ?? 'suite';
  return {
    key: `leg:${candidate.origin.legIndex}`,
    title: `${fromLabel} → ${toLabel}`,
    subtitle: 'Sur la route',
  };
};

/**
 * Group candidates by local day of passage, then by leg/stop section.
 * Within each section, order by passage time then score (deterministic).
 */
export function buildTimeline(params: {
  candidates: RoadtripCandidate[];
  waypoints: RoadtripWaypoint[];
}): TimelineDay[] {
  const { candidates, waypoints } = params;
  const byDay = new Map<string, Map<string, TimelineSection>>();

  const ordered = [...candidates].sort((a, b) => {
    const ta = new Date(a.passageAt).getTime();
    const tb = new Date(b.passageAt).getTime();
    if (ta !== tb) return ta - tb;
    return b.score - a.score || a.event.id.localeCompare(b.event.id);
  });

  for (const candidate of ordered) {
    const dayKey = dayKeyOf(candidate.passageAt);
    if (!byDay.has(dayKey)) byDay.set(dayKey, new Map());
    const sections = byDay.get(dayKey)!;
    const meta = sectionFor(candidate, waypoints);
    let section = sections.get(meta.key);
    if (!section) {
      section = { key: meta.key, title: meta.title, subtitle: meta.subtitle, candidates: [] };
      sections.set(meta.key, section);
    }
    section.candidates.push(candidate);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, sections]) => ({
      dayKey,
      title: dayTitle(dayKey),
      sections: [...sections.values()],
    }));
}
