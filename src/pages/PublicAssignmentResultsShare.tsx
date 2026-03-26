import { Fragment, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, BarChart3, TrendingUp, Users, CheckCircle2, XCircle, ArrowUpDown, ChevronRight, ChevronDown, Search } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ReferenceLine,
  LineChart,
  Line,
  Cell,
  Customized,
} from 'recharts';
import {
  resolveAssignmentResultsShare,
  type AssignmentResultRow,
  type AssignmentResultsShareData,
  type IntervalResult,
} from '../services/coaching/coachingService';
import { splitToWatts, formatSplit } from '../utils/zones';
import { parseWorkoutStructureForEntry } from '../utils/workoutEntryClassifier';
import { useMeasurementUnits } from '../hooks/useMeasurementUnits';

interface EnrichedRow extends AssignmentResultRow {
  avg_split_seconds: number | null;
  watts: number | null;
  wpkg: number | null;
  wplb: number | null;
  effective_weight_kg: number | null;
  rep_splits: (number | null)[];
  rep_best_split_seconds: number | null;
  rep_best_time_seconds: number | null;
  rep_best_distance_meters: number | null;
  rep_worst_split_seconds: number | null;
  rep_split_spread_seconds: number | null;
  best_interval_watts: number | null;
  best_interval_wplb: number | null;
  consistency_sigma: number | null;
  dnf: boolean;
  partialDnf: boolean;
  completeNoData: boolean;
}

type SortField = 'name' | 'split' | 'watts' | 'wpkg' | 'distance' | 'time' | 'stroke_rate' | 'best' | 'best_eff';
type SortDir = 'asc' | 'desc';
type HeatmapSortCol = 'name' | 'avg' | 'spread' | number;
type RatioZone = { lower: number; upper: number; fill: string };

function RatioZoneShading({
  xAxisMap,
  yAxisMap,
  minWeight,
  maxWeight,
  yMax,
  zones,
}: {
  xAxisMap?: Record<string, { scale?: (value: number) => number }>;
  yAxisMap?: Record<string, { scale?: (value: number) => number }>;
  minWeight: number;
  maxWeight: number;
  yMax: number;
  zones: RatioZone[];
}) {
  const xAxis = Object.values(xAxisMap ?? {})[0];
  const yAxis = Object.values(yAxisMap ?? {})[0];
  const xScale = xAxis?.scale;
  const yScale = yAxis?.scale;
  if (typeof xScale !== 'function' || typeof yScale !== 'function' || zones.length === 0) return null;

  return (
    <g pointerEvents="none">
      {zones.map((zone, idx) => {
        const y1Min = Math.min(yMax, zone.lower * minWeight);
        const y1Max = Math.min(yMax, zone.lower * maxWeight);
        const y2Min = Math.min(yMax, zone.upper * minWeight);
        const y2Max = Math.min(yMax, zone.upper * maxWeight);
        const points = [
          `${xScale(minWeight)},${yScale(y1Min)}`,
          `${xScale(maxWeight)},${yScale(y1Max)}`,
          `${xScale(maxWeight)},${yScale(y2Max)}`,
          `${xScale(minWeight)},${yScale(y2Min)}`,
        ].join(' ');
        return <polygon key={`ratio-zone-${idx}`} points={points} fill={zone.fill} fillOpacity={0.08} />;
      })}
    </g>
  );
}

function fmtSplit(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '—';
  return formatSplit(sec);
}

function fmtTime(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtDist(m: number | null | undefined): string {
  if (m == null || m <= 0) return '—';
  return `${Math.round(m).toLocaleString()}m`;
}

function fmtWatts(w: number | null | undefined): string {
  if (w == null || w <= 0) return '—';
  return `${Math.round(w)}W`;
}

function fmtPowerToWeight(wpkg: number | null | undefined, wplb: number | null | undefined): string {
  if (wpkg == null || wpkg <= 0 || wplb == null || wplb <= 0) return '—';
  return `${wpkg.toFixed(2)} W/kg · ${wplb.toFixed(2)} W/lb`;
}

const LIGHT_TOOLTIP_STYLE = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  color: '#0f172a',
};

function calcAvgSplit(row: AssignmentResultRow): number | null {
  if (row.result_intervals && row.result_intervals.length > 0) {
    const repsWithBoth = row.result_intervals.filter(
      (r): r is IntervalResult & { split_seconds: number; distance_meters: number } =>
        typeof r.split_seconds === 'number' && typeof r.distance_meters === 'number' && r.distance_meters > 0,
    );
    if (repsWithBoth.length > 0) {
      const totalDist = repsWithBoth.reduce((sum, r) => sum + r.distance_meters, 0);
      const weightedSum = repsWithBoth.reduce((sum, r) => sum + r.split_seconds * r.distance_meters, 0);
      return weightedSum / totalDist;
    }
    const repSplits: number[] = row.result_intervals.flatMap((r) =>
      typeof r.split_seconds === 'number' ? [r.split_seconds] : [],
    );
    if (repSplits.length > 0) {
      return repSplits.reduce((a, b) => a + b, 0) / repSplits.length;
    }
  }
  return row.result_split_seconds ?? null;
}

function calcRepSplits(row: AssignmentResultRow): (number | null)[] {
  if (!row.result_intervals || row.result_intervals.length === 0) return [];
  return row.result_intervals.map((r) => r.split_seconds ?? null);
}

function calcSigma(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return null;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  return Math.sqrt(variance);
}

