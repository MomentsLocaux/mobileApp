export type ProfileMessagingVisibility = 'public' | 'private';

export function normalizeProfileVisibility(value: unknown): ProfileMessagingVisibility {
  return value === 'private' ? 'private' : 'public';
}

export function areFriends(viewerFollowsTarget: boolean, targetFollowsViewer: boolean): boolean {
  return viewerFollowsTarget && targetFollowsViewer;
}

export type MessagingAccessReason = 'self' | 'guest' | 'private_need_friend' | 'ok';

export function canMessageProfile(params: {
  viewerId?: string | null;
  targetId?: string | null;
  visibility?: ProfileMessagingVisibility | null;
  viewerFollowsTarget: boolean;
  targetFollowsViewer: boolean;
}): { allowed: boolean; reason: MessagingAccessReason; isFriend: boolean } {
  const viewerId = params.viewerId || null;
  const targetId = params.targetId || null;
  const isFriend = areFriends(params.viewerFollowsTarget, params.targetFollowsViewer);

  if (!viewerId) {
    return { allowed: false, reason: 'guest', isFriend: false };
  }
  if (!targetId || viewerId === targetId) {
    return { allowed: false, reason: 'self', isFriend: false };
  }

  const visibility = normalizeProfileVisibility(params.visibility);
  if (visibility === 'public') {
    return { allowed: true, reason: 'ok', isFriend };
  }
  if (isFriend) {
    return { allowed: true, reason: 'ok', isFriend: true };
  }
  return { allowed: false, reason: 'private_need_friend', isFriend: false };
}

export function messagingBlockedCopy(params: {
  firstName: string;
  viewerFollowsTarget: boolean;
}): string {
  if (params.viewerFollowsTarget) {
    return `${params.firstName} a un profil privé. Un message sera possible quand vous vous suivrez mutuellement.`;
  }
  return `${params.firstName} a un profil privé. Suivez-vous l’un l’autre pour devenir amis, puis envoyer un message.`;
}
