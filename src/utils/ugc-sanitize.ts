/** Client-side UGC limits mirrored by `20260914_p1_sec_hardening_followup.sql`. */

export const UGC_LIMITS = {
  comment: 4000,
  displayName: 120,
  bio: 2000,
  reportReason: 2000,
  bugReportUser: 4000,
  lumiaMessage: 800,
  directMessage: 2000,
} as const;

export function stripNullBytes(value: string): string {
  return value.replace(/\u0000/g, '');
}

export function sanitizeUgcText(value: string, maxLength: number): string {
  return stripNullBytes(value).trim().slice(0, maxLength);
}

export function isOversizedUgc(value: string, maxLength: number): boolean {
  return stripNullBytes(value).length > maxLength;
}
