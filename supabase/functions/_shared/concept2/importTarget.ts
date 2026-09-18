export type Concept2ImportMatch = { id: string; source: string | null; external_id?: string | null };

/** A near match is only a candidate; it must never consume or overwrite provider evidence. */
export function concept2ImportTarget(match: Concept2ImportMatch | null, resultId: string): string | undefined {
  return match?.source === 'concept2' && match.external_id === resultId ? match.id : undefined;
}
