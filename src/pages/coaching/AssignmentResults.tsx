/**
 * AssignmentResults.tsx
 *
 * Full-page results review for a single group assignment.
 * Shows a summary table + context-aware charts depending on workout type:
 *
 *  steady_state / distance_interval / time_interval:
 *    - Sorted bar chart (split, watts, W/kg + W/lb where weight known)
 *    - Percentile dot plot
 *
 *  interval or variable:
 *    - All above (using average split)
 *    - Multi-line rep progression chart (one line per athlete)
 *    - Rep heatmap (rows=athletes, cols=reps, color=relative speed)
 *
 * The page also acts as an entry point for entering/editing results
 * (opens the existing ResultsEntryModal via query param).
 */

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  ClipboardEdit,
  Users,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  TrendingUp,
  BarChart3,
  Maximize2,
  X as XIcon,
  ChevronRight,
  ChevronDown,
  Search,
  Link2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FileDown,
  Upload,
  Flag,
  Info,
  Table2,
  Grid3X3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
  Legend,
  ScatterChart,
  Scatter,
  Cell,
  Customized,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import { CoachingNav } from '../../components/coaching/CoachingNav';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { EmptyState } from '../../components/ui';
import { ImportCsvModal } from '../../components/coaching/ImportCsvModal';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { useMeasurementUnits } from '../../hooks/useMeasurementUnits';
import {
  getGroupAssignments,
  getAssignmentResultsWithAthletes,
  createAssignmentResultsShare,
  buildAssignmentResultsShareUrl,
  getAthletes,
  getOrgAthletes,
  type GroupAssignment,
  type AssignmentResultRow,
  type IntervalResult,
} from '../../services/coaching/coachingService';
import type { CoachingAthlete } from '../../services/coaching/types';
import { splitToWatts, formatSplit } from '../../utils/zones';
import { exportToPdf, exportToExcel, exportToCsv } from '../../utils/exportUtils';
import { parseWorkoutStructureForEntry } from '../../utils/workoutEntryClassifier';
import { ResultsEntryModal } from './CoachingAssignments';
import { supabase } from '../../services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = 'name' | 'split' | 'watts' | 'wpkg' | 'distance' | 'time' | 'best' | 'titan';
type SortDir = 'asc' | 'desc';

interface EnrichedRow extends AssignmentResultRow {
  /** Average split across all completed reps, or top-level split (seconds/500m) */
  avg_split_seconds: number | null;
  /** Watts derived from avg split */
  watts: number | null;
  /** W/kg — null when weight_kg is missing */
  wpkg: number | null;
  /** W/lb — null when weight is missing */
  wplb: number | null;
  /** Effective weight used for power-to-weight calculations */
  effective_weight_kg: number | null;
  /** Std-dev of per-rep split values (consistency score, lower = better) */
  consistency_sigma: number | null;
  /** Rep splits in order, from result_intervals */
  rep_splits: (number | null)[];
  /** Best (fastest) completed rep split */
  rep_best_split_seconds: number | null;
  /** Worst (slowest) completed rep split */
  rep_worst_split_seconds: number | null;
  /** Spread between worst and best rep split */
  rep_split_spread_seconds: number | null;
  /** Best (fastest) rep time across completed reps — meaningful for distance intervals */
  rep_best_time_seconds: number | null;
  /** Best (longest) rep distance across completed reps — meaningful for time intervals */
  rep_best_distance_meters: number | null;
  /** Watts derived from best (fastest) rep split */
  best_interval_watts: number | null;
  /** W/lb efficiency for best rep — null when weight is missing */
  best_interval_wplb: number | null;
  /** Total time across all completed intervals */
  total_interval_time_seconds: number | null;
  /** Total distance across all completed intervals */
  total_interval_distance_meters: number | null;
  /** True when athlete did not finish — sorts to the very bottom */
  dnf: boolean;
  /** True when athlete completed some reps but DNF'd others — sorts below finishers, above full DNF */
  partialDnf: boolean;
  /** True when athlete is marked complete but no performance data was entered */
  completeNoData: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSplit(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '—';
  return formatSplit(sec);
}

function fmtTime(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
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

function fmtWpkg(w: number | null | undefined): string {
  if (w == null || w <= 0) return '—';
  return `${w.toFixed(2)} W/kg`;
}

function fmtWplb(w: number | null | undefined): string {
  if (w == null || w <= 0) return '—';
  return `${w.toFixed(2)} W/lb`;
}

function fmtPowerToWeight(wpkg: number | null | undefined, wplb: number | null | undefined): string {
  if (wpkg == null || wpkg <= 0 || wplb == null || wplb <= 0) return '—';
  return `${fmtWpkg(wpkg)} · ${fmtWplb(wplb)}`;
}

function calcAvgSplit(row: AssignmentResultRow): number | null {
  // Prefer interval data if available
  if (row.result_intervals && row.result_intervals.length > 0) {
    // Use distance-weighted average when distance is known (variable-length pieces like 1:00/3:00/7:00).
    // A simple unweighted mean would over-weight short pieces vs long ones.
    const repsWithBoth = row.result_intervals.filter(
      (r): r is IntervalResult & { split_seconds: number; distance_meters: number } =>
        typeof r.split_seconds === 'number' && typeof r.distance_meters === 'number' && r.distance_meters > 0
    );
    if (repsWithBoth.length > 0) {
      const totalDist = repsWithBoth.reduce((s, r) => s + r.distance_meters, 0);
      // weighted sum: split_seconds * distance gives "seconds per 500m equivalent" * distance
      const weightedSum = repsWithBoth.reduce((s, r) => s + r.split_seconds * r.distance_meters, 0);
      return weightedSum / totalDist;
    }
    // Fallback: no distance data — simple mean of rep splits
    const repSplits = row.result_intervals
      .filter((r): r is IntervalResult & { split_seconds: number } => typeof r.split_seconds === 'number')
      .map((r) => r.split_seconds);
    if (repSplits.length > 0) return repSplits.reduce((a, b) => a + b, 0) / repSplits.length;
  }
  return row.result_split_seconds ?? null;
}

function calcRepSplits(row: AssignmentResultRow): (number | null)[] {
  if (row.result_intervals && row.result_intervals.length > 0) {
    return row.result_intervals.map((r) => r.split_seconds ?? null);
  }
  return [];
}

function calcSigma(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  return Math.sqrt(variance);
}

function enrichRows(rows: AssignmentResultRow[], latestWeightMap?: Map<string, number>): EnrichedRow[] {
  return rows.map((row) => {
    const avg_split_seconds = calcAvgSplit(row);

    // Athlete is DNF if they are marked completed but every interval is DNF,
    // or if they are completed with no split and no interval data at all.
    const intervals = row.result_intervals ?? [];
    const dnf =
      row.completed &&
      avg_split_seconds === null &&
      (intervals.length === 0 ||
        intervals.every((iv) => iv.dnf === true));

    // Partial DNF: some reps completed, some DNF (has both split data and DNF reps)
    const partialDnf =
      !dnf &&
      row.completed &&
      intervals.length > 0 &&
      intervals.some((iv) => iv.dnf === true) &&
      intervals.some((iv) => iv.dnf !== true && iv.split_seconds != null);

    // Completed but no data: marked complete, not DNF, not partial, but nothing recorded
    const completeNoData =
      !dnf &&
      !partialDnf &&
      row.completed &&
      avg_split_seconds === null;

    const watts = avg_split_seconds ? Math.round(splitToWatts(avg_split_seconds)) : null;
    const latestWeight = latestWeightMap?.get(row.athlete_id);
    const effectiveWeightKg =
      (row.result_weight_kg && row.result_weight_kg > 0) ? row.result_weight_kg
      : (latestWeight && latestWeight > 0) ? latestWeight
      : (row.weight_kg && row.weight_kg > 0) ? row.weight_kg
      : null;
    const wpkg =
      watts !== null && effectiveWeightKg != null
        ? watts / effectiveWeightKg
        : null;
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
    const total_interval_time_seconds = completedIntervals.length > 0
      ? completedIntervals.reduce((sum, iv) => sum + (iv.time_seconds ?? 0), 0) || null
      : null;
    const total_interval_distance_meters = completedIntervals.length > 0
      ? completedIntervals.reduce((sum, iv) => sum + (iv.distance_meters ?? 0), 0) || null
      : null;
    return {
      ...row,
      avg_split_seconds,
      watts,
      wpkg,
      wplb,
      effective_weight_kg: effectiveWeightKg,
      consistency_sigma,
      rep_splits,
      rep_best_split_seconds,
      rep_best_time_seconds,
      rep_best_distance_meters,
      rep_worst_split_seconds,
      rep_split_spread_seconds,
      best_interval_watts,
      best_interval_wplb,
      total_interval_time_seconds,
      total_interval_distance_meters,
      dnf,
      partialDnf,
      completeNoData,
    };
  });
}

// Distinct colors for athlete lines
const LINE_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e',
  '#a78bfa', '#34d399', '#fb923c', '#60a5fa', '#e879f9',
  '#4ade80', '#fbbf24', '#38bdf8', '#f472b6', '#a3e635',
];

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

// ─── Chart: Split Bar ─────────────────────────────────────────────────────────

function SplitBarChart({ rows }: { rows: EnrichedRow[] }) {
  const data = [...rows]
    .filter((r) => r.completed && r.avg_split_seconds != null)
    .sort((a, b) => (a.avg_split_seconds ?? 999) - (b.avg_split_seconds ?? 999))
    .map((r, i) => ({
      name: r.athlete_name.split(' ')[0], // first name to save space
      fullName: r.athlete_name,
      split: r.avg_split_seconds ?? 0,
      splitLabel: fmtSplit(r.avg_split_seconds),
      wpkg: r.wpkg,
      wplb: r.wplb,
      rank: i + 1,
    }));

  if (data.length === 0) return null;

  const min = Math.min(...data.map((d) => d.split));
  const max = Math.max(...data.map((d) => d.split));

  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-indigo-400" />
        Split /500m (faster = smaller)
      </h3>
      <div role="img" aria-label="Split per 500m distribution chart">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[min - 2, max + 2]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => fmtSplit(v)}
            reversed
            width={52}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const point = payload[0].payload as { fullName: string; split: number; wpkg: number | null; wplb: number | null };
              return (
                <div className="p-2 text-xs text-neutral-200">
                  <div className="font-semibold">{point.fullName}</div>
                  <div>Split: {fmtSplit(point.split)}</div>
                  <div>Power-to-weight: {fmtPowerToWeight(point.wpkg, point.wplb)}</div>
                </div>
              );
            }}
          />
          <Bar dataKey="split" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? '#10b981' : i === data.length - 1 ? '#f43f5e' : '#6366f1'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Chart: Race Finish ───────────────────────────────────────────────────────