function enrichRows(rows: AssignmentResultRow[]): EnrichedRow[] {
  return rows.map((row) => {
    const avg_split_seconds = calcAvgSplit(row);
    const intervals = row.result_intervals ?? [];
    const dnf = row.completed && avg_split_seconds == null && (intervals.length === 0 || intervals.every((iv) => iv.dnf === true));
    const partialDnf =
      !dnf &&
      row.completed &&
      intervals.length > 0 &&
      intervals.some((iv) => iv.dnf === true) &&
      intervals.some((iv) => iv.dnf !== true && iv.split_seconds != null);
    const completeNoData = !dnf && !partialDnf && row.completed && avg_split_seconds == null;

    const watts = avg_split_seconds ? Math.round(splitToWatts(avg_split_seconds)) : null;
    const effectiveWeightKg = row.result_weight_kg && row.result_weight_kg > 0
      ? row.result_weight_kg
      : row.weight_kg && row.weight_kg > 0
        ? row.weight_kg
        : null;
    const wpkg = watts != null && effectiveWeightKg != null ? watts / effectiveWeightKg : null;
    const wplb = wpkg != null ? wpkg / 2.20462 : null;
    const rep_splits = calcRepSplits(row);
    const consistency_sigma = calcSigma(rep_splits);
    const validRepSplits = rep_splits.filter((v): v is number => v != null);
    const rep_best_split_seconds = validRepSplits.length > 0 ? Math.min(...validRepSplits) : null;
    const rep_worst_split_seconds = validRepSplits.length > 0 ? Math.max(...validRepSplits) : null;
    const rep_split_spread_seconds =
      rep_best_split_seconds != null && rep_worst_split_seconds != null
        ? rep_worst_split_seconds - rep_best_split_seconds
        : null;
    const best_interval_watts = rep_best_split_seconds != null ? Math.round(splitToWatts(rep_best_split_seconds)) : null;
    const weightLbs = effectiveWeightKg != null ? effectiveWeightKg * 2.20462 : null;
    const best_interval_wplb = best_interval_watts != null && weightLbs != null && weightLbs > 0
      ? best_interval_watts / weightLbs
      : null;
    const completedIntervals = intervals.filter((iv) => !iv.dnf);
    const validRepTimes = completedIntervals
      .map((iv) => iv.time_seconds)
      .filter((v): v is number => v != null && v > 0);
    const rep_best_time_seconds = validRepTimes.length > 0 ? Math.min(...validRepTimes) : null;
    const validRepDistances = completedIntervals
      .map((iv) => iv.distance_meters)
      .filter((v): v is number => v != null && v > 0);
    const rep_best_distance_meters = validRepDistances.length > 0 ? Math.max(...validRepDistances) : null;

    return {
      ...row,
      avg_split_seconds,
      watts,
      wplb,
      wpkg,
      effective_weight_kg: effectiveWeightKg,
      rep_splits,
      rep_best_split_seconds,
      rep_best_time_seconds,
      rep_best_distance_meters,
      rep_worst_split_seconds,
      rep_split_spread_seconds,
      best_interval_watts,
      best_interval_wplb,
      consistency_sigma,
      dnf,
      partialDnf,
      completeNoData,
    };
  });
}

