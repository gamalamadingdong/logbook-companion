import { describe, expect, it } from 'vitest';
import type { CoachingAthlete, CoachingBoating } from './types';
import type { TeamErgComparison } from './coachingService';
import { buildLineupPredictions } from './lineupPredictor';

function makeAthlete(id: string, name: string, weightKg: number | null): CoachingAthlete {
  const [firstName, lastName] = name.split(' ');

  return {
    id,
    first_name: firstName,
    last_name: lastName ?? '',
    email: null,
    date_of_birth: null,
    grade: '10',
    experience_level: 'intermediate',
    side: 'both',
    height_cm: 180,
    weight_kg: weightKg,
    notes: '',
    coach_notes: null,
    coach_notes_visible_to_athlete: false,
    created_by: 'coach-1',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    name,
    squad: 'Varsity',
    performance_tier: 'challenger',
    team_id: 'team-1',
    team_name: 'Varsity',
  };
}

function makeBoating(overrides?: Partial<CoachingBoating>): CoachingBoating {
  return {
    id: 'boat-1',
    coach_user_id: 'coach-1',
    team_id: 'team-1',
    boat_id: 'shell-1',
    date: '2026-03-20',
    boat_name: 'Varsity 8+',
    boat_type: '8+',
    positions: [],
    notes: '',
    session_id: null,
    is_active: true,
    sort_order: 0,
    created_at: '2026-03-20T00:00:00Z',
    updated_at: '2026-03-20T00:00:00Z',
    ...overrides,
  };
}

function makeEvidence(params: {
  athleteId: string;
  athleteName: string;
  distance: number;
  bestTime: number;
  bestSplit: number;
  bestWatts: number;
  date?: string;
  weightKg?: number | null;
  isTest?: boolean;
}): TeamErgComparison {
  return {
    athleteId: params.athleteId,
    athleteName: params.athleteName,
    distance: params.distance,
    bestTime: params.bestTime,
    bestSplit: params.bestSplit,
    bestWatts: params.bestWatts,
    date: params.date ?? '2026-03-15',
    weightKg: params.weightKg ?? null,
    is_test: params.isTest ?? true,
    assignmentLabel: `${params.distance}m Test`,
  };
}

describe('buildLineupPredictions', () => {
  it('gives a lighter rower a faster adjusted 2k score than an equally fast heavier rower', () => {
    const athletes = [
      makeAthlete('a1', 'Light Rower', 61.2),
      makeAthlete('a2', 'Heavy Rower', 88.5),
    ];

    const lightLineup = makeBoating({
      id: 'light-1',
      boat_type: '1x',
      boat_name: 'Light Single',
      positions: [{ seat: 1, athlete_id: 'a1', athlete_name: 'Light Rower' }],
    });
    const heavyLineup = makeBoating({
      id: 'heavy-1',
      boat_type: '1x',
      boat_name: 'Heavy Single',
      positions: [{ seat: 1, athlete_id: 'a2', athlete_name: 'Heavy Rower' }],
    });

    const evidence = [
      makeEvidence({ athleteId: 'a1', athleteName: 'Light Rower', distance: 2000, bestTime: 430, bestSplit: 107.5, bestWatts: 282.7 }),
      makeEvidence({ athleteId: 'a2', athleteName: 'Heavy Rower', distance: 2000, bestTime: 430, bestSplit: 107.5, bestWatts: 282.7 }),
    ];

    const predictions = buildLineupPredictions({
      boatings: [lightLineup, heavyLineup],
      athletes,
      ergComparisons: evidence,
    });

    const light = predictions.get('light-1');
    const heavy = predictions.get('heavy-1');

    expect(light?.lineupScoreSeconds).toBeLessThan(heavy?.lineupScoreSeconds ?? 0);
  });

  it('lowers confidence and warns when seats are empty or athletes lack evidence', () => {
    const athletes = [
      makeAthlete('a1', 'Known Athlete', 75),
      makeAthlete('a2', 'Unknown Athlete', 77),
    ];
    const lineup = makeBoating({
      positions: [
        { seat: 1, athlete_id: 'a1', athlete_name: 'Known Athlete' },
        { seat: 2, athlete_id: 'a2', athlete_name: 'Unknown Athlete' },
      ],
    });

    const predictions = buildLineupPredictions({
      boatings: [lineup],
      athletes,
      ergComparisons: [
        makeEvidence({ athleteId: 'a1', athleteName: 'Known Athlete', distance: 2000, bestTime: 420, bestSplit: 105, bestWatts: 302.3 }),
      ],
    });

    const prediction = predictions.get(lineup.id);

    expect(prediction?.confidenceLabel).toBe('Low');
    expect(prediction?.warnings.some((warning) => warning.includes('No erg evidence'))).toBe(true);
    expect(prediction?.warnings.some((warning) => warning.includes('empty'))).toBe(true);
  });

  it('exposes an adjusted lineup 2k score and a raw average 2k score', () => {
    const athletes = [
      makeAthlete('a1', 'Athlete One', 75),
      makeAthlete('a2', 'Athlete Two', 80),
    ];
    const lineup = makeBoating({
      boat_type: '2-',
      positions: [
        { seat: 1, athlete_id: 'a1', athlete_name: 'Athlete One' },
        { seat: 2, athlete_id: 'a2', athlete_name: 'Athlete Two' },
      ],
    });

    const predictions = buildLineupPredictions({
      boatings: [lineup],
      athletes,
      ergComparisons: [
        makeEvidence({ athleteId: 'a1', athleteName: 'Athlete One', distance: 2000, bestTime: 420, bestSplit: 105, bestWatts: 302.3 }),
        makeEvidence({ athleteId: 'a2', athleteName: 'Athlete Two', distance: 2000, bestTime: 424, bestSplit: 106, bestWatts: 293.8 }),
      ],
    });

    const prediction = predictions.get(lineup.id);

    expect(prediction?.lineupScoreFormatted).toBeTruthy();
    expect(prediction?.averageRaw2kFormatted).toBeTruthy();
    expect(prediction?.lineupScoreSeconds).not.toBeNull();
    expect(prediction?.averageRaw2kSeconds).not.toBeNull();
  });

  it('falls back to raw erg power when body weight is missing', () => {
    const athletes = [makeAthlete('a1', 'Unknown Weight', null)];
    const lineup = makeBoating({
      boat_type: '1x',
      positions: [{ seat: 1, athlete_id: 'a1', athlete_name: 'Unknown Weight' }],
    });

    const predictions = buildLineupPredictions({
      boatings: [lineup],
      athletes,
      ergComparisons: [
        makeEvidence({ athleteId: 'a1', athleteName: 'Unknown Weight', distance: 2000, bestTime: 420, bestSplit: 105, bestWatts: 302.3 }),
      ],
    });

    const prediction = predictions.get(lineup.id);
    const athlete = prediction?.athletes[0];

    expect(athlete?.warnings.some((warning) => warning.includes('Missing body weight'))).toBe(true);
    expect(athlete?.adjusted2kWatts).toBeCloseTo(athlete?.predicted2kWatts ?? 0, 5);
  });
});