function RaceFinishChart({ rows }: { rows: EnrichedRow[] }) {
  const finishers = [...rows]
    .filter((r) => r.completed && !r.dnf && r.avg_split_seconds != null)
    .sort((a, b) => (a.avg_split_seconds ?? 999) - (b.avg_split_seconds ?? 999));

  if (finishers.length < 2) return null;

  // Use result_time_seconds if available (single-distance test), otherwise total interval time
  const getTime = (r: EnrichedRow) => r.result_time_seconds ?? r.total_interval_time_seconds ?? null;
  const timesAvailable = finishers.some((r) => getTime(r) != null);
  if (!timesAvailable) return null;

  const fastestTime = Math.min(...finishers.map((r) => getTime(r) ?? Infinity));
  const slowestTime = Math.max(...finishers.map((r) => getTime(r) ?? 0));

  const medalColors = ['#fbbf24', '#94a3b8', '#d97706']; // gold, silver, bronze

  const data = finishers.map((r, i) => {
    const time = getTime(r) ?? 0;
    return {
      name: r.athlete_name,
      time,
      timeLabel: fmtTime(time),
      splitLabel: fmtSplit(r.avg_split_seconds),
      gap: i === 0 ? '' : `+${(time - fastestTime).toFixed(1)}s`,
      fill: i < 3 ? medalColors[i] : '#4b5563',
      rank: i + 1,
    };
  });

  const barHeight = 28;
  const chartHeight = Math.max(180, data.length * barHeight + 60);

  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3 col-span-full">
      <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
        <Flag className="w-4 h-4 text-indigo-400" />
        Race Finish
      </h3>
      <div role="img" aria-label="Race finish order chart">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              domain={[fastestTime - (slowestTime - fastestTime) * 0.05, slowestTime + (slowestTime - fastestTime) * 0.05]}
              tickFormatter={(v) => fmtTime(v)}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={({ x, y, payload }: { x: number; y: number; payload: { value: string; index: number } }) => {
                const item = data[payload.index];
                const medal = item?.rank <= 3;
                return (
                  <g>
                    <text x={x} y={y} textAnchor="end" dominantBaseline="central" fill={medal ? item.fill : '#9ca3af'} fontSize={11} fontWeight={medal ? 600 : 400}>
                      {`${item?.rank}. ${payload.value}`}
                    </text>
                  </g>
                );
              }}
              interval={0}
            />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="p-2 text-xs text-neutral-200">
                    <div className="font-semibold">{p.name}</div>
                    <div>Time: {p.timeLabel}</div>
                    <div>Split: {p.splitLabel}</div>
                    {p.gap && <div className="text-neutral-400">{p.gap}</div>}
                  </div>
                );
              }}
            />
            <Bar dataKey="time" radius={[0, 4, 4, 0]} barSize={barHeight - 6}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} fillOpacity={i < 3 ? 0.9 : 0.5} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Chart: Watts Bar ─────────────────────────────────────────────────────────

