import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { TeamErgComparison } from '../../services/coaching/coachingService';
import { formatSplit } from '../../utils/paceCalculator';

interface Props {
  data: TeamErgComparison[];
  showResultsLink?: boolean;
}

function formatTimeFull(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
}

type YMetric = 'watts' | 'split' | 'wlb';

interface ChartRow {
  athleteId: string;
  name: string;
  squad?: string;
  team_name?: string;
  distance: number;
  bestTime: number;
  bestSplit: number;
  bestWatts: number;
  weightKg: number | null;
  wattsPerLb: number | null;
  [key: string]: unknown;
}

export function ErgComparisonChart({ data, showResultsLink = true }: Props) {
  const [yMetric, setYMetric] = useState<YMetric>('watts');

  // Unique assignment labels, ordered by most recent date first
  const assignmentLabels = useMemo(() => {
    const labelDateMap = new Map<string, string>();
    for (const d of data) {
      const existing = labelDateMap.get(d.assignmentLabel);
      if (!existing || d.date > existing) labelDateMap.set(d.assignmentLabel, d.date);
    }
    return [...labelDateMap.entries()]
      .sort((a, b) => b[1].localeCompare(a[1])) // newest first
      .map(([label]) => label);
  }, [data]);

  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const activeLabel = selectedLabel ?? assignmentLabels[0];

  // Find the assignment ID for the active label (for "View Results" link)
  const activeAssignmentId = useMemo(() => {
    if (!activeLabel) return undefined;
    return data.find((d) => d.assignmentLabel === activeLabel)?.assignmentId;
  }, [data, activeLabel]);

  const hasAnyWeight = data.some((entry) => entry.weightKg != null && entry.weightKg > 0);

  const chartData = useMemo((): ChartRow[] => {
    if (!activeLabel) return [];

    const rows: ChartRow[] = [];
    for (const d of data) {
      if (d.assignmentLabel !== activeLabel) continue;
      const weightKg = d.weightKg && d.weightKg > 0 ? d.weightKg : null;
      const weightLb = weightKg ? weightKg * 2.20462 : null;
      const wlb = weightLb ? Math.round((d.bestWatts / weightLb) * 100) / 100 : null;

      if (yMetric === 'wlb' && wlb == null) continue;

      rows.push({
        athleteId: d.athleteId,
        name: d.athleteName,
        squad: d.squad,
        team_name: d.team_name,
        distance: d.distance,
        bestTime: d.bestTime,
        bestSplit: d.bestSplit,
        bestWatts: d.bestWatts,
        weightKg,
        wattsPerLb: wlb,
      });
    }

    if (yMetric === 'split') {
      rows.sort((a, b) => a.bestSplit - b.bestSplit);
    } else {
      rows.sort((a, b) => {
        if (yMetric === 'watts') return b.bestWatts - a.bestWatts;
        return (b.wattsPerLb ?? -Infinity) - (a.wattsPerLb ?? -Infinity);
      });
    }

    return rows;
  }, [data, activeLabel, yMetric]);

  const workoutSummary = useMemo(() => {
    if (chartData.length === 0) return null;

    const fastest = [...chartData].sort((a, b) => a.bestSplit - b.bestSplit)[0] ?? null;
    const strongest = [...chartData].sort((a, b) => b.bestWatts - a.bestWatts)[0] ?? null;
    const mostEfficient = [...chartData]
      .filter((row) => row.wattsPerLb != null)
      .sort((a, b) => (b.wattsPerLb ?? -Infinity) - (a.wattsPerLb ?? -Infinity))[0] ?? null;

    return {
      distance: chartData[0]?.distance ?? null,
      athletes: chartData.length,
      fastest,
      strongest,
      mostEfficient,
    };
  }, [chartData]);

  const avgWlb = yMetric === 'wlb' && chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + (d.wattsPerLb ?? 0), 0) / chartData.length * 100) / 100
    : 0;

  if (data.length === 0) {
    return <div className="text-neutral-500 text-sm">No erg scores recorded yet.</div>;
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Assignment/workout selector + View Results link */}
        <div className="flex items-center gap-2">
          <select
            value={activeLabel ?? ''}
            onChange={(e) => setSelectedLabel(e.target.value)}
            className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none max-w-[220px] truncate dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
            aria-label="Select workout"
          >
            {assignmentLabels.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
          {showResultsLink && activeAssignmentId && (
            <Link
              to={`/team-management/assignments/${activeAssignmentId}/results`}
              className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs font-medium whitespace-nowrap transition-colors"
            >
              View Results →
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sort toggle */}
          <div className="flex gap-1 bg-neutral-100 rounded-lg p-0.5 dark:bg-neutral-800/50">
            <button
              onClick={() => setYMetric('watts')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                yMetric === 'watts'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              Sort: Watts
            </button>
            <button
              onClick={() => setYMetric('split')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                yMetric === 'split'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              Sort: Split
            </button>
            {hasAnyWeight && (
              <button
                onClick={() => setYMetric('wlb')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  yMetric === 'wlb'
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                Sort: Efficiency
              </button>
            )}
          </div>
          {yMetric === 'wlb' && avgWlb > 0 && (
            <span className="text-xs text-neutral-500">
              Avg: <span className="text-neutral-700 dark:text-neutral-300 font-mono">{avgWlb} W/lb</span>
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          {yMetric === 'wlb'
            ? 'No athletes with both weight and scores for this workout.'
            : 'No scores for this workout.'}
        </p>
      ) : (
        <div className="space-y-4">
          {workoutSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60 dark:shadow-none">
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Workout</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{workoutSummary.distance}m test set</div>
                <div className="mt-1 text-[11px] text-neutral-500">{workoutSummary.athletes} scored athletes</div>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60 dark:shadow-none">
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Fastest Split</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{workoutSummary.fastest?.name ?? '—'}</div>
                <div className="mt-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-300">{workoutSummary.fastest ? `${formatSplit(workoutSummary.fastest.bestSplit)}/500m` : '—'}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60 dark:shadow-none">
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Highest Watts</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{workoutSummary.strongest?.name ?? '—'}</div>
                <div className="mt-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-300">{workoutSummary.strongest ? `${Math.round(workoutSummary.strongest.bestWatts)}W` : '—'}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60 dark:shadow-none">
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Best Efficiency</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{workoutSummary.mostEfficient?.name ?? '—'}</div>
                <div className="mt-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-300">{workoutSummary.mostEfficient?.wattsPerLb != null ? `${workoutSummary.mostEfficient.wattsPerLb.toFixed(2)} W/lb` : '—'}</div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-200">
                  <th className="text-left py-3 px-3 w-12">#</th>
                  <th className="text-left py-3 px-3 min-w-[180px]">Athlete</th>
                  <th className="text-left py-3 px-3 min-w-[96px]">Squad</th>
                  <th className={`text-right py-3 px-3 whitespace-nowrap ${yMetric === 'split' ? 'text-neutral-900 dark:text-white' : ''}`}>Split</th>
                  <th className="text-right py-3 px-3 whitespace-nowrap">Time</th>
                  <th className={`text-right py-3 px-3 whitespace-nowrap ${yMetric === 'watts' ? 'text-neutral-900 dark:text-white' : ''}`}>Watts</th>
                  <th className={`text-right py-3 px-3 whitespace-nowrap ${yMetric === 'wlb' ? 'text-neutral-900 dark:text-white' : ''}`}>W/lb</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, index) => (
                  <tr key={row.athleteId} className="border-b border-neutral-100 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800/60 dark:text-neutral-300 dark:hover:bg-neutral-800/20">
                    <td className="py-3 px-3 align-top">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 px-2 text-xs font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="font-medium text-neutral-900 dark:text-white">{row.name}</div>
                      {row.team_name && <div className="mt-1 text-[11px] text-neutral-500">{row.team_name}</div>}
                    </td>
                    <td className="py-3 px-3 align-top text-neutral-500 dark:text-neutral-400">{row.squad ?? '—'}</td>
                    <td className="py-3 px-3 align-top text-right font-mono text-neutral-700 dark:text-neutral-200">{formatSplit(row.bestSplit)}</td>
                    <td className="py-3 px-3 align-top text-right font-mono text-neutral-600 dark:text-neutral-300">{formatTimeFull(row.bestTime)}</td>
                    <td className="py-3 px-3 align-top text-right font-mono text-neutral-600 dark:text-neutral-300">{Math.round(row.bestWatts)}W</td>
                    <td className="py-3 px-3 align-top text-right font-mono text-neutral-600 dark:text-neutral-300">{row.wattsPerLb != null ? row.wattsPerLb.toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
