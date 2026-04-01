import { calculateSplitFromWatts, calculateWattsFromSplit, formatSplit } from '../../utils/paceCalculator';
import type { CoachingAthlete, CoachingBoating, BoatType } from './types';
import type { TeamErgComparison } from './coachingService';

type DistanceAnchor = {
  distance: number;
  relativeTo2kWatts: number;
};

const POWER_DURATION_ANCHORS: DistanceAnchor[] = [
  { distance: 500, relativeTo2kWatts: 1.35 },
  { distance: 1000, relativeTo2kWatts: 1.175 },
  { distance: 1500, relativeTo2kWatts: 1.09 },
  { distance: 2000, relativeTo2kWatts: 1.0 },
  { distance: 5000, relativeTo2kWatts: 0.825 },
  { distance: 6000, relativeTo2kWatts: 0.775 },
  { distance: 10000, relativeTo2kWatts: 0.725 },
];

// ─── System Power Index (SPI) ───────────────────────────────────────────────
// SPI = W / (m_a + m_b)  where W = raw 2k watts, m_a = athlete lbs, m_b = boat tax lbs
// Measures net propulsive contribution to the shell as a single mechanical system.

export const BOAT_TAX_LBS: Record<BoatType, number> = {
  '8+': 45,  // 125 lb cox + 210 lb shell + oars, divided by 8
  '4+': 55,  // higher per-seat tax due to cox-to-rower ratio
  '4x': 45,  // quad without cox shares similar shell weight class
  '4-': 35,  // coxless four
  '2-': 35,  // pair — no coxswain
  '2x': 35,  // double — no coxswain
  '1x': 32,  // single — pure athlete + shell mass
};

export type SyncMatch = 'optimal' | 'stress' | 'negative';

export function calculateSPI(watts: number, weightKg: number, boatType: BoatType): number {
  const athleteLbs = weightKg * 2.20462;
  const boatTaxLbs = BOAT_TAX_LBS[boatType];
  return watts / (athleteLbs + boatTaxLbs);
}

export function classifySyncGap(athleteSplitSeconds: number, boatAverageSplitSeconds: number): { gapSeconds: number; match: SyncMatch } {
  const gapSeconds = athleteSplitSeconds - boatAverageSplitSeconds;
  const absGap = Math.abs(gapSeconds);
  if (absGap <= 4) return { gapSeconds, match: 'optimal' };
  if (absGap <= 7) return { gapSeconds, match: 'stress' };
  return { gapSeconds, match: 'negative' };
}

export function getSPILabel(spi: number): string {
  if (spi >= 1.55) return 'Engine';
  if (spi >= 1.40) return 'Contributor';
  if (spi >= 1.20) return 'Passenger';
  return 'Below threshold';
}

export interface AthleteLineupPrediction {
  athleteId: string;
  athleteName: string;
  weightKg: number | null;
  weightAdjustmentFactor: number | null;
  evidenceCount: number;
  latestEvidenceDate: string | null;
  predicted2kWatts: number | null;
  predicted2kSplitSeconds: number | null;
  adjusted2kWatts: number | null;
  scoreContribution: number | null;
  spiValue: number | null;
  spiLabel: string | null;
  syncGapSeconds: number | null;
  syncMatch: SyncMatch | null;
  warnings: string[];
}

export interface LineupScorePrediction {
  lineupId: string;
  boatName: string;
  boatType: BoatType;
  expectedRowerSeats: number;
  filledRowerSeats: number;
  modeledRowerSeats: number;
  confidenceScore: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  warnings: string[];
  assumptions: string[];
  athletes: AthleteLineupPrediction[];
  lineupScore: number | null;
  lineupScoreSeconds: number | null;
  lineupScoreFormatted: string | null;
  averageRaw2kWatts: number | null;
  averageRaw2kSeconds: number | null;
  averageRaw2kFormatted: string | null;
  averageAdjusted2kWatts: number | null;
  totalAdjusted2kWatts: number | null;
  averageWeightKg: number | null;
  totalEvidenceCount: number;
  latestEvidenceDate: string | null;
  averageSPI: number | null;
  spiRange: { min: number; max: number } | null;
  negativeMatchCount: number;
  boatAverageSplitSeconds: number | null;
}

