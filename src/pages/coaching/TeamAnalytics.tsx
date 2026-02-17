import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import {
  getAthletes,
  getTeamErgComparison,
  getTeamTrainingZoneDistribution,
  type CoachingAthlete,
  type TeamErgComparison,
  type ZoneDistribution,
} from '../../services/coaching/coachingService';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { SquadPowerComparisonChart } from '../../components/coaching/SquadPowerComparisonChart';
import { WattsPerKgChart } from '../../components/coaching/WattsPerKgChart';
import { TrainingZoneDonut } from '../../components/coaching/TrainingZoneDonut';

export function TeamAnalytics() {
  const { teamId, isLoadingTeam, teamError } = useCoachingContext();

  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [ergComparison, setErgComparison] = useState<TeamErgComparison[]>([]);
  const [zoneDistribution, setZoneDistribution] = useState<{ zones: ZoneDistribution[]; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [squadFilter, setSquadFilter] = useState<string | 'all'>('all');

  const loadData = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    try {
      const [loadedAthletes, ergData, zoneDist] = await Promise.all([
        getAthletes(teamId),
        getTeamErgComparison(teamId).catch(() => [] as TeamErgComparison[]),
        getTeamTrainingZoneDistribution(teamId).catch(() => null),
      ]);
      setAthletes(loadedAthletes);
      setErgComparison(ergData);
      setZoneDistribution(zoneDist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!isLoadingTeam) loadData();
  }, [isLoadingTeam, loadData]);

  const squads = useMemo(
    () => [...new Set(athletes.map(a => a.squad).filter((s): s is string => !!s))].sort(),
    [athletes]
  );

  const filteredErgData = useMemo(
    () => squadFilter === 'all' ? ergComparison : ergComparison.filter(e => e.squad === squadFilter),
    [ergComparison, squadFilter]
  );

  const filteredAthletes = useMemo(
    () => squadFilter === 'all' ? athletes : athletes.filter(a => a.squad === squadFilter),
    [athletes, squadFilter]
  );

  const hasZoneData = zoneDistribution && zoneDistribution.total > 0;
  const hasErgData = ergComparison.length > 0;
  const hasAnyData = hasZoneData || hasErgData;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <CoachingNav />
      <div className="px-6 py-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-indigo-400" />
              Team Analytics
            </h1>
            <p className="text-neutral-400 mt-1">Performance data and training insights</p>
          </div>

          {/* Squad filter */}
          {squads.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Squad</span>
              <select
                value={squadFilter}
                onChange={e => setSquadFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                aria-label="Filter by squad"
              >
                <option value="all">All Squads</option>
                {squads.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        )}

        {/* Error */}
        {(error || teamError) && (
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
            {error || teamError}
            {error && (
              <button onClick={() => { setError(null); loadData(); }} className="ml-3 underline hover:text-red-300">
                Retry
              </button>
            )}
          </div>
        )}

        {/* No data */}
        {!isLoading && !error && !hasAnyData && (
          <div className="text-center py-16 text-neutral-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No analytics data yet</p>
            <p className="text-sm mt-1">Erg scores and training zone data will appear here as athletes log workouts.</p>
          </div>
        )}

        {/* Training Zone Distribution */}
        {!isLoading && hasZoneData && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-lg">
            <h3 className="text-sm font-medium text-neutral-400 mb-4">Training Zone Distribution</h3>
            <TrainingZoneDonut
              zones={zoneDistribution!.zones.flatMap(z =>
                Array.from({ length: z.count }, () => z.zone === 'Unset' ? null : z.zone)
              )}
            />
          </div>
        )}

        {/* Erg Charts */}
        {!isLoading && hasErgData && (
          <>
            {filteredErgData.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-neutral-400 mb-4">Squad Power Comparison</h3>
                  <SquadPowerComparisonChart data={filteredErgData} />
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-neutral-400 mb-4">Watts / kg Ratio</h3>
                  <WattsPerKgChart ergData={filteredErgData} athletes={filteredAthletes} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No erg data for this squad.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
