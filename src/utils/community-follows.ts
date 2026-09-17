export type FollowTab = 'followers' | 'following';

export type FollowListMemberLike = {
  user_id: string;
  display_name: string;
  city?: string | null;
};

const toFollowingSet = (followingIds: Iterable<string>): Set<string> =>
  followingIds instanceof Set ? followingIds : new Set(followingIds);

export function filterFollowListMembers<T extends FollowListMemberLike>(
  members: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return members;
  return members.filter((member) => {
    const name = (member.display_name || '').toLowerCase();
    const city = (member.city || '').toLowerCase();
    return name.includes(needle) || city.includes(needle);
  });
}

/** Followers you do not follow yet come first — the follow-back opportunity. */
export function sortFollowListMembers<T extends FollowListMemberLike>(
  members: T[],
  options: { tab: FollowTab; followingIds: Iterable<string> },
): T[] {
  const followingSet = toFollowingSet(options.followingIds);
  return [...members].sort((a, b) => {
    if (options.tab === 'followers') {
      const aFollowed = followingSet.has(a.user_id) ? 1 : 0;
      const bFollowed = followingSet.has(b.user_id) ? 1 : 0;
      if (aFollowed !== bFollowed) return aFollowed - bFollowed;
    }
    return (a.display_name || '').localeCompare(b.display_name || '', 'fr');
  });
}

export function countPendingFollowBacks(
  followers: { user_id: string }[],
  followingIds: Iterable<string>,
): number {
  const followingSet = toFollowingSet(followingIds);
  return followers.reduce((count, row) => (followingSet.has(row.user_id) ? count : count + 1), 0);
}

export function formatFollowCircleSummary(params: {
  isOwnList: boolean;
  tab: FollowTab;
  total: number;
  visible: number;
  filtered: boolean;
}): string {
  if (params.filtered) {
    if (params.visible === 0) return 'Aucun résultat';
    return params.visible === 1 ? '1 résultat' : `${params.visible} résultats`;
  }
  if (params.isOwnList) {
    if (params.tab === 'followers') {
      if (params.total === 0) return 'Personne ne vous suit encore';
      return params.total === 1
        ? '1 personne vous suit'
        : `${params.total} personnes vous suivent`;
    }
    if (params.total === 0) return 'Vous ne suivez personne encore';
    return params.total === 1
      ? 'Vous suivez 1 personne'
      : `Vous suivez ${params.total} personnes`;
  }
  if (params.tab === 'followers') {
    if (params.total === 0) return 'Aucun abonné';
    return params.total === 1 ? '1 abonné' : `${params.total} abonnés`;
  }
  if (params.total === 0) return 'Aucun abonnement';
  return params.total === 1 ? '1 abonnement' : `${params.total} abonnements`;
}

export function formatFollowCircleHint(params: {
  isOwnList: boolean;
  tab: FollowTab;
  pendingFollowBacks: number;
  total: number;
}): string | null {
  if (!params.isOwnList || params.total === 0) return null;
  if (params.tab === 'followers') {
    if (params.pendingFollowBacks <= 0) {
      return 'Vous vous suivez mutuellement — leurs likes apparaissent près de chez vous.';
    }
    return params.pendingFollowBacks === 1
      ? '1 personne vous suit — suivez-la aussi pour voir ses pépites locales.'
      : `${params.pendingFollowBacks} personnes vous suivent sans être suivies. Suivez-les aussi pour voir leurs coups de cœur.`;
  }
  return 'Leurs coups de cœur apparaissent sur la carte et les fiches près de chez vous.';
}

export function followActionLabel(params: {
  isFollowing: boolean;
  tab: FollowTab;
  isOwnList: boolean;
}): string {
  if (params.isFollowing) return 'Suivi';
  if (params.isOwnList && params.tab === 'followers') return 'Suivre aussi';
  return 'Suivre';
}

export function formatMemberLocation(
  city: string | null | undefined,
  region?: string | null,
): string {
  const label = [city?.trim(), region?.trim()].filter(Boolean).join(' · ');
  return label || 'Ville non renseignée';
}

export function formatMutualCaption(params: {
  isOwnList: boolean;
  tab: FollowTab;
  theyFollowYou: boolean;
}): string | null {
  if (!params.isOwnList) return null;
  if (params.tab === 'following' && params.theyFollowYou) return 'Vous suit aussi';
  return null;
}