function getExpectedRowerSeats(boatType: BoatType): number {
  if (boatType === '8+') return 8;
  if (boatType === '4+' || boatType === '4x' || boatType === '4-') return 4;
  if (boatType === '2x' || boatType === '2-') return 2;
  return 1;
}

function isRowerSeat(seat: number): boolean {
  return seat !== 0;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getDistanceRatio(distance: number): number {
  if (distance <= POWER_DURATION_ANCHORS[0].distance) {
    return POWER_DURATION_ANCHORS[0].relativeTo2kWatts;
  }

  for (let index = 0; index < POWER_DURATION_ANCHORS.length - 1; index += 1) {
    const current = POWER_DURATION_ANCHORS[index];
    const next = POWER_DURATION_ANCHORS[index + 1];

    if (distance >= current.distance && distance <= next.distance) {
      const progress = (distance - current.distance) / (next.distance - current.distance);
      return current.relativeTo2kWatts + ((next.relativeTo2kWatts - current.relativeTo2kWatts) * progress);
    }
  }

  return POWER_DURATION_ANCHORS[POWER_DURATION_ANCHORS.length - 1].relativeTo2kWatts;
}

function getDaysOld(date: string): number | null {
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function getRecencyWeight(date: string): number {
  const daysOld = getDaysOld(date);
  if (daysOld == null) return 0.65;
  if (daysOld <= 30) return 1.2;
  if (daysOld <= 90) return 1.0;
  if (daysOld <= 180) return 0.8;
  if (daysOld <= 365) return 0.6;
  return 0.4;
}

function getWeightAdjustmentFactor(weightKg: number | null): number | null {
  if (weightKg == null || weightKg <= 0) return null;
  const pounds = weightKg * 2.20462;
  return Math.pow(pounds / 270, 0.222);
}

function buildAthletePrediction(
  athleteId: string,
  athleteName: string,
  weightKg: number | null,
  evidence: TeamErgComparison[],
): AthleteLineupPrediction {
  const usableEvidence = evidence
    .filter((entry) => entry.bestWatts > 0 && entry.distance > 0)
    .slice(0, 8);
  const warnings: string[] = [];
  const weightAdjustmentFactor = getWeightAdjustmentFactor(weightKg);

  if (usableEvidence.length === 0) {
    warnings.push('No test results yet — only test workouts are used for lineup predictions.');
  }
  if (weightAdjustmentFactor == null) {
    warnings.push('Missing body weight; score falls back to raw erg power.');
  }

  const normalizedSamples = usableEvidence.map((entry) => {
    const baseWeight = getRecencyWeight(entry.date);
    return {
      value: entry.bestWatts / getDistanceRatio(entry.distance),
      weight: baseWeight,
    };
  });

  const totalWeight = normalizedSamples.reduce((sum, sample) => sum + sample.weight, 0);
  const predicted2kWatts = totalWeight > 0
    ? normalizedSamples.reduce((sum, sample) => sum + (sample.value * sample.weight), 0) / totalWeight
    : null;

  const adjusted2kWatts = predicted2kWatts != null
    ? (() => {
        const rawSplit = calculateSplitFromWatts(predicted2kWatts);
        const adjustedSplit = weightAdjustmentFactor != null
          ? rawSplit * weightAdjustmentFactor
          : rawSplit;
        return calculateWattsFromSplit(adjustedSplit);
      })()
    : null;

  const predicted2kSplitSeconds = predicted2kWatts != null
    ? calculateSplitFromWatts(predicted2kWatts)
    : null;

  return {
    athleteId,
    athleteName,
    weightKg,
    weightAdjustmentFactor,
    evidenceCount: usableEvidence.length,
    latestEvidenceDate: usableEvidence[0]?.date ?? null,
    predicted2kWatts,
    predicted2kSplitSeconds,
    adjusted2kWatts,
    scoreContribution: null,
    spiValue: null,     // computed at lineup level (needs boatType)
    spiLabel: null,
    syncGapSeconds: null, // computed at lineup level (needs boat average)
    syncMatch: null,
    warnings,
  };
}

function getConfidenceLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 0.78) return 'High';
  if (score >= 0.5) return 'Medium';
  return 'Low';
}

function formatAverage2kScore(watts: number | null): { seconds: number | null; formatted: string | null } {
  if (watts == null || watts <= 0) {
    return { seconds: null, formatted: null };
  }

  const seconds = calculateSplitFromWatts(watts) * 4;
  return {
    seconds,
    formatted: formatSplit(seconds),
  };
}

