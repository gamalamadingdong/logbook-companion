import { describe, expect, it, vi } from 'vitest';
import type { Dependencies } from '../../supabase/functions/concept2-development-auth/handler';
import { publishManual } from '../../supabase/functions/concept2-development-auth/publish';
import { parseResults } from '../../supabase/functions/concept2-development-auth/results';
import { bindPM5ProjectionFixture, pm5ProjectionFixtures } from '../../supabase/functions/_shared/concept2/fixtures/pm5ProjectionFixtures';

const user = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function dependencies(name: keyof typeof pm5ProjectionFixtures, status = 201) {
  const workout = bindPM5ProjectionFixture(name, crypto.randomUUID(), user);
  const projection = workout.concept2Payload;
  const publishOperation = vi.fn(async (_user: string, action: string, values: Record<string, unknown>) => {
    if (action === 'claim') return {
      dispatch: true,
      attempt_id: '11111111-2222-4333-8444-555555555555',
      access_token: 'server-token',
      payload: values.payload,
      workout_id: workout.workoutId,
    };
    return { status: values.outcome, workout_id: workout.workoutId };
  });
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (status === 422) return new Response('{}', { status: 422 });
    return new Response(JSON.stringify({ data: {
      id: 12345,
      type: body.type,
      distance: body.distance,
      time: body.time,
      date: body.date,
    } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  });
  const deps = {
    publishOperation,
    loadWorkout: async () => workout,
    loadProjection: async () => projection,
    fetch: fetchMock as typeof fetch,
  } as unknown as Dependencies;
  return { deps, workout, projection, publishOperation, fetchMock };
}

describe('PM5 Concept2 development proof contract', () => {
  it('dispatches the server-owned fixed 2k projection unchanged except publication options', async () => {
    const fixture = dependencies('pm5_fixed_2000m');
    const result = await publishManual(fixture.deps, user, {
      workout_id: fixture.workout.workoutId,
      timezone: 'America/New_York',
      weight_class: 'H',
      privacy: 'private',
      confirmed_fixture: true,
    });

    expect(result).toMatchObject({ status: 'published', result_id: 12345 });
    const request = fixture.fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.stroke_data).toHaveLength(240);
    expect(body.workout.splits).toHaveLength(4);
    expect(body.verified).toBeUndefined();
    expect(body).toMatchObject({ weight_class: 'H', privacy: 'private' });
  });

  it('dispatches canonical 8x500 intervals with resetting stroke coordinates', async () => {
    const fixture = dependencies('pm5_8x500m');
    await publishManual(fixture.deps, user, {
      workout_id: fixture.workout.workoutId,
      timezone: 'America/New_York',
      weight_class: 'H',
      privacy: 'private',
      confirmed_fixture: true,
    });
    const body = JSON.parse(String(fixture.fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.workout.intervals).toHaveLength(8);
    expect(body.stroke_data).toHaveLength(480);
    expect(body.stroke_data[0]).toMatchObject({ t: 20, d: 83 });
    expect(body.stroke_data[60]).toMatchObject({ t: 20, d: 83 });
  });

  it('records the deliberate provider rejection without retrying', async () => {
    const fixture = dependencies('pm5_invalid_stroke_data', 422);
    await expect(publishManual(fixture.deps, user, {
      workout_id: fixture.workout.workoutId,
      timezone: 'America/New_York',
      weight_class: 'H',
      privacy: 'private',
      confirmed_fixture: true,
    })).resolves.toMatchObject({ status: 'rejected' });
    expect(fixture.fetchMock).toHaveBeenCalledOnce();
    expect(fixture.publishOperation).toHaveBeenLastCalledWith(
      user,
      'finish',
      expect.objectContaining({ outcome: 'rejected' }),
    );
  });

  it('retains exact-ID split, interval, stroke, verified, and ranked detail', () => {
    const payload = pm5ProjectionFixtures.pm5_8x500m.concept2Payload;
    const parsed = parseResults({ data: [{
      id: 99,
      date: payload.date,
      type: payload.type,
      distance: payload.distance,
      time: payload.time,
      workout: payload.workout,
      stroke_data: payload.stroke_data,
      verified: false,
      ranked: false,
    }] }, 1).results[0];
    expect(parsed.workout?.intervals).toHaveLength(8);
    expect(parsed.stroke_data).toHaveLength(480);
    expect(parsed).toMatchObject({ verified: false, ranked: false });
  });
});
