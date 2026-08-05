export type CommunityPhotoEligibilityReason = 'sign_in' | 'checkin_required' | null;

type CommunityPhotoEligibilityInput = {
  authenticated: boolean;
  checkinEnabled: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  hasCheckedIn: boolean;
};

export type CommunityPhotoEligibility = {
  allowed: boolean;
  reason: CommunityPhotoEligibilityReason;
};

export function getCommunityPhotoEligibility({
  authenticated,
  checkinEnabled,
  isOwner,
  isAdmin,
  hasCheckedIn,
}: CommunityPhotoEligibilityInput): CommunityPhotoEligibility {
  if (!authenticated) return { allowed: false, reason: 'sign_in' };

  if (checkinEnabled && !isOwner && !isAdmin && !hasCheckedIn) {
    return { allowed: false, reason: 'checkin_required' };
  }

  return { allowed: true, reason: null };
}