function SplitBarChart({ rows }: { rows: EnrichedRow[] }) {
  const data = [...rows]
    .filter((r) => r.completed && r.avg_split_seconds != null)
    .sort((a, b) => (a.avg_split_seconds ?? 999) - (b.avg_split_seconds ?? 999))
    .map((r, i) => ({ name: r.athlete_name.split(' ')[0], split: r.avg_split_seconds ?? 0, splitLabel: fmtSplit(r.avg_split_seconds), rank: i + 1 }));

  if (data.length === 0) return null;

  return (
    <div className="bg-neutral-800/70 rounded-xl p-4 space-y-3 border border-neutral-700/40">
      <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-indigo-400" />
        Split /500m
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 6, right: 10, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtSplit(v)} width={56} />
          <Tooltip
            contentStyle={LIGHT_TOOLTIP_STYLE}
            formatter={(v: number | undefined) => [fmtSplit(v ?? 0), 'Split']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.rank ? `#${payload[0].payload.rank}` : ''}
          />
          <Bar dataKey="split" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill="#6366f1" />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WattsBarChart({ rows }: { rows: EnrichedRow[] }) {
  const data = [...rows]
    .filter((r) => r.completed && r.watts != null)
    .sort((a, b) => (b.watts ?? 0) - (a.watts ?? 0))
    .map((r) => ({ name: r.athlete_name.split(' ')[0], watts: r.watts ?? 0 }));

  if (data.length === 0) return null;

  return (
    <div className="bg-neutral-800/70 rounded-xl p-4 space-y-3 border border-neutral-700/40">
      <h3 className="text-sm font-semibold text-neutral-200">Watts</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 6, right: 10, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={46} />
          <Tooltip contentStyle={LIGHT_TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmtWatts(v), 'Watts']} />
          <Bar dataKey="watts" radius={[4, 4, 0, 0]} fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WpkgBarChart({ rows, isImperial }: { rows: EnrichedRow[]; isImperial: boolean }) {
  const data = [...rows]
    .filter((r) => r.completed && (isImperial ? r.wplb : r.wpkg) != null)
    .sort((a, b) => ((isImperial ? b.wplb : b.wpkg) ?? 0) - ((isImperial ? a.wplb : a.wpkg) ?? 0))
    .map((r) => ({ name: r.athlete_name.split(' ')[0], ratio: Number(((isImperial ? r.wplb : r.wpkg) ?? 0).toFixed(2)) }));

  if (data.length === 0) return null;

  return (
    <div className="bg-neutral-800/70 rounded-xl p-4 space-y-3 border border-neutral-700/40">
      <h3 className="text-sm font-semibold text-neutral-200">Power to Weight</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 6, right: 10, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={46} />
          <Tooltip
            contentStyle={LIGHT_TOOLTIP_STYLE}
            formatter={(v: number | undefined) => [v != null ? `${v.toFixed(2)} ${isImperial ? 'W/lb' : 'W/kg'}` : '—', isImperial ? 'W/lb' : 'W/kg']}
          />
          <Bar dataKey="ratio" radius={[4, 4, 0, 0]} fill="#22c55e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PercentileDotPlot({ rows, isImperial }: { rows: EnrichedRow[]; isImperial: boolean }) {
  const completed = rows.filter((r) => r.completed && r.avg_split_seconds != null && !r.dnf && !r.partialDnf);
  const weighted = completed.filter((r) => r.watts != null && r.effective_weight_kg != null);
  if (weighted.length < 3) return null;

  const missingWeightCount = completed.length - weighted.length;
  const teamPalette = [
    { fill: '#60a5fa', dotClass: 'bg-blue-400' },
    { fill: '#10b981', dotClass: 'bg-emerald-500' },
    { fill: '#f59e0b', dotClass: 'bg-amber-500' },
    { fill: '#f43f5e', dotClass: 'bg-rose-500' },
    { fill: '#a78bfa', dotClass: 'bg-violet-400' },
    { fill: '#22d3ee', dotClass: 'bg-cyan-400' },
    { fill: '#fb7185', dotClass: 'bg-pink-400' },
    { fill: '#84cc16', dotClass: 'bg-lime-500' },
  ];

  const teamNames = Array.from(
    new Set(weighted.map((r) => (r.team_name ?? '').trim() || 'No Team')),
  ).sort((a, b) => a.localeCompare(b));

  const teamColor = new Map<string, { fill: string; dotClass: string }>(
    teamNames.map((team, i) => [team, teamPalette[i % teamPalette.length]]),
  );

  const minWeight = Math.min(...weighted.map((r) => isImperial ? r.effective_weight_kg! * 2.20462 : r.effective_weight_kg!));
  const maxWeight = Math.max(...weighted.map((r) => isImperial ? r.effective_weight_kg! * 2.20462 : r.effective_weight_kg!));

  const sortedRatio = weighted
    .map((r) => isImperial ? r.wplb : r.wpkg)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  const quantile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    const idx = Math.floor((sorted.length - 1) * p);
    return sorted[idx] ?? 0;
  };

  const ratioBenchmarks = [
    { label: 'P25', ratio: quantile(sortedRatio, 0.25), color: '#64748b', dotClass: 'bg-slate-500' },
    { label: 'P50', ratio: quantile(sortedRatio, 0.5), color: '#94a3b8', dotClass: 'bg-slate-400' },
    { label: 'P75', ratio: quantile(sortedRatio, 0.75), color: '#cbd5e1', dotClass: 'bg-slate-300' },
  ].filter((b) => b.ratio > 0);

  const maxRatio = Math.max(...ratioBenchmarks.map((b) => b.ratio), 0);
  const maxWatts = Math.max(...weighted.map((r) => r.watts ?? 0), 0);
  const yMax = Math.max(maxWatts * 1.1, maxWeight * maxRatio * 1.08, 100);
  const ratioEdges = [0, ...ratioBenchmarks.map((b) => b.ratio), (ratioBenchmarks[ratioBenchmarks.length - 1]?.ratio ?? 0) * 1.2]
    .filter((v, i, arr) => Number.isFinite(v) && (i === 0 || v > arr[i - 1]));
  const zoneFills = ['#0f172a', '#1e3a8a', '#0f766e', '#78350f'];
  const ratioZones = ratioEdges.slice(0, -1).map((lower, idx) => ({
    lower,
    upper: ratioEdges[idx + 1] ?? lower,
    fill: zoneFills[idx % zoneFills.length],
  }));

  const data = weighted
    .map((r) => {
      const watts = r.watts!;
      const weightValue = isImperial ? r.effective_weight_kg! * 2.20462 : r.effective_weight_kg!;
      const team = (r.team_name ?? '').trim() || 'No Team';
      return {
        name: r.athlete_name.split(' ')[0],
        fullName: r.athlete_name,
        team,
        watts,
        weightValue,
        split: r.avg_split_seconds,
        wpkg: r.wpkg,
        wplb: r.wplb,
        color: teamColor.get(team)?.fill ?? '#60a5fa',
      };
    })
    .sort((a, b) => b.watts - a.watts);

  return (
    <div className="bg-neutral-800/70 rounded-xl p-4 space-y-3 border border-neutral-700/40">
      <h3 className="text-sm font-semibold text-neutral-200">Power vs Body Weight</h3>
      <p className="text-xs text-neutral-500">X = body weight ({isImperial ? 'lb' : 'kg'}), Y = power (watts). Diagonal lines are {isImperial ? 'W/lb' : 'W/kg'} percentile benchmarks.</p>
      {teamNames.length > 1 && (
        <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500">
          {teamNames.map((team) => (
            <span key={team} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-600/60 px-2 py-0.5">
              <span className={`h-2 w-2 rounded-full ${teamColor.get(team)?.dotClass ?? 'bg-blue-400'}`} />
              {team}
            </span>
          ))}
        </div>
      )}
      {ratioBenchmarks.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500">
          {ratioBenchmarks.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-600/60 px-2 py-0.5">
              <span className={`h-2 w-2 rounded-full ${b.dotClass}`} />
              {b.label}: {b.ratio.toFixed(2)} {isImperial ? 'W/lb' : 'W/kg'}
            </span>
          ))}
        </div>
      )}
      {missingWeightCount > 0 && (
        <p className="text-[11px] text-neutral-500">{missingWeightCount} athlete{missingWeightCount > 1 ? 's' : ''} excluded (missing weight).</p>
      )}
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 20)}>
        <ScatterChart margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="weightValue"
            reversed
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: `Body Weight (${isImperial ? 'lb' : 'kg'}, lighter →)`, position: 'insideBottom', offset: -6, fill: '#64748b', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="watts"
            domain={[0, yMax]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={40}
            label={{ value: 'Power (W)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11, dx: -4 }}
          />
          <Customized component={<RatioZoneShading minWeight={minWeight} maxWeight={maxWeight} yMax={yMax} zones={ratioZones} />} />
          {ratioBenchmarks.map((b) => (
            <ReferenceLine
              key={b.label}
              segment={[
                { x: minWeight, y: minWeight * b.ratio },
                { x: maxWeight, y: maxWeight * b.ratio },
              ]}
              stroke={b.color}
              strokeDasharray="6 4"
              strokeOpacity={0.75}
              label={{ value: `${b.label} ${b.ratio.toFixed(2)} ${isImperial ? 'W/lb' : 'W/kg'}`, fill: b.color, fontSize: 10 }}
            />
          ))}
          <Tooltip
            contentStyle={LIGHT_TOOLTIP_STYLE}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const point = payload[0].payload as {
                fullName: string;
                team: string;
                watts: number;
                weightValue: number;
                split: number | null;
                wpkg: number | null;
                wplb: number | null;
              };
              return (
                <div className="p-2 text-xs text-slate-800">
                  <div className="font-semibold">{point.fullName}</div>
                  <div>Team: {point.team}</div>
                  <div>Weight: {point.weightValue.toFixed(1)} {isImperial ? 'lb' : 'kg'}</div>
                  <div>Power: {fmtWatts(point.watts)}</div>
                  <div>Split: {fmtSplit(point.split)}</div>
                  <div>Power-to-weight: {fmtPowerToWeight(point.wpkg, point.wplb)}</div>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="#60a5fa">
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} r={6} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function RepProgressionChart({ rows, repLabels }: { rows: EnrichedRow[]; repLabels: string[] }) {
  const withReps = rows.filter((r) => r.completed && r.rep_splits.some((v) => v != null));
  if (withReps.length === 0 || repLabels.length === 0) return null;

  const chartData = repLabels.map((label, repIdx) => {
    const point: Record<string, string | number> = { rep: label };
    for (const row of withReps) {
      const splitVal = row.rep_splits[repIdx];
      if (splitVal != null) point[row.athlete_name] = splitVal;
    }
    return point;
  });

  const palette = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#34d399', '#fb923c'];

  return (
    <div className="bg-neutral-800/70 rounded-xl p-4 space-y-3 border border-neutral-700/40">
      <h3 className="text-sm font-semibold text-neutral-200">Rep Progression</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="rep" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis reversed tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtSplit(v)} width={52} />
          <Tooltip
            contentStyle={LIGHT_TOOLTIP_STYLE}
            formatter={(v: number | undefined, name: string | undefined) => [fmtSplit(v ?? 0), name ?? '']}
            labelFormatter={(label) => `Rep ${label}`}
          />
          {withReps.map((row, i) => (
            <Line
              key={row.athlete_id}
              type="monotone"
              dataKey={row.athlete_name}
              stroke={palette[i % palette.length]}
              strokeWidth={1.8}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RepHeatmap({ rows, repLabels, isImperial }: { rows: EnrichedRow[]; repLabels: string[]; isImperial: boolean }) {
  const [sortCol, setSortCol] = useState<HeatmapSortCol>('avg');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [metric, setMetric] = useState<'split' | 'wpkg'>('split');

  const toggleSort = (col: HeatmapSortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const heatmapSortIcon = (col: HeatmapSortCol) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 inline-block ml-0.5 text-neutral-600" />;
    return sortDir === 'asc'
      ? <span className="inline-block ml-0.5 text-indigo-400 text-[10px]">▲</span>
      : <span className="inline-block ml-0.5 text-indigo-400 text-[10px]">▼</span>;
  };

  const withReps = rows.filter((r) => r.completed && r.rep_splits.some((v) => v != null));
  if (withReps.length === 0 || repLabels.length === 0) return null;

  const repWpkgByAthlete = new Map<string, (number | null)[]>(
    withReps.map((row) => {
      const vals = row.rep_splits.map((split) => {
        if (split == null || split <= 0 || row.effective_weight_kg == null || row.effective_weight_kg <= 0) return null;
        const repWatts = splitToWatts(split);
        if (!Number.isFinite(repWatts) || repWatts <= 0) return null;
        return isImperial ? repWatts / (row.effective_weight_kg * 2.20462) : repWatts / row.effective_weight_kg;
      });
      return [row.athlete_id, vals];
    }),
  );

  const repMedians = repLabels.map((_, repIdx) => {
    const vals = withReps
      .map((r) => metric === 'split' ? r.rep_splits[repIdx] : repWpkgByAthlete.get(r.athlete_id)?.[repIdx] ?? null)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (vals.length === 0) return null;
    return vals[Math.floor(vals.length / 2)];
  });

  const cellColor = (value: number | null, median: number | null): string => {
    if (value == null || median == null || median <= 0) return 'bg-neutral-700/30';
    if (metric === 'split') {
      const pct = (value - median) / median;
      if (pct < -0.03) return 'bg-emerald-500/70';
      if (pct < -0.01) return 'bg-emerald-500/40';
      if (pct < 0.01) return 'bg-neutral-600/50';
      if (pct < 0.03) return 'bg-amber-500/40';
      return 'bg-red-500/60';
    }
    const pct = (value - median) / median;
    if (pct > 0.03) return 'bg-emerald-500/70';
    if (pct > 0.01) return 'bg-emerald-500/40';
    if (pct > -0.01) return 'bg-neutral-600/50';
    if (pct > -0.03) return 'bg-amber-500/40';
    return 'bg-red-500/60';
  };

  const cellText = (value: number | null): string => {
    if (metric === 'split') return fmtSplit(value);
    if (value == null || value <= 0) return '—';
    return value.toFixed(2);
  };

  const sortValue = (row: EnrichedRow): number | string | null => {
    if (sortCol === 'name') return row.athlete_name;
    if (sortCol === 'avg') {
      if (metric === 'split') return row.avg_split_seconds ?? null;
      const ratio = isImperial ? row.wplb : row.wpkg;
      if (ratio != null) return -ratio;
      return null;
    }
    if (sortCol === 'spread') return row.rep_split_spread_seconds ?? null;
    if (metric === 'split') return row.rep_splits[sortCol] ?? null;
    const ratio = repWpkgByAthlete.get(row.athlete_id)?.[sortCol] ?? null;
    return ratio != null ? -ratio : null;
  };

  const compareFn = (a: EnrichedRow, b: EnrichedRow): number => {
    const va = sortValue(a);
    const vb = sortValue(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = typeof va === 'string' && typeof vb === 'string'
      ? va.localeCompare(vb)
      : (va as number) - (vb as number);
    return sortDir === 'asc' ? cmp : -cmp;
  };

  const sorted = [
    ...withReps.filter((r) => !r.dnf && !r.partialDnf).sort(compareFn),
    ...withReps.filter((r) => r.partialDnf).sort(compareFn),
    ...withReps.filter((r) => r.dnf).sort(compareFn),
  ];
  const firstPartialIdx = sorted.findIndex((r) => r.partialDnf);
  const firstDnfIdx = sorted.findIndex((r) => r.dnf);

  return (
    <div className="bg-neutral-800/70 rounded-xl p-4 space-y-3 border border-neutral-700/40">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-200">Rep Heatmap</h3>
        <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden text-[10px]">
          <button
            type="button"
            onClick={() => setMetric('split')}
            className={`px-2 py-1 ${metric === 'split' ? 'bg-indigo-600/30 text-indigo-300' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'}`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setMetric('wpkg')}
            className={`px-2 py-1 border-l border-neutral-700 ${metric === 'wpkg' ? 'bg-indigo-600/30 text-indigo-300' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'}`}
          >
            {isImperial ? 'W/lb' : 'W/kg'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 bg-neutral-900/90 text-left px-3 py-2 text-neutral-400 cursor-pointer"
                onClick={() => toggleSort('name')}
              >
                Athlete {heatmapSortIcon('name')}
              </th>
              {repLabels.map((label, i) => (
                <th
                  key={i}
                  className="px-2 py-2 text-center text-neutral-400 min-w-[62px] cursor-pointer"
                  onClick={() => toggleSort(i)}
                >
                  {label} {heatmapSortIcon(i)}
                </th>
              ))}
              <th
                className="px-2 py-2 text-center text-neutral-400 cursor-pointer"
                onClick={() => toggleSort('spread')}
              >
                Spread {heatmapSortIcon('spread')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, rowIdx) => (
              <Fragment key={row.athlete_id}>
                {rowIdx === firstPartialIdx && firstPartialIdx > 0 && (
                  <tr>
                    <td colSpan={99} className="px-3 py-1 text-[10px] font-semibold text-amber-400 uppercase tracking-widest bg-amber-900/10 border-t border-amber-900/40">
                      Partial completion
                    </td>
                  </tr>
                )}
                {rowIdx === firstDnfIdx && firstDnfIdx > 0 && (
                  <tr>
                    <td colSpan={99} className="px-3 py-1 text-[10px] font-semibold text-red-400 uppercase tracking-widest bg-red-900/10 border-t border-red-900/40">
                      DNF
                    </td>
                  </tr>
                )}
                <tr className={row.dnf ? 'opacity-60' : row.partialDnf ? 'opacity-80' : ''}>
                  <td className="sticky left-0 bg-neutral-900/90 px-3 py-1.5 text-neutral-200 border-t border-neutral-800/30 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex min-w-5 justify-center text-[10px] font-semibold text-neutral-500">{rowIdx + 1}</span>
                      <span>{row.athlete_name}</span>
                    </div>
                    {metric === 'wpkg' && (
                      <div className="text-[10px] text-neutral-500">{fmtPowerToWeight(row.wpkg, row.wplb)}</div>
                    )}
                  </td>
                {repLabels.map((_, idx) => {
                  const value = metric === 'split'
                    ? row.rep_splits[idx] ?? null
                    : repWpkgByAthlete.get(row.athlete_id)?.[idx] ?? null;
                  return (
                    <td key={idx} className={`px-2 py-1.5 text-center border-t border-neutral-800/30 font-mono ${cellColor(value, repMedians[idx])}`}>
                      {cellText(value)}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center border-t border-neutral-800/30 text-neutral-400 font-mono">
                  {row.rep_split_spread_seconds != null ? fmtSplit(row.rep_split_spread_seconds) : '—'}
                </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortIcon({ field, sortField }: { field: SortField; sortField?: SortField }) {
  return (
    <ArrowUpDown
      className={`w-3 h-3 inline-block ml-1 ${sortField === field ? 'text-indigo-400' : 'text-neutral-600'}`}
    />
  );
}

function SortTh({
  label,
  field,
  sortField,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  onSort: (f: SortField) => void;
}) {
  return (
    <th
      className="px-3 py-2 text-xs font-medium text-neutral-400 uppercase text-right cursor-pointer hover:text-neutral-200 transition-colors whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      {label}
      <SortIcon field={field} sortField={sortField} />
    </th>
  );
}

function PublicSummaryTable({ rows, isInterval, shapeType }: { rows: EnrichedRow[]; isInterval: boolean; shapeType?: string }) {
  const bestRepLabel = shapeType === 'distance_interval' ? 'Best Time'
    : shapeType === 'time_interval' ? 'Best Dist'
    : 'Best Rep';
  const fmtBestRep = (r: EnrichedRow): string =>
    shapeType === 'distance_interval'
      ? fmtTime(r.rep_best_time_seconds)
      : shapeType === 'time_interval'
        ? fmtDist(r.rep_best_distance_meters)
        : fmtSplit(r.rep_best_split_seconds);

  const [sortField, setSortField] = useState<SortField>('split');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'finishers' | 'partial' | 'dnf' | 'no-data' | 'not-completed'>('all');
  const [showNotCompleted, setShowNotCompleted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const teamOptions = useMemo(() => {
    const options = rows
      .map((r) => r.team_name?.trim())
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const hasTeamFilter = teamOptions.length > 1;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const filteredRows = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (teamFilter !== 'all' && (row.team_name ?? '').trim() !== teamFilter) return false;
      const matchesStatus = (() => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'finishers') return row.completed && !row.dnf && !row.partialDnf && !row.completeNoData;
        if (statusFilter === 'partial') return row.partialDnf;
        if (statusFilter === 'dnf') return row.dnf;
        if (statusFilter === 'no-data') return row.completeNoData;
        return !row.completed;
      })();
      if (!matchesStatus) return false;
      if (!needle) return true;
      const haystack = `${row.athlete_name} ${row.team_name ?? ''} ${row.squad ?? ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, searchTerm, statusFilter, teamFilter]);

  const sorted = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;

      if (a.completeNoData && !b.completeNoData && !b.dnf) return 1;
      if (!a.completeNoData && b.completeNoData && !a.dnf) return -1;

      if (a.partialDnf && !b.partialDnf && !b.completeNoData && !b.dnf) return 1;
      if (!a.partialDnf && b.partialDnf && !a.completeNoData && !a.dnf) return -1;

      if (!a.completed && b.completed) return 1;
      if (a.completed && !b.completed) return -1;

      let av: number | string | null = null;
      let bv: number | string | null = null;
      switch (sortField) {
        case 'name': av = a.athlete_name; bv = b.athlete_name; break;
        case 'split': av = a.avg_split_seconds; bv = b.avg_split_seconds; break;
        case 'watts': av = a.watts; bv = b.watts; break;
        case 'wpkg': av = a.wpkg; bv = b.wpkg; break;
        case 'distance': av = a.result_distance_meters ?? null; bv = b.result_distance_meters ?? null; break;
        case 'time': av = a.result_time_seconds ?? null; bv = b.result_time_seconds ?? null; break;
        case 'stroke_rate': av = a.result_stroke_rate ?? null; bv = b.result_stroke_rate ?? null; break;
        case 'best': av = a.rep_best_split_seconds; bv = b.rep_best_split_seconds; break;
        case 'best_eff': av = a.best_interval_wplb; bv = b.best_interval_wplb; break;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortField, sortDir]);

  const completedRows = useMemo(() => sorted.filter((r) => r.completed), [sorted]);
  const notCompletedRows = useMemo(() => sorted.filter((r) => !r.completed), [sorted]);
  const visibleRows = useMemo(
    () => (showNotCompleted ? [...completedRows, ...notCompletedRows] : completedRows),
    [showNotCompleted, completedRows, notCompletedRows],
  );

  const firstPartialDnfIdx = visibleRows.findIndex((r) => r.partialDnf);
  const firstCompleteNoDataIdx = visibleRows.findIndex((r) => r.completeNoData);
  const firstFullDnfIdx = visibleRows.findIndex((r) => r.dnf);
  const firstNotCompletedIdx = visibleRows.findIndex((r) => !r.completed);

  const hasWpkg = visibleRows.some((r) => r.wpkg != null);

  return (
    <div className="bg-neutral-800/50 rounded-xl overflow-hidden border border-neutral-700/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" /> Results Summary
        </h3>
        <button
          onClick={() => setIsCollapsed((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-700/40 text-neutral-300 hover:bg-neutral-700/60 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {isCollapsed ? null : (
      <>

      <div className="px-4 py-3 border-b border-neutral-800/60 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search athlete"
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-neutral-900 border border-neutral-700 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasTeamFilter && (
            <select
              title="Filter by team"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="text-xs rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 px-2 py-1.5"
            >
              <option value="all">All teams</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          )}
          <select
            title="Filter by completion status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="text-xs rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 px-2 py-1.5"
          >
            <option value="all">All statuses</option>
            <option value="finishers">Finishers</option>
            <option value="partial">Partial</option>
            <option value="dnf">DNF</option>
            <option value="no-data">Completed no data</option>
            <option value="not-completed">Not completed</option>
          </select>
          <span className="text-[11px] text-neutral-500">{visibleRows.length} shown</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-700/50">
              <th className="px-3 py-2 text-xs font-medium text-neutral-400 uppercase text-left">#</th>
              <th
                className="px-3 py-2 text-xs font-medium text-neutral-400 uppercase text-left cursor-pointer hover:text-neutral-200"
                onClick={() => toggleSort('name')}
              >
                Athlete <SortIcon field="name" sortField={sortField} />
              </th>
              <th className="px-3 py-2 text-xs font-medium text-neutral-400 uppercase text-center">Status</th>
              <SortTh label="Split /500m" field="split" sortField={sortField} onSort={toggleSort} />
              <SortTh label="Watts" field="watts" sortField={sortField} onSort={toggleSort} />
              {hasWpkg && <SortTh label="W/kg · W/lb" field="wpkg" sortField={sortField} onSort={toggleSort} />}
              <SortTh label="Distance" field="distance" sortField={sortField} onSort={toggleSort} />
              <SortTh label="Time" field="time" sortField={sortField} onSort={toggleSort} />
              <SortTh label="SR" field="stroke_rate" sortField={sortField} onSort={toggleSort} />
              {isInterval && <SortTh label={bestRepLabel} field="best" sortField={sortField} onSort={toggleSort} />}
              {isInterval && <SortTh label="Best Split" field="best" sortField={sortField} onSort={toggleSort} />}
              {isInterval && hasWpkg && <SortTh label="Eff (W/lb)" field="best_eff" sortField={sortField} onSort={toggleSort} />}
              {isInterval && <th className="px-3 py-2 text-xs font-medium text-neutral-400 uppercase text-right">Worst</th>}
              {isInterval && <th className="px-3 py-2 text-xs font-medium text-neutral-400 uppercase text-right">Spread</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIdx) => {
              const displayIndex = rowIdx + 1;
              const showPartialDivider = rowIdx === firstPartialDnfIdx && firstPartialDnfIdx > 0;
              const showCompleteNoDataDivider = rowIdx === firstCompleteNoDataIdx && firstCompleteNoDataIdx > 0;
              const showDnfDivider = rowIdx === firstFullDnfIdx && firstFullDnfIdx > 0;
              const showNotCompletedDivider = rowIdx === firstNotCompletedIdx && firstNotCompletedIdx > 0;
              return (
                <Fragment key={row.athlete_id}>
                  {showPartialDivider && (
                    <tr>
                      <td colSpan={99} className="px-3 py-1 text-[10px] font-semibold text-amber-400 uppercase tracking-widest bg-amber-900/10 border-t border-amber-900/40">
                        Partial completion
                      </td>
                    </tr>
                  )}
                  {showCompleteNoDataDivider && (
                    <tr>
                      <td colSpan={99} className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-700/20 border-t border-neutral-600/40">
                        Completed — no data entered
                      </td>
                    </tr>
                  )}
                  {showDnfDivider && (
                    <tr>
                      <td colSpan={99} className="px-3 py-1 text-[10px] font-semibold text-red-400 uppercase tracking-widest bg-red-900/10 border-t border-red-900/40">
                        DNF
                      </td>
                    </tr>
                  )}
                  {showNotCompletedDivider && (
                    <tr>
                      <td colSpan={99} className="px-3 py-1 bg-neutral-800/30 border-t border-neutral-700/30">
                        <button
                          onClick={() => setShowNotCompleted((v) => !v)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-widest hover:text-neutral-200"
                        >
                          {showNotCompleted ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          Not completed ({notCompletedRows.length})
                        </button>
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`border-b border-neutral-800/30 hover:bg-neutral-700/20 transition-colors ${
                      row.dnf ? 'opacity-60' : row.partialDnf ? 'opacity-75' : row.completeNoData ? 'opacity-50' : !row.completed ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-neutral-500 text-xs">
                      <span className="font-semibold text-neutral-500">{displayIndex}</span>
                    </td>
                    <td className="px-3 py-2 text-neutral-200 whitespace-nowrap">
                      <div>{row.athlete_name}</div>
                      {(row.team_name || row.squad) && (
                        <div className="text-[10px] text-neutral-500">
                          {row.team_name && row.squad
                            ? `${row.team_name} · ${row.squad}`
                            : row.team_name || row.squad}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.dnf ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900/40 text-red-400 uppercase tracking-wider">DNF</span>
                      ) : row.partialDnf ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-900/40 text-amber-400 uppercase tracking-wider">Partial</span>
                      ) : row.completeNoData ? (
                        <CheckCircle2 className="w-4 h-4 text-neutral-500 mx-auto" />
                      ) : row.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-neutral-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtSplit(row.avg_split_seconds)}</td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtWatts(row.watts)}</td>
                    {hasWpkg && <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtPowerToWeight(row.wpkg, row.wplb)}</td>}
                    <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtDist(row.result_distance_meters)}</td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtTime(row.result_time_seconds)}</td>
                    <td className="px-3 py-2 text-right text-neutral-200">{row.result_stroke_rate ?? '—'}</td>
                    {isInterval && (
                      <td className="px-3 py-2 text-right font-mono text-neutral-300 text-xs">
                        {fmtBestRep(row)}
                      </td>
                    )}
                    {isInterval && (
                      <td className="px-3 py-2 text-right font-mono text-neutral-300 text-xs">
                        {row.rep_best_split_seconds != null ? fmtSplit(row.rep_best_split_seconds) : '—'}
                      </td>
                    )}
                    {isInterval && hasWpkg && (
                      <td className="px-3 py-2 text-right font-mono text-neutral-300 text-xs">
                        {row.best_interval_wplb != null ? `${row.best_interval_wplb.toFixed(2)}` : '—'}
                      </td>
                    )}
                    {isInterval && (
                      <td className="px-3 py-2 text-right font-mono text-neutral-300 text-xs">
                        {row.rep_worst_split_seconds != null ? fmtSplit(row.rep_worst_split_seconds) : '—'}
                      </td>
                    )}
                    {isInterval && (
                      <td className="px-3 py-2 text-right font-mono text-neutral-300 text-xs">
                        {row.rep_split_spread_seconds != null ? fmtSplit(row.rep_split_spread_seconds) : '—'}
                      </td>
                    )}
                  </tr>
                </Fragment>
              );
            })}
            {notCompletedRows.length > 0 && !showNotCompleted && !visibleRows.some((r) => !r.completed) && (
              <tr>
                <td colSpan={99} className="px-3 py-2 text-xs text-neutral-500 border-t border-neutral-800/40">
                  <button
                    onClick={() => setShowNotCompleted(true)}
                    className="inline-flex items-center gap-1 hover:text-neutral-300"
                  >
                    <ChevronRight className="w-3 h-3" />
                    Show not completed ({notCompletedRows.length})
                  </button>
                </td>
              </tr>
            )}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={99} className="px-3 py-6 text-center text-sm text-neutral-500">
                  No athletes match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}

export function PublicAssignmentResultsShare() {
  const isImperial = useMeasurementUnits() === 'imperial';
  const shareToken = window.location.pathname.split('/').pop() ?? null;
  const [isLoading, setIsLoading] = useState(true);
  const [payload, setPayload] = useState<AssignmentResultsShareData | null>(null);
  const [isInvalid, setIsInvalid] = useState(false);
  const [teamFilter, setTeamFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shareToken) {
        setIsInvalid(true);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await resolveAssignmentResultsShare(shareToken);
        if (cancelled) return;
        if (!data) {
          setIsInvalid(true);
          setPayload(null);
        } else {
          setPayload(data);
          setIsInvalid(false);
        }
      } catch {
        if (!cancelled) {
          setIsInvalid(true);
          setPayload(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  const rows = useMemo(() => enrichRows(payload?.rows ?? []), [payload?.rows]);
  const teamOptions = useMemo(() => {
    const options = rows
      .map((r) => r.team_name?.trim())
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const scopedRows = useMemo(
    () => (teamFilter === 'all' ? rows : rows.filter((r) => (r.team_name ?? '').trim() === teamFilter)),
    [rows, teamFilter],
  );

  const shape = useMemo(() => {
    if (!payload?.assignment) return null;
    return parseWorkoutStructureForEntry(payload.assignment.workout_structure, payload.assignment.canonical_name ?? undefined) ?? null;
  }, [payload?.assignment]);
  const isInterval = shape?.type === 'time_interval' || shape?.type === 'distance_interval' || shape?.type === 'variable_interval';

  const repLabels = useMemo<string[]>(() => {
    if (!shape || !isInterval) return [];
    if (shape.type === 'variable_interval' && shape.variableReps) {
      return shape.variableReps.map((r, i) => r.label || `Rep ${i + 1}`);
    }
    if (shape.type === 'time_interval' || shape.type === 'distance_interval') {
      return Array.from({ length: shape.reps }, (_, i) => `Rep ${i + 1}`);
    }
    const maxReps = Math.max(0, ...scopedRows.map((r) => r.rep_splits.length));
    return Array.from({ length: maxReps }, (_, i) => `Rep ${i + 1}`);
  }, [shape, isInterval, scopedRows]);

  const chartRows = useMemo(() => {
    return [...scopedRows].sort((a, b) => {
      if (a.completed && !b.completed) return -1;
      if (!a.completed && b.completed) return 1;
      const as = a.avg_split_seconds ?? Number.POSITIVE_INFINITY;
      const bs = b.avg_split_seconds ?? Number.POSITIVE_INFINITY;
      return as - bs;
    });
  }, [scopedRows]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (isInvalid || !payload) {
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-xl border border-neutral-700 bg-neutral-800 p-6 space-y-3 text-center">
          <h1 className="text-xl font-semibold">This private share link is invalid or expired</h1>
          <p className="text-sm text-neutral-300">Ask the coach to generate a fresh assignment results private link.</p>
        </div>
      </div>
    );
  }

  const { assignment } = payload;
  const dateLabel = (() => {
    try {
      return format(parseISO(assignment.scheduled_date), 'EEEE, MMMM d, yyyy');
    } catch {
      return assignment.scheduled_date;
    }
  })();

  const expiresLabel = (() => {
    try {
      return format(parseISO(payload.expiresAt), 'PPP p');
    } catch {
      return payload.expiresAt;
    }
  })();

  const finished = scopedRows.filter((r) => r.completed && !r.dnf).length;
  const dnf = scopedRows.filter((r) => r.dnf).length;
  const completed = scopedRows.filter((r) => r.completed).length;
  const finisherRows = scopedRows.filter((r) => r.completed && !r.dnf && !r.partialDnf && r.avg_split_seconds != null);
  const avgFinisherSplit = finisherRows.length > 0
    ? finisherRows.reduce((sum, row) => sum + (row.avg_split_seconds ?? 0), 0) / finisherRows.length
    : null;
  const avgFinisherWatts = finisherRows.filter((r) => r.watts != null).length > 0
    ? finisherRows.reduce((sum, row) => sum + (row.watts ?? 0), 0) / finisherRows.filter((r) => r.watts != null).length
    : null;
  const intervalRepSplits = scopedRows.flatMap((r) => r.rep_splits.filter((v): v is number => v != null));
  const bestRepSplit = intervalRepSplits.length > 0 ? Math.min(...intervalRepSplits) : null;
  const worstRepSplit = intervalRepSplits.length > 0 ? Math.max(...intervalRepSplits) : null;
  const overallRepSpread = bestRepSplit != null && worstRepSplit != null ? worstRepSplit - bestRepSplit : null;

  return (
    <div className="public-share-light min-h-screen bg-slate-50 text-slate-900">
      <style>{`
        .public-share-light .bg-neutral-900,
        .public-share-light .bg-neutral-900\\/90,
        .public-share-light .bg-neutral-800,
        .public-share-light .bg-neutral-800\\/70,
        .public-share-light .bg-neutral-800\\/50,
        .public-share-light .bg-neutral-700\\/20,
        .public-share-light .bg-neutral-800\\/30,
        .public-share-light .bg-neutral-700\\/30 {
          background-color: #ffffff !important;
        }
        .public-share-light .text-neutral-100,
        .public-share-light .text-neutral-200,
        .public-share-light .text-neutral-300 {
          color: #0f172a !important;
        }
        .public-share-light .text-neutral-400,
        .public-share-light .text-neutral-500,
        .public-share-light .text-neutral-600 {
          color: #475569 !important;
        }
        .public-share-light .border-neutral-700,
        .public-share-light .border-neutral-700\\/50,
        .public-share-light .border-neutral-700\\/40,
        .public-share-light .border-neutral-800\\/60,
        .public-share-light .border-neutral-800\\/40,
        .public-share-light .border-neutral-800\\/30,
        .public-share-light .border-neutral-700\\/30,
        .public-share-light .border-neutral-600\\/40 {
          border-color: #e2e8f0 !important;
        }
      `}</style>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="rounded-xl border border-neutral-700 bg-neutral-800/70 p-5 space-y-2">
          <div className="flex items-center justify-end gap-2 pb-1">
            <a
              href="/login"
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to sign in
            </a>
            <a
              href="/login"
              className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Sign up for full access
            </a>
          </div>
          <h1 className="text-2xl font-bold">{assignment.title || assignment.template_name || 'Assignment Results'}</h1>
          <div className="text-sm text-neutral-300">{dateLabel}</div>
          {assignment.canonical_name && <div className="text-xs text-neutral-400 font-mono">{assignment.canonical_name}</div>}
          {assignment.instructions && <p className="text-sm text-neutral-200 pt-1">{assignment.instructions}</p>}
          <p className="text-xs text-neutral-400 pt-1">
            Private-by-link view. Anyone with this exact link can view these results until it expires, so share it like an unlisted link.
          </p>
          <div className="text-xs text-neutral-400 pt-1">{completed} of {scopedRows.length} completed • {finished} finished • {dnf} DNF • Link expires {expiresLabel}</div>
          {teamOptions.length > 1 && (
            <div className="pt-3">
              <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Team</label>
              <select
                aria-label="Filter whole page by team"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="h-9 w-full max-w-xs rounded-lg bg-neutral-900 border-2 border-indigo-500/40 px-3 text-sm font-medium text-neutral-100 focus:border-indigo-400 focus:outline-none"
              >
                <option value="all">All teams</option>
                {teamOptions.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-neutral-700 bg-neutral-800/70 p-3">
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Avg Finisher Split</div>
            <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtSplit(avgFinisherSplit)}</div>
          </div>
          <div className="rounded-xl border border-neutral-700 bg-neutral-800/70 p-3">
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Avg Finisher Watts</div>
            <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtWatts(avgFinisherWatts)}</div>
          </div>
          <div className="rounded-xl border border-neutral-700 bg-neutral-800/70 p-3">
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Best · Worst Rep</div>
            <div className="text-sm font-semibold text-neutral-100 font-mono">
              {bestRepSplit != null && worstRepSplit != null ? `${fmtSplit(bestRepSplit)} · ${fmtSplit(worstRepSplit)}` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-neutral-700 bg-neutral-800/70 p-3">
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Rep Spread</div>
            <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtSplit(overallRepSpread)}</div>
          </div>
        </div>

        <PublicSummaryTable rows={scopedRows} isInterval={isInterval} shapeType={shape?.type} />

        <div className="space-y-5">
          <h2 className="text-base font-semibold text-neutral-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Charts
          </h2>

          {isInterval && repLabels.length > 0 && (
            <div className="space-y-5">
              <RepHeatmap rows={chartRows} repLabels={repLabels} isImperial={isImperial} />
              <PercentileDotPlot rows={chartRows} isImperial={isImperial} />
              <RepProgressionChart rows={chartRows} repLabels={repLabels} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SplitBarChart rows={chartRows} />
            <WattsBarChart rows={chartRows} />
            <WpkgBarChart rows={chartRows} isImperial={isImperial} />
            {!isInterval && <PercentileDotPlot rows={chartRows} isImperial={isImperial} />}
          </div>
        </div>
      </div>
    </div>
  );
}
