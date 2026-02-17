import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { CoachingErgScore } from '../../services/coaching/coachingService';
import { formatSplit, calculateWattsFromSplit } from '../../utils/paceCalculator';

// Colors for each distance
const DISTANCE_COLORS: Record<number, string> = {
  500: '#f59e0b',   // amber
  1000: '#ef4444',  // red
  2000: '#8b5cf6',  // purple
  5000: '#3b82f6',  // blue
  6000: '#06b6d4',  // cyan
  10000: '#10b981', // emerald
};

function getDistanceColor(d: number): string {
  return DISTANCE_COLORS[d] ?? '#6b7280';
}

interface Props {
  scores: CoachingErgScore[];
}

type YMetric = 'split' | 'watts';

export function ErgScoreProgressionChart({ scores }: Props) {
  const [yMetric, setYMetric] = useState<YMetric>('split');

  // Group by distance, sort chronologically
  const { distances, chartData } = useMemo(() => {
    const byDist = new Map<number, CoachingErgScore[]>();
    for (const s of scores) {
      const arr = byDist.get(s.distance) || [];
      arr.push(s);
      byDist.set(s.distance, arr);
    }

    // Only distances with ≥ 1 data point
    const dists = [...byDist.keys()].sort((a, b) => a - b);

    // Build combined chart data: each unique date gets a row, with columns per distance
    const dateMap = new Map<string, Record<string, number | string>>();

    for (const [dist, pts] of byDist.entries()) {
      const sorted = [...pts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      for (const s of sorted) {
        const dateKey = s.date; // YYYY-MM-DD
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { date: dateKey });
        }
        const row = dateMap.get(dateKey)!;

        // Compute split from time/distance if not stored
        const splitSec = s.split_500m ?? (s.time_seconds / s.distance) * 500;
        const watts = s.watts ?? calculateWattsFromSplit(splitSec);

        row[`split_${dist}`] = splitSec;
        row[`watts_${dist}`] = watts;
        row[`time_${dist}`] = s.time_seconds;
        row[`spm_${dist}`] = s.stroke_rate ?? 0;
      }
    }

    // Sort rows chronologically
    const data = [...dateMap.values()].sort(
      (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
    );

    return { distances: dists, chartData: data };
  }, [scores]);

  if (scores.length === 0) return null;

  // If only 1 data point, show a simple card instead of a chart
  if (scores.length === 1) return null;

  const formatYTick = (val: number) => {
    if (yMetric === 'split') return formatSplit(val);
    return `${Math.round(val)}W`;
  };

  const formatTooltipValue = (_val: number, dist: number, entry: Record<string, number | string>) => {
    const timeKey = `time_${dist}`;
    const splitKey = `split_${dist}`;
    const wattsKey = `watts_${dist}`;
    const spmKey = `spm_${dist}`;

    const timeSec = entry[timeKey] as number;
    const split = entry[splitKey] as number;
    const watts = entry[wattsKey] as number;
    const spm = entry[spmKey] as number;

    const parts: string[] = [];
    if (timeSec) {
      const m = Math.floor(timeSec / 60);
      const s = (timeSec % 60).toFixed(1);
      parts.push(`Time: ${m}:${s.padStart(4, '0')}`);
    }
    parts.push(`Split: ${formatSplit(split)}/500m`);
    parts.push(`Watts: ${Math.round(watts)}W`);
    if (spm) parts.push(`SPM: ${spm}`);

    return parts;
  };

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-400">Erg Score Progression</h3>
        <div className="flex gap-1 bg-neutral-800/50 rounded-lg p-0.5">
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
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => format(parseISO(d), 'MMM d')}
            stroke="#666"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={formatYTick}
            stroke="#666"
            tick={{ fontSize: 11 }}
            reversed={yMetric === 'split'} // Lower split = better = top
            domain={['auto', 'auto']}
            width={55}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl text-xs">
                  <p className="text-neutral-300 font-medium mb-2">
                    {format(parseISO(label as string), 'EEEE, MMM d, yyyy')}
                  </p>
                  {payload.map((p) => {
                    // Extract distance from dataKey (e.g. "split_2000" → 2000)
                    const match = (p.dataKey as string).match(/_(\d+)$/);
                    if (!match) return null;
                    const dist = parseInt(match[1], 10);
                    const entry = p.payload as Record<string, number | string>;
                    const lines = formatTooltipValue(p.value as number, dist, entry);
                    return (
                      <div key={p.dataKey as string} className="mb-1.5 last:mb-0">
                        <span className="font-semibold" style={{ color: p.color }}>
                          {dist}m
                        </span>
                        <div className="ml-2 text-neutral-400 space-y-0.5">
                          {lines.map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          <Legend
            formatter={(value: string) => {
              const m = value.match(/_(\d+)$/);
              return m ? `${m[1]}m` : value;
            }}
            wrapperStyle={{ fontSize: '11px' }}
          />
          {distances.map((dist) => (
            <Line
              key={dist}
              type="monotone"
              dataKey={yMetric === 'split' ? `split_${dist}` : `watts_${dist}`}
              stroke={getDistanceColor(dist)}
              strokeWidth={2}
              dot={{ r: 4, fill: getDistanceColor(dist) }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
