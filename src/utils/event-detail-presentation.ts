/** First name, then the remaining friends already allowed by the social rules. */
export function formatPeerLikeLabel(names: string[]): string | null {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (!clean.length) return null;
  const first = clean[0].split(/\s+/)[0];
  if (clean.length === 1) return `Aimé par ${first}`;
  const others = clean.length - 1;
  return `Aimé par ${first} et ${others} ${others > 1 ? 'amis' : 'ami'}`;
}

/** Place and distance on one line. A missing place or distance is omitted, not invented. */
export function formatIntroPlace(place: string, distance: string | null | undefined): string {
  const clean = place.trim();
  const usable = clean && clean !== 'Lieu à venir' ? clean : '';
  const away = distance?.trim() ? `à ${distance.trim()}` : '';
  return [usable, away].filter(Boolean).join(' · ');
}

/** City and distance only. A missing city or distance is omitted. */
export function formatCityDistanceLine(
  city: string | null | undefined,
  distance: string | null | undefined,
): string {
  const clean = city?.trim() ?? '';
  const away = distance?.trim() ? `à ${distance.trim()}` : '';
  return [clean, away].filter(Boolean).join(' · ');
}

/** True when the venue is only the start of the street address, such as a house number. */
function venueRepeatsAddress(venue: string, address: string): boolean {
  if (!venue || !address) return false;
  const escaped = venue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(?=$|[\\s,\\n])`, 'i').test(address);
}

/** Venue, street and postal code for the place drawer. The city alone stays outside. */
export function formatPlaceDrawerLines(input: {
  venue?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): string[] {
  const city = input.city?.trim() ?? '';
  const venue = input.venue?.trim() ?? '';
  const address = input.address?.trim() ?? '';
  const postal = input.postalCode?.trim() ?? '';
  const same = (left: string, right: string) =>
    left.localeCompare(right, 'fr', { sensitivity: 'accent' }) === 0;
  const lines: string[] = [];
  if (venue && !same(venue, city) && !venueRepeatsAddress(venue, address)) lines.push(venue);
  if (address && !same(address, city) && !same(address, venue)) lines.push(address);
  const postalLine = [postal, city].filter(Boolean).join(' ');
  const postalAlreadyShown = lines.some((line) => postal && line.toLowerCase().includes(postal.toLowerCase()));
  if (postal && postalLine && !postalAlreadyShown) lines.push(postalLine);
  return lines;
}

/** City or address under the venue, plus distance, without repeating the venue line. */
export function formatPlaceMeta(
  place: string,
  sub: string,
  distance: string | null | undefined,
): string {
  const cleanSub = sub.trim();
  const showSub = Boolean(
    cleanSub && cleanSub !== place.trim() && cleanSub !== 'Lieu de l’événement',
  );
  const away = distance?.trim() ? `à ${distance.trim()}` : '';
  return [showSub ? cleanSub : '', away].filter(Boolean).join(' · ');
}
