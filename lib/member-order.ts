type RegisteredMember = { id: string; created_at: string; member_number?: number };

export function existingMemberOrder<T extends RegisteredMember>(members: readonly T[]): T[] {
  return [...members].sort((a, b) => a.created_at.localeCompare(b.created_at)
    || (a.member_number ?? Number.MAX_SAFE_INTEGER) - (b.member_number ?? Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id)).map((member, index) => ({ ...member, member_number: index + 1 }));
}