export function buildLineupPredictions(params: {
  boatings: CoachingBoating[];
  athletes: CoachingAthlete[];
  ergComparisons: TeamErgComparison[];
}): Map<string, LineupScorePrediction> {
  const athleteMap = new Map(params.athletes.map((athlete) => [athlete.id, athlete]));
  const evidenceByAthlete = new Map<string, TeamErgComparison[]>();

  // Only use test results for lineup predictions — practice/steady-state data
  // would dilute the signal with sub-maximal efforts
  const testEvidence = params.ergComparisons.filter((entry) => entry.is_test);

  for (const entry of testEvidence) {
    const current = evidenceByAthlete.get(entry.athleteId) ?? [];
    current.push(entry);
    current.sort((left, right) => right.date.localeCompare(left.date));
    evidenceByAthlete.set(entry.athleteId, current);
  }

  const result = new Map<string, LineupScorePrediction>();

  for (const boating of params.boatings) {
    const expectedRowerSeats = getExpectedRowerSeats(boating.boat_type);
    const rowerPositions = boating.positions.filter((position) => isRowerSeat(position.seat));
    const athletePredictions = rowerPositions.map((position) => {
      const athlete = athleteMap.get(position.athlete_id);
      return buildAthletePrediction(
        position.athlete_id,
        position.athlete_name || athlete?.name || 'Unknown athlete',
        athlete?.weight_kg ?? null,
        evidenceByAthlete.get(position.athlete_id) ?? [],
      );
    });

    const modeledAthletes = athletePredictions.filter((entry) => entry.predicted2kWatts != null);
    const missingEvidenceAthletes = athletePredictions.filter((entry) => entry.predicted2kWatts == null);
    const missingWeightAthletes = athletePredictions.filter((entry) => entry.weightAdjustmentFactor == null);
    const missingSeats = Math.max(0, expectedRowerSeats - rowerPositions.length);

    const totalAdjusted2kWatts = athletePredictions
      .map((entry) => entry.adjusted2kWatts)
      .filter((value): value is number => value != null && value > 0)
      .reduce((sum, value) => sum + value, 0);

    const athletesWithContribution = athletePredictions.map((entry) => ({
      ...entry,
      scoreContribution: totalAdjusted2kWatts > 0 && entry.adjusted2kWatts != null
        ? entry.adjusted2kWatts / totalAdjusted2kWatts
        : null,
    }));

    // ── Boat average raw 2k split (for sync gap) ──
    const rawSplits = athletesWithContribution
      .map((entry) => entry.predicted2kSplitSeconds)
      .filter((value): value is number => value != null && value > 0);
    const boatAverageSplitSeconds = average(rawSplits);

    // ── SPI + Sync Gap per athlete ──
    const athletesWithSPI = athletesWithContribution.map((entry) => {
      const spiValue = entry.predicted2kWatts != null && entry.weightKg != null && entry.weightKg > 0
        ? calculateSPI(entry.predicted2kWatts, entry.weightKg, boating.boat_type)
        : null;
      const syncResult = entry.predicted2kSplitSeconds != null && boatAverageSplitSeconds != null
        ? classifySyncGap(entry.predicted2kSplitSeconds, boatAverageSplitSeconds)
        : null;
      return {
        ...entry,
        spiValue,
        spiLabel: spiValue != null ? getSPILabel(spiValue) : null,
        syncGapSeconds: syncResult?.gapSeconds ?? null,
        syncMatch: syncResult?.match ?? null,
      };
    });

    // ── SPI aggregation ──
    const spiValues = athletesWithSPI
      .map((entry) => entry.spiValue)
      .filter((value): value is number => value != null);
    const averageSPI = average(spiValues);
    const spiRange = spiValues.length > 0
      ? { min: Math.min(...spiValues), max: Math.max(...spiValues) }
      : null;
    const negativeMatchCount = athletesWithSPI
      .filter((entry) => entry.syncMatch === 'negative')
      .length;

    const lineupScore = average(
      athletesWithSPI
        .map((entry) => entry.adjusted2kWatts)
        .filter((value): value is number => value != null && value > 0),
    );

    const averageRaw2kWatts = average(
      athletesWithSPI
        .map((entry) => entry.predicted2kWatts)
        .filter((value): value is number => value != null && value > 0),
    );

    const averageAdjusted2kWatts = average(
      athletesWithSPI
        .map((entry) => entry.adjusted2kWatts)
        .filter((value): value is number => value != null && value > 0),
    );

    const averageWeightKg = average(
      athletesWithSPI
        .map((entry) => entry.weightKg)
        .filter((value): value is number => value != null && value > 0),
    );
    const totalEvidenceCount = athletePredictions.reduce((sum, entry) => sum + entry.evidenceCount, 0);
    const latestEvidenceDate = athletePredictions
      .map((entry) => entry.latestEvidenceDate)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null;
    const lineupScore2k = formatAverage2kScore(lineupScore);
    const rawAverage2k = formatAverage2kScore(averageRaw2kWatts);

    const evidenceCoverage = expectedRowerSeats > 0 ? modeledAthletes.length / expectedRowerSeats : 0;
    const weightCoverage = expectedRowerSeats > 0 ? (expectedRowerSeats - missingWeightAthletes.length) / expectedRowerSeats : 0;
    const averageEvidenceCount = average(athletePredictions.map((entry) => entry.evidenceCount)) ?? 0;
    const latestDays = athletePredictions
      .map((entry) => (entry.latestEvidenceDate ? getDaysOld(entry.latestEvidenceDate) : null))
      .filter((value): value is number => value != null);
    const averageRecencyDays = average(latestDays);
    const recencyScore = averageRecencyDays == null
      ? 0
      : averageRecencyDays <= 60
        ? 1
        : averageRecencyDays <= 180
          ? 0.7
          : 0.4;

    const confidenceScore = clamp(
      (evidenceCoverage * 0.45) +
      (Math.min(averageEvidenceCount, 3) / 3 * 0.3) +
      (weightCoverage * 0.15) +
      (recencyScore * 0.1),
      0,
      1,
    );

    const warnings: string[] = [];
    if (missingSeats > 0) {
      warnings.push(`${missingSeats} rower seat${missingSeats === 1 ? '' : 's'} still empty.`);
    }
    if (missingEvidenceAthletes.length > 0) {
      warnings.push(`No test results for ${missingEvidenceAthletes.map((entry) => entry.athleteName).join(', ')}.`);
    }
    if (missingWeightAthletes.length > 0) {
      warnings.push(`Missing body weight for ${missingWeightAthletes.map((entry) => entry.athleteName).join(', ')}.`);
    }
    if (boating.boat_type.includes('+')) {
      warnings.push('Coxswain effect is not modeled yet.');
    }

    const assumptions = [
      'Only test workouts are used — practice/steady-state data is excluded to avoid diluting max-effort signal.',
      'Test results are normalized into a 2k-equivalent anchor, then weight-adjusted where body weight is known.',
      'Adjusted 2k score is the lineup-level average corrected 2k result across modeled rower seats, so it works best for comparing similar lineups.',
      'SPI (System Power Index) = Watts / (Athlete lbs + Boat Tax lbs). Measures net propulsive contribution to the shell.',
      'Sync Gap flags athletes whose raw 2k split deviates from the crew average by >7 seconds in either direction — slower athletes as potential brakes, faster athletes as mismatched to the crew.',
      'Use this as a crew-comparison heuristic, not as a literal on-water race-time prediction.',
    ];

    result.set(boating.id, {
      lineupId: boating.id,
      boatName: boating.boat_name,
      boatType: boating.boat_type,
      expectedRowerSeats,
      filledRowerSeats: rowerPositions.length,
      modeledRowerSeats: modeledAthletes.length,
      confidenceScore,
      confidenceLabel: getConfidenceLabel(confidenceScore),
      warnings,
      assumptions,
      athletes: athletesWithSPI,
      lineupScore,
      lineupScoreSeconds: lineupScore2k.seconds,
      lineupScoreFormatted: lineupScore2k.formatted,
      averageRaw2kWatts,
      averageRaw2kSeconds: rawAverage2k.seconds,
      averageRaw2kFormatted: rawAverage2k.formatted,
      averageAdjusted2kWatts,
      totalAdjusted2kWatts: totalAdjusted2kWatts > 0 ? totalAdjusted2kWatts : null,
      averageWeightKg,
      totalEvidenceCount,
      latestEvidenceDate,
      averageSPI,
      spiRange,
      negativeMatchCount,
      boatAverageSplitSeconds,
    });
  }

  return result;
}
