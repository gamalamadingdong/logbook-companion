/**
 * Handoff of a workout into the Train tab.
 *
 * A suggested workout already carries RWN, so the athlete should not have to
 * retype or copy it. The notation travels in the URL, which keeps the link
 * shareable and survives a cold start or deep link into the app.
 */

export const TRAIN_RWN_PARAM = 'rwn';

/** Link that opens Train with this workout already filled in. */
export function trainWithRwnPath(rwn: string): string {
  return `/pm5?${TRAIN_RWN_PARAM}=${encodeURIComponent(rwn.trim())}`;
}

/**
 * Read handed-off notation from a query string.
 *
 * Returns null for anything missing or blank so callers can treat "no workout
 * was handed over" and "a blank one was" identically.
 */
export function readTrainRwn(search: string): string | null {
  const value = new URLSearchParams(search).get(TRAIN_RWN_PARAM);
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
