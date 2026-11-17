export type ProfileEditSnapshot = {
  displayName: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  locationKey: string;
};

export type ProfileLocationSnapshot = {
  latitude: number;
  longitude: number;
  city: string;
} | null;

export function profileLocationKey(location: ProfileLocationSnapshot): string {
  if (!location) return '';
  const latitude = Number.isFinite(location.latitude) ? location.latitude.toFixed(5) : '';
  const longitude = Number.isFinite(location.longitude) ? location.longitude.toFixed(5) : '';
  return `${latitude}|${longitude}|${location.city.trim()}`;
}

export function profileEditHasUnsavedChanges(
  current: ProfileEditSnapshot,
  baseline: ProfileEditSnapshot,
): boolean {
  return (
    current.displayName !== baseline.displayName
    || current.bio !== baseline.bio
    || current.avatarUrl !== baseline.avatarUrl
    || current.coverUrl !== baseline.coverUrl
    || current.locationKey !== baseline.locationKey
  );
}
