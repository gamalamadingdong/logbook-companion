import { PROVIDER, type Dependencies } from './handler.ts';
import { mapCompletedWorkoutToConcept2 } from '../_shared/concept2/publication.ts';

type Claim = {
  dispatch?: boolean; status?: string; result_id?: number; workout_id?: string;
  attempt_id?: string; access_token?: string;
  payload?: { type: string; date: string; timezone: string; distance: number; time: number };
};

export async function publishManual(
  deps: Dependencies, user: string, fields: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!deps.publishOperation || !deps.loadWorkout || typeof fields.workout_id !== 'string') {
    throw new Error('Development publishing is unavailable.');
  }
  const workout = await deps.loadWorkout(user, fields.workout_id);
  const payload = mapCompletedWorkoutToConcept2(workout, {
    timezone: String(fields.timezone),
    weightClass: fields.weight_class as 'H' | 'L',
    privacy: fields.privacy as 'private' | 'partners' | 'logged_in' | 'everyone',
  });
  const claim = await deps.publishOperation(user, 'claim', { ...fields, payload }) as Claim;
  if (!claim.dispatch) return {
    status: claim.status, result_id: claim.result_id, workout_id: claim.workout_id,
  };
  if (!claim.attempt_id || !claim.access_token || !claim.payload) throw new Error('Invalid claim.');
  const finish = async (outcome: string, resultId?: number, reconnectRequired = false) =>
    deps.publishOperation!(user, 'finish', {
      attempt_id: claim.attempt_id, outcome,
      ...(resultId ? { result_id: resultId } : {}),
      ...(reconnectRequired ? { reconnect_required: true } : {}),
    });
  try {
    const response = await deps.fetch(`${PROVIDER}/api/users/me/results`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${claim.access_token}`,
        Accept: 'application/vnd.c2logbook.v1+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(claim.payload),
    });
    // Duplicate means the provider has a matching result, but gives us no proven ID.
    if (response.status === 401 || response.status === 403) {
      await finish('rejected', undefined, true);
      return { status: 'rejected', workout_id: claim.workout_id };
    }
    if (response.status === 422) {
      await finish('rejected');
      return { status: 'rejected', workout_id: claim.workout_id };
    }
    if (response.status !== 201) {
      await finish('outcome_unknown');
      return { status: 'outcome_unknown', workout_id: claim.workout_id };
    }
    const parsed = await response.json();
    const result = parsed?.data ?? parsed;
    if (!Number.isSafeInteger(result?.id) || result.id <= 0 ||
        result.type !== claim.payload.type ||
        result.distance !== claim.payload.distance ||
        result.time !== claim.payload.time ||
        result.date !== claim.payload.date) {
      await finish('outcome_unknown');
      return { status: 'outcome_unknown', workout_id: claim.workout_id };
    }
    await finish('published', result.id);
    return { status: 'published', result_id: result.id, workout_id: claim.workout_id };
  } catch {
    // A request may have reached Concept2 even if the response or DB write failed.
    await finish('outcome_unknown').catch(() => undefined);
    return { status: 'outcome_unknown', workout_id: claim.workout_id };
  }
}
