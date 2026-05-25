export const OWNER_EMAIL = (
  process.env.NEXT_PUBLIC_OWNER_EMAIL ?? ""
).toLowerCase();

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === OWNER_EMAIL;
}
