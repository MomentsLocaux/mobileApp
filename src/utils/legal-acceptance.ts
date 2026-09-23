export type LegalAcceptanceState = {
  legal_accepted_at?: string | null;
  legal_policy_version?: string | null;
};

export function shouldWriteLegalAcceptance(
  current: LegalAcceptanceState | null | undefined,
  nextVersion: string,
): boolean {
  if (!current?.legal_accepted_at) return true;
  return current.legal_policy_version !== nextVersion;
}

/** True when the user must accept (or re-accept) before using the app. */
export const needsLegalAcceptance = shouldWriteLegalAcceptance;