function WattsBarChart({ rows }: { rows: EnrichedRow[] }) {
  const data = [...rows]
    .filter((r) => r.completed && r.watts != null)
    .sort((a, b) => (b.watts ?? 0) - (a.watts ?? 0))
    .map((r, i) => ({
      name: r.athlete_name.split(' ')[0],
      fullName: r.athlete_name,
      watts: r.watts ?? 0,
      wpkg: r.wpkg,
      wplb: r.wplb,
      rank: i + 1,
    }));

  if (data.length === 0) return null;

  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-amber-400" />
        Watts (higher = better)
      </h3>
      <div role="img" aria-label="Watts output ranking chart">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${v}W`} width={48} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const point = payload[0].payload as { fullName: string; watts: number; wpkg: number | null; wplb: number | null };
              return (
                <div className="p-2 text-xs text-neutral-200">
                  <div className="font-semibold">{point.fullName}</div>
                  <div>Watts: {fmtWatts(point.watts)}</div>
                  <div>Power-to-weight: {fmtPowerToWeight(point.wpkg, point.wplb)}</div>
                </div>
              );
            }}
          />
          <Bar dataKey="watts" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? '#10b981' : i === data.length - 1 ? '#f43f5e' : '#f59e0b'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Chart: Power-to-Weight (W/kg + W/lb) ────────────────────────────────────

function WpkgBarChart({ rows }: { rows: EnrichedRow[] }) {
  const data = [...rows]
    .filter((r) => r.completed && r.wpkg != null)
    .sort((a, b) => (b.wpkg ?? 0) - (a.wpkg ?? 0))
    .map((r, i) => ({
      name: r.athlete_name.split(' ')[0],
      wpkg: Number((r.wpkg ?? 0).toFixed(2)),
      rank: i + 1,
    }));

  if (data.length === 0) return null;

  const withWeight = rows.filter((r) => r.completed && r.wpkg != null);
  const missing = rows.filter((r) => r.completed && r.wpkg == null);

  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          W/kg & W/lb — Power-to-Weight (higher = better)
        </h3>
        {missing.length > 0 && (
          <span className="text-xs text-neutral-500">
            {missing.length} athlete{missing.length > 1 ? 's' : ''} missing weight
          </span>
        )}
      </div>
      {withWeight.length > 0 ? (
        <div role="img" aria-label="Power-to-weight ranking chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => `${v.toFixed(1)}`}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number | undefined) => {
                const wpkg = v ?? 0;
                const wplb = wpkg / 2.20462;
                return [`${wpkg.toFixed(2)} W/kg · ${wplb.toFixed(2)} W/lb`, 'Power-to-weight (W/kg + W/lb)'];
              }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="wpkg" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === 0 ? '#10b981' : i === data.length - 1 ? '#f43f5e' : '#34d399'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 text-center py-6">
          No athlete weights recorded — add them in the roster to enable this chart.
        </p>
      )}
    </div>
  );
}

// ─── Chart: Percentile Dot Plot ───────────────────────────────────────────────

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
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">Power vs Body Weight</h3>
      <p className="text-xs text-neutral-500">X = body weight ({isImperial ? 'lb' : 'kg'}), Y = power (watts). Diagonal lines are {isImperial ? 'W/lb' : 'W/kg'} percentile benchmarks.</p>
      {teamNames.length > 1 && (
        <div className="flex flex-wrap gap-2 text-[11px] text-neutral-400">
          {teamNames.map((team) => (
            <span key={team} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 px-2 py-0.5">
              <span className={`h-2 w-2 rounded-full ${teamColor.get(team)?.dotClass ?? 'bg-blue-400'}`} />
              {team}
            </span>
          ))}
        </div>
      )}
      {ratioBenchmarks.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[11px] text-neutral-400">
          {ratioBenchmarks.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 px-2 py-0.5">
              <span className={`h-2 w-2 rounded-full ${b.dotClass}`} />
              {b.label}: {b.ratio.toFixed(2)} {isImperial ? 'W/lb' : 'W/kg'}
            </span>
          ))}
        </div>
      )}
      {missingWeightCount > 0 && (
        <p className="text-[11px] text-neutral-500">{missingWeightCount} athlete{missingWeightCount > 1 ? 's' : ''} excluded (missing weight).</p>
      )}
      <div role="img" aria-label="Power versus body weight scatter chart">
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 20)}>
        <ScatterChart margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="weightValue"
            name={`Body weight (${isImperial ? 'lb' : 'kg'})`}
            reversed
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: `Body Weight (${isImperial ? 'lb' : 'kg'}, lighter →)`, position: 'insideBottom', offset: -6, fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="watts"
            name="Power (watts)"
            domain={[0, yMax]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={40}
            label={{ value: 'Power (W)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11, dx: -4 }}
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
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as {
                fullName: string;
                team: string;
                watts: number;
                weightValue: number;
                split: number;
                wpkg: number | null;
                wplb: number | null;
              };
              return (
                <div className="p-2 text-xs text-neutral-200">
                  <div className="font-semibold">{d.fullName}</div>
                  <div>Team: {d.team}</div>
                  <div>Weight: {d.weightValue.toFixed(1)} {isImperial ? 'lb' : 'kg'}</div>
                  <div>Power: {fmtWatts(d.watts)}</div>
                  <div>Split: {fmtSplit(d.split)}</div>
                  <div>Power-to-weight: {fmtPowerToWeight(d.wpkg, d.wplb)}</div>
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
    </div>
  );
}

// ─── Chart: Rep Progression (multi-line) ─────────────────────────────────────

function RepProgressionChart({
  rows,
  repLabels,
}: {
  rows: EnrichedRow[];
  repLabels: string[];
}) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);
  const withReps = rows.filter((r) => r.completed && r.rep_splits.some((v) => v != null));
  const finishers = withReps.filter((r) => !r.dnf && !r.partialDnf);
  const partialRowers = withReps.filter((r) => r.partialDnf);
  const dnfRowers = withReps.filter((r) => r.dnf);
  if (withReps.length === 0 || repLabels.length === 0) return null;

  // Build data: one point per rep, each athlete is a field
  const chartData = repLabels.map((label, repIdx) => {
    const point: Record<string, string | number> = { rep: label };
    for (const row of withReps) {
      const splitVal = row.rep_splits[repIdx];
      if (splitVal != null) point[row.athlete_name] = splitVal;
    }
    return point;
  });

  // Smart Y-axis: fit to actual data range + 8% padding
  const allSplits = withReps.flatMap((r) => r.rep_splits.filter((v): v is number => v != null));
  const minSplit = Math.min(...allSplits);
  const maxSplit = Math.max(...allSplits);
  const pad = (maxSplit - minSplit) * 0.08 || 5;
  // Y is reversed (faster = higher on chart), so domain min=fast end, max=slow end
  const yDomain: [number, number] = [Math.floor(minSplit - pad), Math.ceil(maxSplit + pad)];
  const ratioByAthlete = new Map(withReps.map((r) => [r.athlete_name, fmtPowerToWeight(r.wpkg, r.wplb)]));

  const chartContent = (height: number) => (
    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
      <XAxis dataKey="rep" tick={{ fill: '#9ca3af', fontSize: 11 }} />
      <YAxis
        reversed
        domain={yDomain}
        tick={{ fill: '#9ca3af', fontSize: 11 }}
        tickFormatter={(v) => fmtSplit(v)}
        width={52}
        label={{
          value: 'Split /500m',
          angle: -90,
          position: 'insideLeft',
          fill: '#6b7280',
          fontSize: 10,
          dx: -4,
        }}
      />
      <Tooltip
        contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
        formatter={(v: number | undefined, name: string | undefined) => {
          const athleteName = name ?? '';
          const ratio = ratioByAthlete.get(athleteName) ?? '—';
          return [fmtSplit(v ?? 0), `${athleteName.split(' ')[0]} · ${ratio}`];
        }}
        labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
      />
      <Legend
        wrapperStyle={{ fontSize: height > 400 ? 13 : 11, color: '#9ca3af' }}
        formatter={(name: string) => name.split(' ')[0]}
      />
      {finishers.map((row, i) => (
        <Line
          key={row.athlete_id}
          type="monotone"
          dataKey={row.athlete_name}
          stroke={LINE_COLORS[i % LINE_COLORS.length]}
          strokeWidth={2}
          dot={{ r: 4, fill: LINE_COLORS[i % LINE_COLORS.length] }}
          activeDot={{ r: 6 }}
          connectNulls
        />
      ))}
      {partialRowers.map((row, i) => (
        <Line
          key={row.athlete_id}
          type="monotone"
          dataKey={row.athlete_name}
          stroke={LINE_COLORS[i % LINE_COLORS.length]}
          strokeWidth={1.5}
          strokeDasharray="6 2"
          dot={{ r: 3, fill: LINE_COLORS[i % LINE_COLORS.length] }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      ))}
      {dnfRowers.map((row) => (
        <Line
          key={row.athlete_id}
          type="monotone"
          dataKey={row.athlete_name}
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={{ r: 3, fill: '#6b7280' }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      ))}
    </LineChart>
  );

  return (
    <>
      <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Split per Rep — Individual Lines
          </h3>
          <button
            onClick={() => setFullscreen(true)}
            title="Fullscreen"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700/50 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Higher on chart = slower. Look for athletes who drift up (fall off) or spike down (go out too hard).
        </p>
        <div role="img" aria-label="Rep-by-rep split progression chart">
        <ResponsiveContainer width="100%" height={280}>
          {chartContent(280)}
        </ResponsiveContainer>
        </div>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col p-4 sm:p-8">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-base font-semibold text-neutral-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Split per Rep — Individual Lines
            </h2>
            <button
              onClick={() => setFullscreen(false)}
              aria-label="Close"
              title="Close"
              className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 bg-neutral-900 rounded-xl p-4" role="img" aria-label="Rep-by-rep split progression chart, fullscreen">
            <ResponsiveContainer width="100%" height="100%">
              {chartContent(600)}
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-neutral-600 mt-3 text-center flex-shrink-0">
            Higher = slower · Press Esc or click ✕ to close
          </p>
        </div>
      )}
    </>
  );
}

// ─── Chart: Rep Heatmap ───────────────────────────────────────────────────────

type HeatmapSortCol = 'name' | 'avg' | 'spread' | number; // number = rep index

function RepHeatmap({
  rows,
  repLabels,
  isImperial,
}: {
  rows: EnrichedRow[];
  repLabels: string[];
  isImperial: boolean;
}) {
  const [sortCol, setSortCol] = useState<HeatmapSortCol>('avg');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [metric, setMetric] = useState<'split' | 'wpkg'>('split');

  const toggleSort = (col: HeatmapSortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      // For splits/sigma, ascending = fastest first. For name, ascending = A-Z.
      setSortDir(col === 'name' ? 'asc' : 'asc');
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

  // Per-rep: compute team median to use for relative coloring
  const repMedians = repLabels.map((_, repIdx) => {
    const vals = withReps
      .map((r) => metric === 'split' ? r.rep_splits[repIdx] : repWpkgByAthlete.get(r.athlete_id)?.[repIdx] ?? null)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (vals.length === 0) return null;
    return vals[Math.floor(vals.length / 2)];
  });

  function cellColor(value: number | null, median: number | null): string {
    if (value == null || median == null || median <= 0) return 'bg-neutral-700/30';
    if (metric === 'split') {
      const pct = (value - median) / median; // positive = slower, negative = faster
      if (pct < -0.03) return 'bg-emerald-500/70';
      if (pct < -0.01) return 'bg-emerald-500/40';
      if (pct < 0.01) return 'bg-neutral-600/50';
      if (pct < 0.03) return 'bg-amber-500/40';
      return 'bg-red-500/60';
    }
    const pct = (value - median) / median; // positive = better for ratio
    if (pct > 0.03) return 'bg-emerald-500/70';
    if (pct > 0.01) return 'bg-emerald-500/40';
    if (pct > -0.01) return 'bg-neutral-600/50';
    if (pct > -0.03) return 'bg-amber-500/40';
    return 'bg-red-500/60';
  }

  function cellText(value: number | null): string {
    if (metric === 'split') return fmtSplit(value);
    if (value == null || value <= 0) return '—';
    return value.toFixed(2);
  }

  // Sort helper — extracts the numeric value to sort by for a given row
  const sortValue = (row: EnrichedRow): number | string | null => {
    if (sortCol === 'name') return row.athlete_name;
    if (sortCol === 'avg') {
      if (metric === 'split') return row.avg_split_seconds ?? null;
      const ratio = isImperial ? row.wplb : row.wpkg;
      if (ratio != null) return -ratio;
      return null;
    }
    if (sortCol === 'spread') return row.rep_split_spread_seconds ?? null;
    // sortCol is a rep index
    if (metric === 'split') return row.rep_splits[sortCol] ?? null;
    const ratio = repWpkgByAthlete.get(row.athlete_id)?.[sortCol] ?? null;
    return ratio != null ? -ratio : null;
  };

  const compareFn = (a: EnrichedRow, b: EnrichedRow): number => {
    const va = sortValue(a);
    const vb = sortValue(b);
    // Nulls always sort last regardless of direction
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
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-300">Rep Heatmap — vs. Team Median</h3>
        <div className="inline-flex rounded-lg border border-neutral-700 overflow-hidden text-[10px]">
          <button
            onClick={() => setMetric('split')}
            className={`px-2.5 py-1 font-semibold transition-colors ${metric === 'split' ? 'bg-indigo-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'}`}
          >
            Split
          </button>
          <button
            onClick={() => setMetric('wpkg')}
            className={`px-2.5 py-1 font-semibold transition-colors ${metric === 'wpkg' ? 'bg-indigo-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'}`}
          >
            {isImperial ? 'W/lb' : 'W/kg'}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-neutral-400">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-500/70" /> {metric === 'split' ? '>3% faster' : '>3% higher'}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-neutral-600/50" /> ±1% median</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-500/40" /> {metric === 'split' ? '>1% slower' : '>1% lower'}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500/60" /> {metric === 'split' ? '>3% slower' : '>3% lower'}</span>
      </div>
      {metric === 'wpkg' && (
        <p className="text-[10px] text-neutral-500">Rep cells show per-rep {isImperial ? 'W/lb' : 'W/kg'} derived from split and assignment/profile weight.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 bg-neutral-900/80 text-left px-3 py-2 text-neutral-500 font-medium cursor-pointer hover:text-neutral-200 transition-colors select-none"
                onClick={() => toggleSort('name')}
              >
                Athlete {heatmapSortIcon('name')}
              </th>
              {repLabels.map((label, i) => (
                <th
                  key={i}
                  className="px-2 py-2 text-center text-neutral-400 font-medium min-w-[64px] cursor-pointer hover:text-neutral-200 transition-colors select-none"
                  onClick={() => toggleSort(i)}
                >
                  {label} {heatmapSortIcon(i)}
                </th>
              ))}
              <th
                className="px-2 py-2 text-center text-neutral-400 font-medium cursor-pointer hover:text-neutral-200 transition-colors select-none"
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
                    <td
                      colSpan={repLabels.length + 2}
                      className="px-3 py-1 text-center text-[10px] font-semibold text-amber-400 uppercase tracking-widest bg-amber-900/10 border-t border-amber-900/40"
                    >
                      Partial completion
                    </td>
                  </tr>
                )}
                {rowIdx === firstDnfIdx && firstDnfIdx > 0 && (
                  <tr>
                    <td
                      colSpan={repLabels.length + 2}
                      className="px-3 py-1 text-center text-[10px] font-semibold text-red-400 uppercase tracking-widest bg-red-900/10 border-t border-red-900/40"
                    >
                      DNF
                    </td>
                  </tr>
                )}
                <tr className={row.dnf ? 'opacity-50' : row.partialDnf ? 'opacity-70' : ''}>
                  <td className="sticky left-0 bg-neutral-900/80 px-3 py-1.5 whitespace-nowrap border-t border-neutral-800/30">
                    <div className="flex items-center gap-2 text-neutral-200">
                      <span className="inline-flex min-w-5 justify-center text-[10px] font-semibold text-neutral-500">{rowIdx + 1}</span>
                      <span>{row.athlete_name}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500">{fmtPowerToWeight(row.wpkg, row.wplb)}</div>
                    {row.partialDnf && <span className="ml-1.5 text-[9px] font-bold text-amber-400 uppercase">Partial</span>}
                    {row.dnf && <span className="ml-1.5 text-[9px] font-bold text-red-400 uppercase">DNF</span>}
                  </td>
                  {repLabels.map((_, repIdx) => {
                    const split = metric === 'split'
                      ? row.rep_splits[repIdx] ?? null
                      : repWpkgByAthlete.get(row.athlete_id)?.[repIdx] ?? null;
                    const median = repMedians[repIdx];
                    return (
                      <td
                        key={repIdx}
                        className={`px-2 py-1.5 text-center border-t border-neutral-800/30 font-mono ${cellColor(split, median)}`}
                      >
                        {cellText(split)}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center border-t border-neutral-800/30 text-neutral-400 font-mono">
                    {row.rep_split_spread_seconds != null ? fmtSplit(row.rep_split_spread_seconds) : '—'}
                  </td>
                </tr>
              </Fragment>
            ))}
            {/* Median row */}
            <tr className="bg-neutral-800/30">
              <td className="sticky left-0 bg-neutral-800/60 px-3 py-1.5 text-neutral-500 font-semibold text-[10px] uppercase">
                Median
              </td>
              {repMedians.map((med, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-neutral-500 font-mono border-t border-neutral-700/50">
                  {metric === 'split' ? fmtSplit(med) : med != null && med > 0 ? med.toFixed(2) : '—'}
                </td>
              ))}
              <td className="px-2 py-1.5 border-t border-neutral-700/50" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Summary Table helpers (hoisted so React doesn't recreate on each render) ─

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
  helpText,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  onSort: (f: SortField) => void;
  helpText?: string;
}) {
  return (
    <th
      className="px-1.5 py-1.5 text-xs font-medium text-neutral-400 uppercase text-right cursor-pointer hover:text-neutral-200 transition-colors whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        <span>{label}</span>
        {helpText ? <MetricHelp label={label} description={helpText} /> : null}
      </span>
      <SortIcon field={field} sortField={sortField} />
    </th>
  );
}

function MetricHelp({ label, description }: { label: string; description: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`${label}: ${description}`}
        title={`${label}: ${description}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-64 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-[11px] normal-case leading-relaxed text-neutral-300 shadow-xl group-hover:block group-focus-within:block"
      >
        {description}
      </span>
    </span>
  );
}

