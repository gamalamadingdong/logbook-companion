export type BenchmarkTier = 'developmental' | 'competitor' | 'challenger' | 'champion' | 'nationals';

export type SquadKey = 'novice' | 'freshman' | 'jv' | 'varsity';

export type SquadThresholds = {
  developmentalAbove: number;
  competitorAbove: number;
  challengerAbove: number;
  championAbove: number;
};

export type PerformanceTierRubricConfig = Partial<Record<SquadKey, Partial<SquadThresholds>>>;

function toSeconds(mmss: string): number {
  const [m, s] = mmss.split(':').map(Number);
  return m * 60 + s;
}

const DEFAULT_RUBRIC_BY_SQUAD: Record<SquadKey, SquadThresholds> = {
  // slower than 7:40 developmental, 7:40-7:20 competitor, 7:20-7:10 challenger, 7:10-7:00 champion, <=7:00 nationals
  freshman: { developmentalAbove: toSeconds('7:40'), competitorAbove: toSeconds('7:20'), challengerAbove: toSeconds('7:10'), championAbove: toSeconds('7:00') },
  // defaulting novice to freshman bands
  novice: { developmentalAbove: toSeconds('7:40'), competitorAbove: toSeconds('7:20'), challengerAbove: toSeconds('7:10'), championAbove: toSeconds('7:00') },
  // developmental to 7:20, 7:20-7:10 competitor, 7:10-7:00 challenger, 7:00-6:50 champion, <=6:50 nationals
  jv: { developmentalAbove: toSeconds('7:20'), competitorAbove: toSeconds('7:10'), challengerAbove: toSeconds('7:00'), championAbove: toSeconds('6:50') },
  // 7:10, 7:00, 6:50, 6:40, 6:20 (nationals)
  varsity: { developmentalAbove: toSeconds('7:10'), competitorAbove: toSeconds('7:00'), challengerAbove: toSeconds('6:50'), championAbove: toSeconds('6:20') },
};
export const PERFORMANCE_TIER_SQUADS: SquadKey[] = ['freshman', 'novice', 'jv', 'varsity'];

const TIER_LABELS: Record<BenchmarkTier, string> = {
  developmental: 'Developmental',
  competitor: 'Competitor',
  challenger: 'Challenger',
  champion: 'Champion',
  nationals: 'Nationals',
};

/** All benchmark tiers in ascending performance order */
export const BENCHMARK_TIERS: BenchmarkTier[] = ['developmental', 'competitor', 'challenger', 'champion', 'nationals'];

/** Unified tier sort order covering both BenchmarkTier and legacy PerformanceTier values */
export const TIER_SORT_ORDER: Record<string, number> = {
  pool: 0,
  developmental: 1,
  competitor: 2,
  challenger: 3,
  champion: 4,
  nationals: 5,
};

function normalizeSquad(rawSquad: string | null | undefined): SquadKey | null {
  if (!rawSquad) return null;
  const s = rawSquad.trim().toLowerCase();
  if (s.includes('varsity') || s === 'v' || s === '1v' || s === '2v') return 'varsity';
  if (s === 'jv' || s.includes('junior varsity')) return 'jv';
  if (s.includes('freshman') || s.includes('freshmen') || s.includes('frosh') || s === 'fr') return 'freshman';
  if (s.includes('novice')) return 'novice';
  return null;
}

export function getDefaultBenchmarkRubric(): Record<SquadKey, SquadThresholds> {
  return {
    freshman: { ...DEFAULT_RUBRIC_BY_SQUAD.freshman },
    novice: { ...DEFAULT_RUBRIC_BY_SQUAD.novice },
    jv: { ...DEFAULT_RUBRIC_BY_SQUAD.jv },
    varsity: { ...DEFAULT_RUBRIC_BY_SQUAD.varsity },
  };
}

function getSquadRubric(squadKey: SquadKey, rubricConfig?: PerformanceTierRubricConfig | null): SquadThresholds {
  const base = DEFAULT_RUBRIC_BY_SQUAD[squadKey];
  const override = rubricConfig?.[squadKey];
  if (!override) return base;
  return {
    developmentalAbove: Number.isFinite(override.developmentalAbove) ? Number(override.developmentalAbove) : base.developmentalAbove,
    competitorAbove: Number.isFinite(override.competitorAbove) ? Number(override.competitorAbove) : base.competitorAbove,
    challengerAbove: Number.isFinite(override.challengerAbove) ? Number(override.challengerAbove) : base.challengerAbove,
    championAbove: Number.isFinite(override.championAbove) ? Number(override.championAbove) : base.championAbove,
  };
}

export function deriveBenchmarkTier(
  squad: string | null | undefined,
  best2kSeconds: number | null | undefined,
  rubricConfig?: PerformanceTierRubricConfig | null
): BenchmarkTier | null {
  if (best2kSeconds == null || best2kSeconds <= 0) return null;
  const squadKey = normalizeSquad(squad);
  if (!squadKey) return null;
  const rubric = getSquadRubric(squadKey, rubricConfig);

  if (best2kSeconds > rubric.developmentalAbove) return 'developmental';
  if (best2kSeconds > rubric.competitorAbove) return 'competitor';
  if (best2kSeconds > rubric.challengerAbove) return 'challenger';
  if (best2kSeconds > rubric.championAbove) return 'champion';
  return 'nationals';
}

