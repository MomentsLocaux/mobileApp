export type PracticalInfoPayload = {
  isFree: boolean;
  price: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * Price and contact as stored on `events`.
 * The poster scan joins email and phone with « · » ; a single field must split again.
 */
export function practicalInfoFromDraft(
  price?: string | null,
  contact?: string | null,
): PracticalInfoPayload {
  const rawPrice = price?.trim() ?? '';
  const markedFree = rawPrice.toLowerCase().includes('gratuit');
  let amount: number | null = null;
  if (rawPrice && !markedFree) {
    const normalized = Number(rawPrice.replace(',', '.').replace(/[^0-9.-]/g, ''));
    if (!Number.isNaN(normalized)) amount = normalized;
  }

  const isFree = !rawPrice || markedFree || amount === 0;
  const parts = (contact?.trim() ?? '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);

  let contactEmail: string | null = null;
  let contactPhone: string | null = null;
  for (const part of parts) {
    const email = part.match(EMAIL_RE)?.[0];
    if (email) {
      if (!contactEmail) contactEmail = email;
      continue;
    }
    if (!contactPhone) contactPhone = part;
  }

  return {
    isFree,
    price: isFree ? null : amount,
    contactEmail,
    contactPhone,
  };
}
