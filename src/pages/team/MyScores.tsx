import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Loader2, AlertTriangle, ArrowLeft, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { getMyErgScores } from '../../services/coaching/coachingService';
import type { CoachingErgScore } from '../../services/coaching/types';

const DISTANCE_FILTERS = [
  { value: 0, label: 'All Distances' },
  { value: 500, label: '500m' },
  { value: 1000, label: '1,000m' },
  { value: 2000, label: '2,000m' },
  { value: 5000, label: '5,000m' },
  { value: 6000, label: '6,000m' },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

function formatSplit(split: number | undefined): string {
  if (!split) return '—';
  const mins = Math.floor(split / 60);
  const secs = split % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

export function MyScores() {
  const { user } = useAuth();
  const { teamId, isLoadingTeam } = useCoachingContext();

  const [scores, setScores] = useState<CoachingErgScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distanceFilter, setDistanceFilter] = useState(0);

  useEffect(() => {
    if (!user?.id || !teamId || isLoadingTeam) return;

    getMyErgScores(user.id, teamId)
      .then(setScores)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load scores'))
      .finally(() => setIsLoading(false));
  }, [user?.id, teamId, isLoadingTeam]);

  const filtered = distanceFilter > 0
    ? scores.filter((s) => s.distance === distanceFilter)
    : scores;

  // Compute trend indicators — compare each score to the previous at same distance
  const getTrend = (score: CoachingErgScore): 'up' | 'down' | 'same' | null => {
    const sameDistance = filtered
      .filter((s) => s.distance === score.distance)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const myIndex = sameDistance.indexOf(score);
    if (myIndex < 0 || myIndex >= sameDistance.length - 1) return null;
    const prev = sameDistance[myIndex + 1];
    if (score.split_500m && prev.split_500m) {
      if (score.split_500m < prev.split_500m) return 'up'; // faster = better
      if (score.split_500m > prev.split_500m) return 'down';
      return 'same';
    }
    return null;
  };

  if (isLoading || isLoadingTeam) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/team"
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">My Erg Scores</h1>
            <p className="text-neutral-400 text-sm">Test results recorded by your coaches</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm mb-6 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-neutral-500" />
        <label htmlFor="distance-filter" className="sr-only">Filter by distance</label>
        <select
          id="distance-filter"
          value={distanceFilter}
          onChange={(e) => setDistanceFilter(Number(e.target.value))}
          className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 focus:ring-1 focus:ring-emerald-500 outline-none"
        >
          {DISTANCE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <span className="text-neutral-500 text-sm">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Scores List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-400">No erg scores recorded yet.</p>
          <p className="text-neutral-500 text-sm mt-1">
            Your coach will add your test results here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((score) => {
            const trend = getTrend(score);

            return (
              <div
                key={score.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {/* Date + Distance */}
                <div className="sm:w-40 shrink-0">
                  <div className="text-white font-medium">
                    {new Date(score.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-neutral-500 text-sm">{score.distance.toLocaleString()}m</div>
                </div>

                {/* Time + Split */}
                <div className="flex-1 flex flex-wrap items-center gap-x-6 gap-y-1">
                  <div>
                    <div className="text-xs text-neutral-500 uppercase">Time</div>
                    <div className="text-white font-mono">{formatTime(score.time_seconds)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 uppercase">Split</div>
                    <div className="text-white font-mono">{formatSplit(score.split_500m)}</div>
                  </div>
                  {score.watts && (
                    <div>
                      <div className="text-xs text-neutral-500 uppercase">Watts</div>
                      <div className="text-white font-mono">{score.watts}W</div>
                    </div>
                  )}
                  {score.stroke_rate && (
                    <div>
                      <div className="text-xs text-neutral-500 uppercase">Rate</div>
                      <div className="text-white font-mono">{score.stroke_rate} s/m</div>
                    </div>
                  )}
                  {score.heart_rate && (
                    <div>
                      <div className="text-xs text-neutral-500 uppercase">HR</div>
                      <div className="text-white font-mono">{score.heart_rate} bpm</div>
                    </div>
                  )}
                </div>

                {/* Trend */}
                <div className="sm:w-8 flex sm:justify-center">
                  {trend === 'up' && <TrendingUp className="w-5 h-5 text-emerald-400" aria-label="Faster than previous" />}
                  {trend === 'down' && <TrendingDown className="w-5 h-5 text-red-400" aria-label="Slower than previous" />}
                  {trend === 'same' && <Minus className="w-5 h-5 text-neutral-500" aria-label="Same as previous" />}
                </div>

                {/* Notes */}
                {score.notes && (
                  <div className="text-neutral-500 text-sm italic sm:max-w-xs truncate" title={score.notes}>
                    {score.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