export function benchmarkTierLabel(tier: BenchmarkTier | null): string {
  return tier ? TIER_LABELS[tier] : '—';
}

export function benchmarkTierBadgeClass(tier: BenchmarkTier | null): string {
  if (!tier) return 'bg-neutral-800 text-neutral-300';
  const map: Record<BenchmarkTier, string> = {
    developmental: 'bg-red-900/30 text-red-300',
    competitor: 'bg-amber-900/30 text-amber-300',
    challenger: 'bg-blue-900/30 text-blue-300',
    champion: 'bg-emerald-900/30 text-emerald-300',
    nationals: 'bg-purple-900/30 text-purple-300',
  };
  return map[tier];
}

function nextTierCutoffSeconds(tier: BenchmarkTier, rubric: SquadThresholds): number | null {
  if (tier === 'developmental') return rubric.competitorAbove;
  if (tier === 'competitor') return rubric.challengerAbove;
  if (tier === 'challenger') return rubric.championAbove;
  // champion and nationals have no next tier cutoff
  return null;
}

function tierEntryThresholdSeconds(tier: BenchmarkTier, rubric: SquadThresholds): number | null {
  if (tier === 'developmental') return null; // no upper bound — anything slower than developmentalAbove
  if (tier === 'competitor') return rubric.developmentalAbove;
  if (tier === 'challenger') return rubric.competitorAbove;
  if (tier === 'champion') return rubric.challengerAbove;
  if (tier === 'nationals') return rubric.championAbove;
  return null;
}

export function benchmarkCriteriaIndicator(
  squad: string | null | undefined,
  best2kSeconds: number | null | undefined,
  tolerancePct = 0.02,
  rubricConfig?: PerformanceTierRubricConfig | null
): { text: string; className: string } | null {
  if (best2kSeconds == null || best2kSeconds <= 0) return null;
  const squadKey = normalizeSquad(squad);
  if (!squadKey) return null;
  const tier = deriveBenchmarkTier(squad, best2kSeconds, rubricConfig);
  if (!tier) return null;
  const rubric = getSquadRubric(squadKey, rubricConfig);
  const nextCutoff = nextTierCutoffSeconds(tier, rubric);
  if (nextCutoff != null && best2kSeconds > nextCutoff && best2kSeconds <= nextCutoff * (1 + tolerancePct)) {
    return { text: 'Within 2% of next tier', className: 'text-amber-400' };
  }
  return { text: 'Meets rubric criteria', className: 'text-emerald-400' };
}

export function formatErgTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function parseErgTimeInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const parts = raw.split(':');
  if (parts.length !== 2) return null;
  const mins = Number(parts[0]);
  const secs = Number(parts[1]);
  if (!Number.isInteger(mins) || !Number.isInteger(secs) || mins < 0 || secs < 0 || secs > 59) return null;
  return mins * 60 + secs;
}

export interface TierProgress {
  tier: BenchmarkTier;
  tierLabel: string;
  best2kSeconds: number;
  /** Seconds the athlete needs to drop to reach the next tier cutoff. null if already at top tier. */
  secondsToNextTier: number | null;
  /** Name of the next tier. null if already at top. */
  nextTierLabel: string | null;
  /** Seconds cleared past the entry threshold of the current tier. null for developmental (no upper bound). */
  secondsClearedInTier: number | null;
}

export function getTierProgress(
  squad: string | null | undefined,
  best2kSeconds: number | null | undefined,
  rubricConfig?: PerformanceTierRubricConfig | null
): TierProgress | null {
  if (best2kSeconds == null || best2kSeconds <= 0) return null;
  const squadKey = normalizeSquad(squad);
  if (!squadKey) return null;
  const tier = deriveBenchmarkTier(squad, best2kSeconds, rubricConfig);
  if (!tier) return null;
  const rubric = getSquadRubric(squadKey, rubricConfig);

  const nextCutoff = nextTierCutoffSeconds(tier, rubric);
  const entryThreshold = tierEntryThresholdSeconds(tier, rubric);

  const NEXT_TIER: Record<BenchmarkTier, BenchmarkTier | null> = {
    developmental: 'competitor',
    competitor: 'challenger',
    challenger: 'champion',
    champion: 'nationals',
    nationals: null,
  };
  const nextTier = NEXT_TIER[tier];

  return {
    tier,
    tierLabel: TIER_LABELS[tier],
    best2kSeconds,
    secondsToNextTier: nextCutoff != null ? Math.round(best2kSeconds - nextCutoff) : null,
    nextTierLabel: nextTier ? TIER_LABELS[nextTier] : null,
    secondsClearedInTier: entryThreshold != null ? Math.round(entryThreshold - best2kSeconds) : null,
  };
}

export type ErgScoreLike = { athlete_id: string; distance: number; time_seconds: number };

export function buildBest2kByAthlete(scores: ErgScoreLike[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const score of scores) {
    if (score.distance !== 2000 || !Number.isFinite(score.time_seconds) || score.time_seconds <= 0) continue;
    const existing = map[score.athlete_id];
    if (existing == null || score.time_seconds < existing) map[score.athlete_id] = score.time_seconds;
  }
  return map;
}
