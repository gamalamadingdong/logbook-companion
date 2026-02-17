import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { TeamErgComparison } from '../../services/coaching/coachingService';
import type { CoachingAthlete } from '../../services/coaching/coachingService';
import { formatSplit } from '../../utils/paceCalculator';

interface Props {
  ergData: TeamErgComparison[];
  athletes: CoachingAthlete[];
}

const ATHLETE_COLORS = [
  '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#f97316', '#14b8a6', '#a855f7',
  '#6366f1', '#0ea5e9', '#22c55e', '#eab308', '#f43f5e',
];

function getAthleteColor(index: number): string {
  return ATHLETE_COLORS[index % ATHLETE_COLORS.length];
}

interface ChartRow {
  athleteId: string;
  name: string;
  squad?: string;
  watts: number;
  weightKg: number;
  wattsPerKg: number;
  split: number;
  distance: number;
  colorIndex: number;
  [key: string]: unknown;
}

export function WattsPerKgChart({ ergData, athletes }: Props) {
  // Get unique distances
  const distances = useMemo(() => {
    const set = new Set(ergData.map(d => d.distance));
    return [...set].sort((a, b) => a - b);
  }, [ergData]);

  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const activeDistance = selectedDistance ?? distances[0];

  // Build chart data: only athletes with both weight and an erg score at this distance
  const chartData = useMemo((): ChartRow[] => {
    if (!activeDistance) return [];

    const athleteMap = new Map(athletes.map(a => [a.id, a]));
    const rows: ChartRow[] = [];

    for (const d of ergData) {
      if (d.distance !== activeDistance) continue;
      const athlete = athleteMap.get(d.athleteId);
      const weightKg = athlete?.weight_kg;
      if (!weightKg || weightKg <= 0) continue;

      rows.push({
        athleteId: d.athleteId,
        name: d.athleteName,
        squad: d.squad,
        watts: Math.round(d.bestWatts),
        weightKg,
        wattsPerKg: Math.round((d.bestWatts / weightKg) * 100) / 100,
        split: d.bestSplit,
        distance: d.distance,
        colorIndex: 0,
      });
    }

    rows.sort((a, b) => b.wattsPerKg - a.wattsPerKg);
    return rows.map((d, i) => ({ ...d, colorIndex: i }));
  }, [ergData, athletes, activeDistance]);

  // Calculate team average
  const avgWperKg = chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + d.wattsPerKg, 0) / chartData.length * 100) / 100
    : 0;

  if (ergData.length === 0) {
    return (
      <div className="text-neutral-500 text-sm">No erg scores recorded yet.</div>
    );
  }

  const athletesWithWeight = athletes.filter(a => a.weight_kg && a.weight_kg > 0).length;
  if (athletesWithWeight === 0) {
    return (
      <div className="text-neutral-500 text-sm">
        Add weight data to athletes to see watts/kg comparison. Edit athletes in the roster to add weight.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Distance selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
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
        {avgWperKg > 0 && (
          <span className="text-xs text-neutral-500">
            Team avg: <span className="text-neutral-300 font-mono">{avgWperKg} W/kg</span>
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <p className="text-neutral-500 text-sm">No athletes with both weight and scores at this distance.</p>
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
              tickFormatter={(v: number) => `${v} W/kg`}
              stroke="#666"
              tick={{ fontSize: 11 }}
              domain={[0, 'auto']}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              stroke="#666"
              tick={{ fontSize: 11 }}
            />
            {avgWperKg > 0 && (
              <ReferenceLine x={avgWperKg} stroke="#6b7280" strokeDasharray="3 3" label={{ value: 'Avg', position: 'top', fill: '#6b7280', fontSize: 10 }} />
            )}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ChartRow;
                return (
                  <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl text-xs">
                    <p className="text-white font-semibold">{d.name}</p>
                    {d.squad && <p className="text-neutral-500">{d.squad}</p>}
                    <div className="mt-1.5 space-y-0.5 text-neutral-300">
                      <div>W/kg: <span className="font-mono font-semibold text-indigo-400">{d.wattsPerKg}</span></div>
                      <div>Watts: {d.watts}W</div>
                      <div>Weight: {d.weightKg} kg</div>
                      <div>Split: {formatSplit(d.split)}/500m</div>
                      <div>Distance: {d.distance}m</div>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="wattsPerKg" radius={[0, 4, 4, 0]}>
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