// ─── Summary Table ────────────────────────────────────────────────────────────

function SummaryTable({
  rows,
  isInterval,
  onEdit,
}: {
  rows: EnrichedRow[];
  isInterval: boolean;
  onEdit: () => void;
}){
  const [sortField, setSortField] = useState<SortField>('split');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'finishers' | 'partial' | 'dnf' | 'no-data' | 'not-completed'>('all');
  const [showNotCompleted, setShowNotCompleted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'titan' ? 'desc' : 'asc');
    }
  }

  const filteredRows = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
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
  }, [rows, searchTerm, statusFilter]);

  // Speed Index: Z-score composite of speed (split) + efficiency (W/lb), 0-100 scale
  const titanMap = useMemo(() => {
    const map = new Map<string, number>();
    const eligible = filteredRows.filter(
      (r) => r.completed && !r.dnf && r.avg_split_seconds != null && r.wplb != null,
    );
    if (eligible.length < 2) return map;

    const splits = eligible.map((r) => r.avg_split_seconds!);
    const wplbs = eligible.map((r) => r.wplb!);

    const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const std = (arr: number[], m: number) => {
      const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
      return Math.sqrt(variance);
    };

    const splitMean = mean(splits);
    const splitStd = std(splits, splitMean);
    const wplbMean = mean(wplbs);
    const wplbStd = std(wplbs, wplbMean);
    if (splitStd === 0 || wplbStd === 0) return map;

    const raw: { id: string; z: number }[] = [];
    for (const r of eligible) {
      const speedZ = -(r.avg_split_seconds! - splitMean) / splitStd; // lower split = higher Z
      const effZ = (r.wplb! - wplbMean) / wplbStd;
      raw.push({ id: r.athlete_id, z: (speedZ + effZ) / 2 });
    }
    const minZ = Math.min(...raw.map((r) => r.z));
    const maxZ = Math.max(...raw.map((r) => r.z));
    const range = maxZ - minZ || 1;
    for (const r of raw) {
      map.set(r.id, ((r.z - minZ) / range) * 100);
    }
    return map;
  }, [filteredRows]);

  const sorted = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      // DNF always sinks to the very bottom, regardless of sort direction
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;

      // Completed-no-data sinks below DNF only when not-started; sits above not-completed
      if (a.completeNoData && !b.completeNoData && !b.dnf) return 1;
      if (!a.completeNoData && b.completeNoData && !a.dnf) return -1;

      // Partial DNF sinks below full finishers but above completed-no-data
      if (a.partialDnf && !b.partialDnf && !b.completeNoData && !b.dnf) return 1;
      if (!a.partialDnf && b.partialDnf && !a.completeNoData && !a.dnf) return -1;

      // Not-completed (no data at all) sinks below everything
      if (!a.completed && b.completed) return 1;
      if (a.completed && !b.completed) return -1;

      let av: number | string | null = null;
      let bv: number | string | null = null;
      switch (sortField) {
        case 'name': av = a.athlete_name; bv = b.athlete_name; break;
        case 'split': av = a.avg_split_seconds; bv = b.avg_split_seconds; break;
        case 'watts': av = a.watts; bv = b.watts; break;
        case 'wpkg': av = a.wpkg; bv = b.wpkg; break;
        case 'distance': av = a.result_distance_meters ?? a.total_interval_distance_meters ?? null; bv = b.result_distance_meters ?? b.total_interval_distance_meters ?? null; break;
        case 'time': av = a.result_time_seconds ?? a.total_interval_time_seconds ?? null; bv = b.result_time_seconds ?? b.total_interval_time_seconds ?? null; break;
        case 'best': av = a.rep_best_split_seconds; bv = b.rep_best_split_seconds; break;
        case 'titan': av = titanMap.get(a.athlete_id) ?? null; bv = titanMap.get(b.athlete_id) ?? null; break;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortField, sortDir, titanMap]);

  const completedRows = useMemo(() => sorted.filter((r) => r.completed), [sorted]);
  const notCompletedRows = useMemo(() => sorted.filter((r) => !r.completed), [sorted]);
  const visibleRows = useMemo(
    () => (showNotCompleted ? [...completedRows, ...notCompletedRows] : completedRows),
    [showNotCompleted, completedRows, notCompletedRows],
  );

  // Track where each tier starts for divider rows
  const firstPartialDnfIdx = visibleRows.findIndex((r) => r.partialDnf);
  const firstCompleteNoDataIdx = visibleRows.findIndex((r) => r.completeNoData);
  const firstFullDnfIdx = visibleRows.findIndex((r) => r.dnf);
  const firstNotCompletedIdx = visibleRows.findIndex((r) => !r.completed);

  const hasWpkg = visibleRows.some((r) => r.wpkg != null);
  const hasTitan = titanMap.size > 0;

  // Hide distance/time column when the value is identical for all finishers (fixed by workout design)
  const hideDistance = useMemo(() => {
    const finishers = visibleRows.filter(r => r.completed && !r.dnf && !r.partialDnf && !r.completeNoData);
    if (finishers.length < 2) return false;
    const dists = finishers.map(r => r.result_distance_meters ?? r.total_interval_distance_meters).filter((v): v is number => v != null);
    if (dists.length < 2) return false;
    return dists.every(d => d === dists[0]);
  }, [visibleRows]);

  const hideTime = useMemo(() => {
    const finishers = visibleRows.filter(r => r.completed && !r.dnf && !r.partialDnf && !r.completeNoData);
    if (finishers.length < 2) return false;
    const times = finishers.map(r => r.result_time_seconds ?? r.total_interval_time_seconds).filter((v): v is number => v != null);
    if (times.length < 2) return false;
    return times.every(t => t === times[0]);
  }, [visibleRows]);

  return (
    <div className="bg-neutral-800/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" /> Results Summary
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-700/40 text-neutral-300 hover:bg-neutral-700/60 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
          >
            <ClipboardEdit className="w-3.5 h-3.5" />
            Enter / Edit Results
          </button>
        </div>
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
              <th className="px-1.5 py-1.5 text-xs font-medium text-neutral-400 uppercase text-left">#</th>
              <th
                className="px-1.5 py-1.5 text-xs font-medium text-neutral-400 uppercase text-left cursor-pointer hover:text-neutral-200"
                onClick={() => toggleSort('name')}
              >
                Athlete <SortIcon field="name" sortField={sortField} />
              </th>
              <th className="px-1.5 py-1.5 text-xs font-medium text-neutral-400 uppercase text-center">Status</th>
              <SortTh label="Split /500m" field="split" sortField={sortField} onSort={toggleSort} />
              <SortTh label="Watts" field="watts" sortField={sortField} onSort={toggleSort} />
              {hasWpkg && <SortTh label="W/kg · W/lb" field="wpkg" sortField={sortField} onSort={toggleSort} helpText="Power-to-weight shows how much power an athlete produces relative to body weight. We surface both W/kg and W/lb here so coaches can read relative power in either unit system." />}
              {!hideDistance && <SortTh label="Distance" field="distance" sortField={sortField} onSort={toggleSort} />}
              {!hideTime && <SortTh label="Time" field="time" sortField={sortField} onSort={toggleSort} />}
              {hasTitan && <SortTh label="Speed Index" field="titan" sortField={sortField} onSort={toggleSort} helpText="Speed Index blends normalized speed and relative power into a 0 to 100 score with equal weighting. We know that still gives raw power extra voice because split already reflects output; that is intentional, so actual speed stays primary while power-for-size still gets explicit credit." />}
              {isInterval && <SortTh label="Best Split" field="best" sortField={sortField} onSort={toggleSort} />}
              {isInterval && <th className="px-1.5 py-1.5 text-xs font-medium text-neutral-400 uppercase text-right">Spread</th>}
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
                  <td className="px-1.5 py-1.5 text-neutral-500 text-xs">
                    <span className="font-semibold text-neutral-500">{displayIndex}</span>
                  </td>
                  <td className="px-1.5 py-1.5 text-neutral-200 whitespace-nowrap">
                    <div>{row.athlete_name}</div>
                    {(row.team_name || row.squad) && (
                      <div className="text-[10px] text-neutral-500">
                        {row.team_name && row.squad
                          ? `${row.team_name} · ${row.squad}`
                          : row.team_name || row.squad}
                      </div>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-center">
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
                  <td className="px-1.5 py-1.5 text-right font-mono text-neutral-200">{fmtSplit(row.avg_split_seconds)}</td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-neutral-200">{fmtWatts(row.watts)}</td>
                  {hasWpkg && <td className="px-1.5 py-1.5 text-right font-mono text-neutral-200">{fmtPowerToWeight(row.wpkg, row.wplb)}</td>}
                  {!hideDistance && <td className="px-1.5 py-1.5 text-right font-mono text-neutral-200">{fmtDist(row.result_distance_meters ?? row.total_interval_distance_meters)}</td>}
                  {!hideTime && <td className="px-1.5 py-1.5 text-right font-mono text-neutral-200">{fmtTime(row.result_time_seconds ?? row.total_interval_time_seconds)}</td>}
                  {hasTitan && (
                    <td className="px-1.5 py-1.5 text-right font-mono text-neutral-200 font-semibold">
                      {titanMap.get(row.athlete_id) != null ? titanMap.get(row.athlete_id)!.toFixed(1) : '—'}
                    </td>
                  )}
                  {isInterval && (
                    <td className="px-1.5 py-1.5 text-right font-mono text-neutral-300 text-xs">
                      {row.rep_best_split_seconds != null ? fmtSplit(row.rep_best_split_seconds) : '—'}
                    </td>
                  )}
                  {isInterval && (
                    <td className="px-1.5 py-1.5 text-right font-mono text-neutral-300 text-xs">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AssignmentResults() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { teamId, orgId, isLoadingTeam } = useCoachingContext();
  const isImperial = useMeasurementUnits() === 'imperial';

  const [assignment, setAssignment] = useState<GroupAssignment | null>(null);
  const [rawRows, setRawRows] = useState<AssignmentResultRow[]>([]);
  const [latestWeightMap, setLatestWeightMap] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importAthletes, setImportAthletes] = useState<CoachingAthlete[]>([]);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [squadFilter, setSquadFilter] = useState<string>('all');
  const [viewTab, setViewTab] = useState<'table' | 'heatmap' | 'charts'>('table');

  const handleCreateShareLink = useCallback(async () => {
    if (!assignmentId) return;
    setIsCreatingShare(true);
    try {
      const { token, expiresAt } = await createAssignmentResultsShare(assignmentId, 168);
      const url = buildAssignmentResultsShareUrl(token);
      await navigator.clipboard.writeText(url);
      const expiresLabel = (() => {
        try {
          return format(parseISO(expiresAt), 'PPP p');
        } catch {
          return expiresAt;
        }
      })();
      toast.success(`Private share link copied (expires ${expiresLabel})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  }, [assignmentId]);

  const load = useCallback(async () => {
    if (!teamId || !assignmentId) return;
    setIsLoading(true);
    try {
      const [assignments, rows] = await Promise.all([
        getGroupAssignments(teamId, { orgId: orgId ?? undefined }),
        getAssignmentResultsWithAthletes(assignmentId, teamId, orgId),
      ]);
      const found = assignments.find((a) => a.id === assignmentId);
      if (!found) {
        toast.error('Assignment not found');
        navigate('/team-management/assignments');
        return;
      }
      setAssignment(found);
      setRawRows(rows);

      // Fetch most recent weight recorded for each athlete across all assignments
      const athleteIds = [...new Set(rows.map((r) => r.athlete_id))];
      if (athleteIds.length > 0) {
        const { data: weightData } = await supabase
          .from('daily_workout_assignments')
          .select('athlete_id, result_weight_kg, completed_at')
          .in('athlete_id', athleteIds)
          .not('result_weight_kg', 'is', null)
          .gt('result_weight_kg', 0)
          .order('completed_at', { ascending: false, nullsFirst: false });
        const wMap = new Map<string, number>();
        if (weightData) {
          for (const w of weightData) {
            if (!wMap.has(w.athlete_id)) {
              wMap.set(w.athlete_id, Number(w.result_weight_kg));
            }
          }
        }
        setLatestWeightMap(wMap);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, orgId, assignmentId, navigate]);

  useEffect(() => {
    if (!isLoadingTeam) load();
  }, [isLoadingTeam, load]);

  // Enrich rows with derived metrics
  const allRows = useMemo(() => enrichRows(rawRows, latestWeightMap), [rawRows, latestWeightMap]);

  // Is this an org-level assignment?
  const isOrgAssignment = !!assignment?.org_id;

  // Teams available in this assignment (for org assignments)
  const teams = useMemo(() => {
    if (!isOrgAssignment) return [];
    const map = new Map<string, string>();
    rawRows.forEach((r) => {
      if (r.team_id && r.team_name) map.set(r.team_id, r.team_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawRows, isOrgAssignment]);

  // Team-filtered rows (applied first for org assignments)
  const teamFilteredRows = useMemo(
    () => teamFilter === 'all' ? allRows : allRows.filter((r) => r.team_id === teamFilter),
    [allRows, teamFilter],
  );

  // Squads available within current team filter
  const squads = useMemo(() => {
    const set = new Set<string>();
    teamFilteredRows.forEach((r) => { if (r.squad) set.add(r.squad); });
    return Array.from(set).sort();
  }, [teamFilteredRows]);

  // Filtered view (team first, then squad)
  const rows = useMemo(
    () => squadFilter === 'all' ? teamFilteredRows : teamFilteredRows.filter((r) => r.squad === squadFilter),
    [teamFilteredRows, squadFilter],
  );

  // Reset squad filter when team filter changes and squad no longer exists
  useEffect(() => {
    if (squadFilter !== 'all' && !squads.includes(squadFilter)) {
      setSquadFilter('all');
    }
  }, [squads, squadFilter]);

  // Classify workout shape
  const shape = useMemo(() => {
    if (!assignment) return null;
    return (
      parseWorkoutStructureForEntry(
        assignment.workout_structure,
        assignment.canonical_name ?? undefined
      ) ?? null
    );
  }, [assignment]);

  const isInterval = shape?.type === 'time_interval' || shape?.type === 'distance_interval' || shape?.type === 'variable_interval';

  // Best-rep column label/value depend on the interval type:
  // distance_interval → athletes row for time, so best rep = fastest time
  // time_interval → athletes row for distance, so best rep = longest distance
  const bestRepLabel = shape?.type === 'distance_interval' ? 'Best Time'
    : shape?.type === 'time_interval' ? 'Best Dist'
    : 'Best Rep';
  const fmtBestRep = (r: EnrichedRow): string =>
    shape?.type === 'distance_interval'
      ? fmtTime(r.rep_best_time_seconds)
      : shape?.type === 'time_interval'
        ? fmtDist(r.rep_best_distance_meters)
        : fmtSplit(r.rep_best_split_seconds);
  const fmtBestRepExcel = (r: EnrichedRow, fmtExcelTime: (s: number | null | undefined) => string): string | number | null =>
    shape?.type === 'distance_interval'
      ? fmtExcelTime(r.rep_best_time_seconds)
      : shape?.type === 'time_interval'
        ? (r.rep_best_distance_meters != null ? r.rep_best_distance_meters : null)
        : fmtSplit(r.rep_best_split_seconds);

  // Build rep labels for interval charts
  const repLabels = useMemo<string[]>(() => {
    if (!shape || !isInterval) return [];
    if (shape.type === 'variable_interval' && shape.variableReps) {
      return shape.variableReps.map((r, i) => r.label || `Rep ${i + 1}`);
    }
    if (shape.type === 'time_interval' || shape.type === 'distance_interval') {
      return Array.from({ length: shape.reps }, (_, i) => `Rep ${i + 1}`);
    }
    // Fallback: infer from data
    const maxReps = Math.max(0, ...rows.map((r) => r.rep_splits.length));
    return Array.from({ length: maxReps }, (_, i) => `Rep ${i + 1}`);
  }, [shape, isInterval, rows]);

  const finishedCount = rows.filter((r) => r.completed && !r.dnf).length;
  const dnfCount = rows.filter((r) => r.dnf).length;
  const completedCount = finishedCount + dnfCount; // attempted (finished + DNF)
  const totalCount = allRows.length;
  const filteredTotal = rows.length;
  const finisherRows = rows.filter((r) => r.completed && !r.dnf && !r.partialDnf && r.avg_split_seconds != null);
  const avgFinisherSplit = finisherRows.length > 0
    ? finisherRows.reduce((sum, row) => sum + (row.avg_split_seconds ?? 0), 0) / finisherRows.length
    : null;
  const avgFinisherWatts = finisherRows.filter((r) => r.watts != null).length > 0
    ? finisherRows.reduce((sum, row) => sum + (row.watts ?? 0), 0) / finisherRows.filter((r) => r.watts != null).length
    : null;
  const intervalRepSplits = rows.flatMap((r) => r.rep_splits.filter((v): v is number => v != null));
  const bestRepSplit = intervalRepSplits.length > 0 ? Math.min(...intervalRepSplits) : null;
  const worstRepSplit = intervalRepSplits.length > 0 ? Math.max(...intervalRepSplits) : null;
  const overallRepSpread = bestRepSplit != null && worstRepSplit != null ? worstRepSplit - bestRepSplit : null;

  // Interval-specific aggregate stats
  const avgFinisherTotalDist = isInterval && finisherRows.length > 0
    ? (() => {
        const withDist = finisherRows.filter((r) => (r.result_distance_meters ?? r.total_interval_distance_meters) != null);
        if (withDist.length === 0) return null;
        return withDist.reduce((s, r) => s + (r.result_distance_meters ?? r.total_interval_distance_meters ?? 0), 0) / withDist.length;
      })()
    : null;
  const avgFinisherTotalTime = isInterval && finisherRows.length > 0
    ? (() => {
        const withTime = finisherRows.filter((r) => (r.result_time_seconds ?? r.total_interval_time_seconds) != null);
        if (withTime.length === 0) return null;
        return withTime.reduce((s, r) => s + (r.result_time_seconds ?? r.total_interval_time_seconds ?? 0), 0) / withTime.length;
      })()
    : null;

  if (isLoading || isLoadingTeam) {
    return (
      <>
        <CoachingNav />
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </>
    );
  }

  if (!assignment) return null;

  const dateLabel = (() => {
    try {
      return format(parseISO(assignment.scheduled_date), 'EEEE, MMMM d, yyyy');
    } catch {
      return assignment.scheduled_date;
    }
  })();

  return (
    <>
      <CoachingNav />
      <div className="min-h-screen bg-neutral-900 text-neutral-100">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

          {/* ── Header ── */}
          <div className="space-y-1">
            <Breadcrumb items={[
              { label: 'Team Management', to: '/team-management' },
              { label: 'Team Workouts', to: '/team-management/assignments' },
              { label: assignment.title || assignment.template_name || 'Results' },
            ]} />

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-neutral-100">
                  {assignment.title || assignment.template_name || 'Assignment Results'}
                </h1>
                <div className="flex flex-wrap gap-2 items-center text-sm text-neutral-400">
                  <span>{dateLabel}</span>
                  {assignment.canonical_name && (
                    <>
                      <span className="text-neutral-600">·</span>
                      <span className="font-mono text-xs text-neutral-500">{assignment.canonical_name}</span>
                    </>
                  )}
                  {assignment.training_zone && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
                      {assignment.training_zone}
                    </span>
                  )}
                  {assignment.is_test_template && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/50">
                      Test
                    </span>
                  )}
                </div>
              </div>

              {/* Completion badge */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateShareLink}
                  disabled={isCreatingShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-medium"
                >
                  {isCreatingShare ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  Copy Private Link
                </button>
                <button
                  onClick={() => {
                    const title = assignment?.title || assignment?.template_name || 'Assignment Results';
                    const subtitle = `${dateLabel} · ${finishedCount} of ${totalCount} finished`;
                    const baseColumns = ['Athlete', 'Status', 'Split /500m', 'Watts', 'W/kg', 'Weight (lb)', 'Distance', 'Time'];
                    const repCols = isInterval
                      ? repLabels.flatMap((_, i) => [`Rep ${i + 1} Split`, `Rep ${i + 1} Time`])
                      : [];
                    const summaryColumns = isInterval ? [bestRepLabel, 'Best Split', 'Efficiency', 'Worst Split', 'Spread'] : [];
                    const columns = [...baseColumns, ...repCols, ...summaryColumns];
                    const pdfRows = rows.map((r) => {
                      const weightLb = r.effective_weight_kg != null ? Math.round(r.effective_weight_kg * 2.20462) : null;
                      const base: string[] = [
                        r.athlete_name,
                        r.completed ? (r.dnf ? 'DNF' : 'Completed') : 'Pending',
                        fmtSplit(r.avg_split_seconds),
                        fmtWatts(r.watts),
                        fmtWpkg(r.wpkg),
                        weightLb != null ? `${weightLb}` : '—',
                        fmtDist(r.result_distance_meters ?? r.total_interval_distance_meters),
                        fmtTime(r.result_time_seconds ?? r.total_interval_time_seconds),
                      ];
                      if (isInterval) {
                        for (let i = 0; i < repLabels.length; i++) {
                          const iv = r.result_intervals?.[i];
                          base.push(
                            iv?.dnf ? 'DNF' : fmtSplit(iv?.split_seconds),
                            iv?.dnf ? 'DNF' : fmtTime(iv?.time_seconds),
                          );
                        }
                        base.push(
                          fmtBestRep(r),
                          fmtSplit(r.rep_best_split_seconds),
                          r.best_interval_wplb != null ? r.best_interval_wplb.toFixed(2) : '—',
                          fmtSplit(r.rep_worst_split_seconds),
                          fmtSplit(r.rep_split_spread_seconds),
                        );
                      }
                      return base;
                    });
                    exportToPdf({ filename: `results-${assignmentId}`, title, subtitle, columns, rows: pdfRows, orientation: 'landscape' });
                  }}
                  disabled={rows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 text-xs font-medium"
                  title="Export results to PDF"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  onClick={() => {
                    const fmtExcelTime = (s: number | null | undefined): string => {
                      if (s == null) return '';
                      const mins = Math.floor(s / 60);
                      const secs = s % 60;
                      return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
                    };
                    const baseColumns = ['Athlete', 'Status', 'Split /500m', 'Watts', 'W/kg', 'Weight (lb)', 'Distance', 'Time'];
                    const repCols = isInterval
                      ? repLabels.flatMap((_, i) => [`Rep ${i + 1} Split`, `Rep ${i + 1} Time`])
                      : [];
                    const summaryColumns = isInterval ? [bestRepLabel, 'Best Split', 'Efficiency', 'Worst Split', 'Spread'] : [];
                    const columns = [...baseColumns, ...repCols, ...summaryColumns];
                    const xlsRows = rows.map((r) => {
                      const weightLb = r.effective_weight_kg != null ? Number((r.effective_weight_kg * 2.20462).toFixed(1)) : null;
                      const totalTime = r.result_time_seconds ?? r.total_interval_time_seconds ?? null;
                      const base: (string | number | null)[] = [
                        r.athlete_name,
                        r.completed ? (r.dnf ? 'DNF' : 'Completed') : 'Pending',
                        fmtSplit(r.avg_split_seconds),
                        r.watts ?? null,
                        r.wpkg != null ? Number(r.wpkg.toFixed(2)) : null,
                        weightLb,
                        r.result_distance_meters ?? r.total_interval_distance_meters ?? null,
                        fmtExcelTime(totalTime),
                      ];
                      if (isInterval) {
                        for (let i = 0; i < repLabels.length; i++) {
                          const iv = r.result_intervals?.[i];
                          base.push(
                            iv?.dnf ? 'DNF' : fmtSplit(iv?.split_seconds),
                            iv?.dnf ? 'DNF' : fmtExcelTime(iv?.time_seconds),
                          );
                        }
                        base.push(
                          fmtBestRepExcel(r, fmtExcelTime),
                          fmtSplit(r.rep_best_split_seconds),
                          r.best_interval_wplb != null ? Number(r.best_interval_wplb.toFixed(2)) : null,
                          fmtSplit(r.rep_worst_split_seconds),
                          fmtSplit(r.rep_split_spread_seconds),
                        );
                      }
                      return base;
                    });
                    exportToExcel({
                      filename: `results-${assignmentId}`,
                      sheets: [{ name: 'Results', columns, rows: xlsRows }],
                    });
                  }}
                  disabled={rows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 text-xs font-medium"
                  title="Export results to Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  onClick={() => {
                    const fmtRepTime = (s: number | null | undefined): string => {
                      if (s == null) return '';
                      const mins = Math.floor(s / 60);
                      const secs = s % 60;
                      return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
                    };
                    const repCols = isInterval
                      ? repLabels.flatMap((_, i) => [`Rep ${i + 1} Split`, `Rep ${i + 1} Time`])
                      : [];
                    const columns = [
                      'Athlete', 'Team', 'Squad',
                      ...repCols,
                      'Total Time', 'Avg Split /500m',
                      'Watts', 'W/kg', 'W/lb', 'Weight (lb)',
                      ...(isInterval ? [bestRepLabel, 'Best Split', 'Efficiency', 'Worst Split', 'Spread'] : []),
                    ];
                    const csvRows = rows.map((r) => {
                      const weightLb = r.effective_weight_kg != null ? Number((r.effective_weight_kg * 2.20462).toFixed(1)) : null;
                      const base: (string | number | null)[] = [
                        r.athlete_name,
                        r.team_name ?? '',
                        r.squad ?? '',
                      ];
                      if (isInterval) {
                        for (let i = 0; i < repLabels.length; i++) {
                          const iv = r.result_intervals?.[i];
                          base.push(
                            iv?.dnf ? 'DNF' : fmtSplit(iv?.split_seconds),
                            iv?.dnf ? 'DNF' : fmtRepTime(iv?.time_seconds),
                          );
                        }
                      }
                      base.push(
                        fmtRepTime(r.result_time_seconds ?? r.total_interval_time_seconds),
                        fmtSplit(r.avg_split_seconds),
                        r.watts ?? null,
                        r.wpkg != null ? Number(r.wpkg.toFixed(2)) : null,
                        r.wplb != null ? Number(r.wplb.toFixed(2)) : null,
                        weightLb,
                      );
                      if (isInterval) {
                        base.push(
                          fmtBestRep(r),
                          fmtSplit(r.rep_best_split_seconds),
                          r.best_interval_wplb != null ? Number(r.best_interval_wplb.toFixed(2)) : null,
                          fmtSplit(r.rep_worst_split_seconds),
                          fmtSplit(r.rep_split_spread_seconds),
                        );
                      }
                      return base;
                    });
                    exportToCsv({ filename: `results-${assignmentId}`, columns, rows: csvRows });
                  }}
                  disabled={rows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 text-xs font-medium"
                  title="Export results to CSV"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  onClick={async () => {
                    // Fetch athletes for the import modal
                    const aths = assignment.org_id && orgId
                      ? await getOrgAthletes(orgId)
                      : await getAthletes(teamId!);
                    setImportAthletes(aths.filter((a) => a.side !== 'coxswain'));
                    setShowImportModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 text-xs font-medium transition-colors"
                  title="Import results from CSV file"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import CSV
                </button>
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-100">{finishedCount}</div>
                  <div className="text-xs text-neutral-500">of {squadFilter === 'all' ? totalCount : filteredTotal} finished</div>
                  {dnfCount > 0 && (
                    <div className="text-[10px] font-semibold text-red-400 mt-0.5">{dnfCount} DNF</div>
                  )}
                </div>
                <div className="w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#374151" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={finishedCount === totalCount ? '#10b981' : '#6366f1'}
                      strokeWidth="3"
                      strokeDasharray={`${totalCount > 0 ? (finishedCount / totalCount) * 100 : 0} 100`}
                      strokeLinecap="round"
                    />
                    {dnfCount > 0 && (
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeDasharray={`${totalCount > 0 ? (dnfCount / totalCount) * 100 : 0} 100`}
                        strokeDashoffset={`${totalCount > 0 ? -(finishedCount / totalCount) * 100 : 0}`}
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </div>
              </div>
            </div>

            {assignment.instructions && (
              <p className="text-sm text-neutral-400 mt-1">{assignment.instructions}</p>
            )}

            {/* Team filter pills — only shown for org assignments with multiple teams */}
            {isOrgAssignment && teams.length > 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => setTeamFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    teamFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  All teams
                </button>
                {teams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTeamFilter(t.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      teamFilter === t.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            {/* Squad filter pills — only shown when multiple squads exist */}
            {squads.length > 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => setSquadFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    squadFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  All squads
                </button>
                {squads.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSquadFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      squadFilter === s
                        ? 'bg-indigo-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Avg Finisher Split</div>
              <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtSplit(avgFinisherSplit)}</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Avg Finisher Watts</div>
              <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtWatts(avgFinisherWatts)}</div>
            </div>
            {isInterval ? (
              <>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                  <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Fastest Interval</div>
                  <div className="text-lg font-semibold text-emerald-400 font-mono">{fmtSplit(bestRepSplit)}</div>
                </div>
                {avgFinisherTotalDist != null && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Avg Total Distance</div>
                    <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtDist(avgFinisherTotalDist)}</div>
                  </div>
                )}
                {avgFinisherTotalTime != null && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Avg Total Time</div>
                    <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtTime(avgFinisherTotalTime)}</div>
                  </div>
                )}
                {avgFinisherTotalDist == null && avgFinisherTotalTime == null && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                    <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Rep Spread</div>
                    <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtSplit(overallRepSpread)}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                  <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Best · Worst Rep</div>
                  <div className="text-sm font-semibold text-neutral-100 font-mono">
                    {bestRepSplit != null && worstRepSplit != null ? `${fmtSplit(bestRepSplit)} · ${fmtSplit(worstRepSplit)}` : '—'}
                  </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                  <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Rep Spread</div>
                  <div className="text-lg font-semibold text-neutral-100 font-mono">{fmtSplit(overallRepSpread)}</div>
                </div>
              </>
            )}
          </div>

          {/* ── Missing athletes notice ── */}
          {(() => {
            const missing = rows.filter((r) => !r.completed && !r.is_coxswain);
            if (missing.length === 0) return null;
            return (
              <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 text-sm text-amber-300">
                <span className="font-semibold">Absent or not completed:</span>{' '}
                {missing.map((r) => r.athlete_name).join(', ')}
              </div>
            );
          })()}

          {/* ── View Tabs ── */}
          {completedCount > 0 && (
            <div className="flex items-center gap-1 border-b border-neutral-800">
              <button
                onClick={() => setViewTab('table')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  viewTab === 'table'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                Table
              </button>
              {isInterval && repLabels.length > 0 && (
                <button
                  onClick={() => setViewTab('heatmap')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    viewTab === 'heatmap'
                      ? 'border-indigo-500 text-indigo-300'
                      : 'border-transparent text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  Rep Heatmap
                </button>
              )}
              <button
                onClick={() => setViewTab('charts')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  viewTab === 'charts'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Charts
              </button>
            </div>
          )}

          {/* ── Tab Content ── */}
          {completedCount > 0 && viewTab === 'table' && (
            <SummaryTable
              rows={rows}
              isInterval={isInterval}
              onEdit={() => setShowEntryModal(true)}
            />
          )}

          {completedCount > 0 && viewTab === 'heatmap' && isInterval && repLabels.length > 0 && (
            <div className="space-y-5">
              <RepHeatmap rows={rows} repLabels={repLabels} isImperial={isImperial} />
              <RepProgressionChart rows={rows} repLabels={repLabels} />
            </div>
          )}

          {completedCount > 0 && viewTab === 'charts' && (
            <div className="space-y-5">
              <PercentileDotPlot rows={rows} isImperial={isImperial} />
              {!isInterval && <RaceFinishChart rows={rows} />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SplitBarChart rows={rows} />
                <WattsBarChart rows={rows} />
                <WpkgBarChart rows={rows} />
              </div>
            </div>
          )}

          {completedCount === 0 && (
            <EmptyState
              icon={<ClipboardList className="w-8 h-8" />}
              title="No results yet"
              description="Results will appear as athletes complete this assignment."
              action={
                <button
                  onClick={() => setShowEntryModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors text-sm font-medium"
                >
                  <ClipboardEdit className="w-4 h-4" />
                  Enter Results
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* Results Entry Modal */}
      {showEntryModal && teamId && (
        <ResultsModalLoader
          assignmentId={assignmentId!}
          assignment={assignment}
          teamId={teamId}
          orgId={orgId}
          onClose={() => setShowEntryModal(false)}
          onComplete={() => {
            setShowEntryModal(false);
            load();
          }}
        />
      )}

      {/* CSV Import Modal */}
      <ImportCsvModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onComplete={() => {
          setShowImportModal(false);
          load();
        }}
        groupAssignmentId={assignmentId!}
        assignment={assignment}
        athletes={importAthletes}
        teamId={teamId!}
        orgId={orgId}
      />
    </>
  );
}

// ─── ResultsModalLoader ──────────────────────────────────────────────────────
// Fetches athletes + current userId then renders the entry modal

function ResultsModalLoader({
  assignmentId,
  assignment,
  teamId,
  orgId,
  onClose,
  onComplete,
}: {
  assignmentId: string;
  assignment: GroupAssignment;
  teamId: string;
  orgId?: string | null;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const athletePromise = assignment.org_id && orgId
      ? getOrgAthletes(orgId)
      : getAthletes(teamId);
    Promise.all([
      athletePromise,
      supabase.auth.getUser().then(({ data }) => data.user?.id ?? null),
    ]).then(([aths, uid]) => {
      // Exclude coxswain-sided athletes — they don't erg
      setAthletes(aths.filter((a) => a.side !== 'coxswain'));
      setUserId(uid);
    });
  }, [teamId, orgId, assignment.org_id]);

  if (!athletes.length || !userId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <ResultsEntryModal
      groupAssignmentId={assignmentId}
      assignment={assignment}
      athletes={athletes}
      teamId={teamId}
      orgId={orgId}
      userId={userId}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
}
