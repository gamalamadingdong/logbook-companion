import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import type { TeamErgComparison } from '../../services/coaching/coachingService';
import { formatSplit } from '../../utils/paceCalculator';

interface Props {
  data: TeamErgComparison[];
}

// Color palette for athletes  
const ATHLETE_COLORS = [
  '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#f97316', '#14b8a6', '#a855f7',
  '#6366f1', '#0ea5e9', '#22c55e', '#eab308', '#f43f5e',
];

function getAthleteColor(index: number): string {
  return ATHLETE_COLORS[index % ATHLETE_COLORS.length];
}

type YMetric = 'watts' | 'split';

export function SquadPowerComparisonChart({ data }: Props) {
  const [yMetric, setYMetric] = useState<YMetric>('watts');

  // Get unique distances
  const distances = useMemo(() => {
    const set = new Set(data.map(d => d.distance));
    return [...set].sort((a, b) => a - b);
  }, [data]);

  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);

  // Auto-select first distance if none selected
  const activeDistance = selectedDistance ?? distances[0];

  // Filter data for active distance
  const chartData = useMemo(() => {
    if (!activeDistance) return [];
    return data
      .filter(d => d.distance === activeDistance)
      .sort((a, b) => yMetric === 'watts' ? b.bestWatts - a.bestWatts : a.bestSplit - b.bestSplit)
      .map((d, i) => ({
        ...d,
        name: d.athleteName,
        value: yMetric === 'watts' ? Math.round(d.bestWatts) : d.bestSplit,
        colorIndex: i,
      }));
  }, [data, activeDistance, yMetric]);

  if (data.length === 0) {
    return (
      <div className="text-neutral-500 text-sm">No erg scores recorded yet for comparison.</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Distance selector */}
        <div className="flex gap-1 bg-neutral-800/50 rounded-lg p-0.5">
          {distances.map(dist => (
            <button
              key={dist}
              onClick={() => setSelectedDistance(dist)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeDistance === dist
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {dist}m
            </button>
          ))}
        </div>

        {/* Metric toggle */}
        <div className="flex gap-1 bg-neutral-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setYMetric('watts')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              yMetric === 'watts'
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Watts
          </button>
          <button
            onClick={() => setYMetric('split')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              yMetric === 'split'
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Split
          </button>
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <p className="text-neutral-500 text-sm">No scores at this distance.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36 + 40)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v: number) =>
                yMetric === 'watts' ? `${v}W` : formatSplit(v)
              }
              stroke="#666"
              tick={{ fontSize: 11 }}
              reversed={yMetric === 'split'}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              stroke="#666"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof chartData)[0];
                return (
                  <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl text-xs">
                    <p className="text-white font-semibold">{d.athleteName}</p>
                    {d.squad && (
                      <p className="text-neutral-500">{d.squad}</p>
                    )}
                    <div className="mt-1.5 space-y-0.5 text-neutral-300">
                      <div>Distance: {d.distance}m</div>
                      <div>Time: {formatTimeFull(d.bestTime)}</div>
                      <div>Split: {formatSplit(d.bestSplit)}/500m</div>
                      <div>Watts: {Math.round(d.bestWatts)}W</div>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.athleteId}
                  fill={getAthleteColor(i)}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function formatTimeFull(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
}
