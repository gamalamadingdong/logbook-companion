/**
 * AssignmentResults.tsx
 *
 * Full-page results review for a single group assignment.
 * Shows a summary table + context-aware charts depending on workout type:
 *
 *  steady_state / distance_interval / time_interval:
 *    - Sorted bar chart (split, watts, W/kg where weight known)
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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
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
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import { CoachingNav } from '../../components/coaching/CoachingNav';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import {
  getGroupAssignments,
  getAssignmentResultsWithAthletes,
  getAthletes,
  type GroupAssignment,
  type AssignmentResultRow,
  type IntervalResult,
} from '../../services/coaching/coachingService';
import type { CoachingAthlete } from '../../services/coaching/types';
import { splitToWatts, formatSplit } from '../../utils/zones';
import { parseWorkoutStructureForEntry } from '../../utils/workoutEntryClassifier';
import { ResultsEntryModal } from './CoachingAssignments';
import { supabase } from '../../services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = 'name' | 'split' | 'watts' | 'wpkg' | 'distance' | 'time' | 'stroke_rate' | 'consistency';
type SortDir = 'asc' | 'desc';

interface EnrichedRow extends AssignmentResultRow {
  /** Average split across all completed reps, or top-level split (seconds/500m) */
  avg_split_seconds: number | null;
  /** Watts derived from avg split */
  watts: number | null;
  /** W/kg — null when weight_kg is missing */
  wpkg: number | null;
  /** Std-dev of per-rep split values (consistency score, lower = better) */
  consistency_sigma: number | null;
  /** Rep splits in order, from result_intervals */
  rep_splits: (number | null)[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function fmtWpkg(w: number | null | undefined): string {
  if (w == null || w <= 0) return '—';
  return `${w.toFixed(2)} W/kg`;
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

function enrichRows(rows: AssignmentResultRow[]): EnrichedRow[] {
  return rows.map((row) => {
    const avg_split_seconds = calcAvgSplit(row);
    const watts = avg_split_seconds ? Math.round(splitToWatts(avg_split_seconds)) : null;
    const wpkg =
      watts !== null && row.weight_kg && row.weight_kg > 0
        ? watts / row.weight_kg
        : null;
    const rep_splits = calcRepSplits(row);
    const consistency_sigma = calcSigma(rep_splits);
    return { ...row, avg_split_seconds, watts, wpkg, consistency_sigma, rep_splits };
  });
}

/** Compute percentile rank 0–100 for a value in a sorted ascending array */
function percentileOf(val: number, sorted: number[]): number {
  if (sorted.length === 0) return 50;
  const below = sorted.filter((v) => v < val).length;
  return Math.round((below / sorted.length) * 100);
}

// Distinct colors for athlete lines
const LINE_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e',
  '#a78bfa', '#34d399', '#fb923c', '#60a5fa', '#e879f9',
  '#4ade80', '#fbbf24', '#38bdf8', '#f472b6', '#a3e635',
];

// ─── Chart: Split Bar ─────────────────────────────────────────────────────────

function SplitBarChart({ rows }: { rows: EnrichedRow[] }) {
  const data = [...rows]
    .filter((r) => r.completed && r.avg_split_seconds != null)
    .sort((a, b) => (a.avg_split_seconds ?? 999) - (b.avg_split_seconds ?? 999))
    .map((r, i) => ({
      name: r.athlete_name.split(' ')[0], // first name to save space
      split: r.avg_split_seconds ?? 0,
      splitLabel: fmtSplit(r.avg_split_seconds),
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
            formatter={(v: number | undefined) => [fmtSplit(v ?? 0), 'Split']}
            labelStyle={{ color: '#e5e7eb' }}
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
  );
}

// ─── Chart: Watts Bar ─────────────────────────────────────────────────────────

function WattsBarChart({ rows }: { rows: EnrichedRow[] }) {
  const data = [...rows]
    .filter((r) => r.completed && r.watts != null)
    .sort((a, b) => (b.watts ?? 0) - (a.watts ?? 0))
    .map((r, i) => ({
      name: r.athlete_name.split(' ')[0],
      watts: r.watts ?? 0,
      rank: i + 1,
    }));

  if (data.length === 0) return null;

  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-amber-400" />
        Watts (higher = better)
      </h3>
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
            formatter={(v: number | undefined) => [`${v ?? 0}W`, 'Watts']}
            labelStyle={{ color: '#e5e7eb' }}
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
  );
}

// ─── Chart: W/kg Bar ──────────────────────────────────────────────────────────

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

  const withWeight = rows.filter((r) => r.completed && r.weight_kg);
  const missing = rows.filter((r) => r.completed && !r.weight_kg);

  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          W/kg — Power-to-Weight (higher = better)
        </h3>
        {missing.length > 0 && (
          <span className="text-xs text-neutral-500">
            {missing.length} athlete{missing.length > 1 ? 's' : ''} missing weight
          </span>
        )}
      </div>
      {withWeight.length > 0 ? (
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
              formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(2)} W/kg`, 'W/kg']}
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
      ) : (
        <p className="text-sm text-neutral-500 text-center py-6">
          No athlete weights recorded — add them in the roster to enable this chart.
        </p>
      )}
    </div>
  );
}

// ─── Chart: Percentile Dot Plot ───────────────────────────────────────────────

function PercentileDotPlot({ rows }: { rows: EnrichedRow[] }) {
  const completed = rows.filter((r) => r.completed && r.avg_split_seconds != null);
  if (completed.length < 3) return null;

  // Lower split = faster = higher percentile rank
  const splits = completed.map((r) => r.avg_split_seconds!).sort((a, b) => a - b);

  const data = completed
    .map((r) => ({
      name: r.athlete_name.split(' ')[0],
      fullName: r.athlete_name,
      // percentile for split (lower is faster → higher percentile)
      pctile: 100 - percentileOf(r.avg_split_seconds!, splits),
      split: r.avg_split_seconds,
      cx: 100 - percentileOf(r.avg_split_seconds!, splits),
    }))
    .sort((a, b) => b.pctile - a.pctile);

  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">Percentile Spread</h3>
      <p className="text-xs text-neutral-500">Higher = faster. P25 / P50 / P75 reference lines shown.</p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 28)}>
        <ScatterChart margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis
            type="number"
            dataKey="cx"
            name="Percentile"
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => `P${v}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#d1d5db', fontSize: 11 }}
            width={72}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as { fullName: string; pctile: number; split: number };
              return (
                <div className="p-2 text-xs text-neutral-200">
                  <div className="font-semibold">{d.fullName}</div>
                  <div>Split: {fmtSplit(d.split)}</div>
                  <div>P{d.pctile} in this group</div>
                </div>
              );
            }}
          />
          <ReferenceLine x={25} stroke="#6b7280" strokeDasharray="4 2" label={{ value: 'P25', fill: '#6b7280', fontSize: 10 }} />
          <ReferenceLine x={50} stroke="#9ca3af" strokeDasharray="4 2" label={{ value: 'P50', fill: '#9ca3af', fontSize: 10 }} />
          <ReferenceLine x={75} stroke="#d1d5db" strokeDasharray="4 2" label={{ value: 'P75', fill: '#d1d5db', fontSize: 10 }} />
          <Scatter data={data} fill="#6366f1">
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.pctile >= 75 ? '#10b981' : d.pctile >= 50 ? '#6366f1' : d.pctile >= 25 ? '#f59e0b' : '#f43f5e'}
                r={6}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
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
  const withReps = rows.filter((r) => r.completed && r.rep_splits.length > 0);
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
        formatter={(v: number | undefined, name: string | undefined) => [fmtSplit(v ?? 0), (name ?? '').split(' ')[0]]}
        labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
      />
      <Legend
        wrapperStyle={{ fontSize: height > 400 ? 13 : 11, color: '#9ca3af' }}
        formatter={(name: string) => name.split(' ')[0]}
      />
      {withReps.map((row, i) => (
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
        <ResponsiveContainer width="100%" height={280}>
          {chartContent(280)}
        </ResponsiveContainer>
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
              title="Close"
              className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 bg-neutral-900 rounded-xl p-4">
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

function RepHeatmap({
  rows,
  repLabels,
}: {
  rows: EnrichedRow[];
  repLabels: string[];
}) {
  const withReps = rows.filter((r) => r.completed && r.rep_splits.some((v) => v != null));
  if (withReps.length === 0 || repLabels.length === 0) return null;

  // Per-rep: compute team median to use for relative coloring
  const repMedians = repLabels.map((_, repIdx) => {
    const vals = withReps
      .map((r) => r.rep_splits[repIdx])
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (vals.length === 0) return null;
    return vals[Math.floor(vals.length / 2)];
  });

  function cellColor(split: number | null, median: number | null): string {
    if (split == null || median == null) return 'bg-neutral-700/30';
    const pct = (split - median) / median; // positive = slower, negative = faster
    if (pct < -0.03) return 'bg-emerald-500/70'; // >3% faster than median
    if (pct < -0.01) return 'bg-emerald-500/40';
    if (pct < 0.01) return 'bg-neutral-600/50';   // within 1%
    if (pct < 0.03) return 'bg-amber-500/40';
    return 'bg-red-500/60';                        // >3% slower than median
  }

  function cellText(split: number | null): string {
    return fmtSplit(split);
  }

  const sorted = [...withReps].sort(
    (a, b) => (a.avg_split_seconds ?? 999) - (b.avg_split_seconds ?? 999)
  );

  return (
    <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">Rep Heatmap — vs. Team Median</h3>
      <div className="flex items-center gap-3 text-[10px] text-neutral-400">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-500/70" /> &gt;3% faster</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-neutral-600/50" /> ±1% median</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-500/40" /> &gt;1% slower</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500/60" /> &gt;3% slower</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-neutral-900/80 text-left px-3 py-2 text-neutral-500 font-medium">
                Athlete
              </th>
              {repLabels.map((label, i) => (
                <th key={i} className="px-2 py-2 text-center text-neutral-400 font-medium min-w-[64px]">
                  {label}
                </th>
              ))}
              <th className="px-2 py-2 text-center text-neutral-400 font-medium">σ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.athlete_id}>
                <td className="sticky left-0 bg-neutral-900/80 px-3 py-1.5 text-neutral-200 whitespace-nowrap border-t border-neutral-800/30">
                  {row.athlete_name}
                </td>
                {repLabels.map((_, repIdx) => {
                  const split = row.rep_splits[repIdx] ?? null;
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
                  {row.consistency_sigma != null ? `±${fmtSplit(row.consistency_sigma)}` : '—'}
                </td>
              </tr>
            ))}
            {/* Median row */}
            <tr className="bg-neutral-800/30">
              <td className="sticky left-0 bg-neutral-800/60 px-3 py-1.5 text-neutral-500 font-semibold text-[10px] uppercase">
                Median
              </td>
              {repMedians.map((med, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-neutral-500 font-mono border-t border-neutral-700/50">
                  {fmtSplit(med)}
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

// ─── Summary Table ────────────────────────────────────────────────────────────

function SummaryTable({
  rows,
  isInterval,
  onEdit,
}: {
  rows: EnrichedRow[];
  isInterval: boolean;
  onEdit: () => void;
}) {
  const [sortField, setSortField] = useState<SortField>('split');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
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
        case 'consistency': av = a.consistency_sigma; bv = b.consistency_sigma; break;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

  // Assign rank by split (only among completed rows)
  const completedBySplit = [...sorted]
    .filter((r) => r.completed && r.avg_split_seconds != null)
    .sort((a, b) => (a.avg_split_seconds ?? 999) - (b.avg_split_seconds ?? 999));
  const rankMap = new Map(completedBySplit.map((r, i) => [r.athlete_id, i + 1]));

  const hasWpkg = sorted.some((r) => r.wpkg != null);

  return (
    <div className="bg-neutral-800/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50">
        <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" /> Results Summary
        </h3>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
        >
          <ClipboardEdit className="w-3.5 h-3.5" />
          Enter / Edit Results
        </button>
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
              {hasWpkg && <SortTh label="W/kg" field="wpkg" sortField={sortField} onSort={toggleSort} />}
              <SortTh label="Distance" field="distance" sortField={sortField} onSort={toggleSort} />
              <SortTh label="Time" field="time" sortField={sortField} onSort={toggleSort} />
              <SortTh label="SR" field="stroke_rate" sortField={sortField} onSort={toggleSort} />
              {isInterval && <SortTh label="σ Splits" field="consistency" sortField={sortField} onSort={toggleSort} />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const rank = rankMap.get(row.athlete_id);
              return (
                <tr
                  key={row.athlete_id}
                  className={`border-b border-neutral-800/30 hover:bg-neutral-700/20 transition-colors ${
                    !row.completed ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-neutral-500 text-xs">
                    {rank ? (
                      <span
                        className={`font-semibold ${
                          rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-neutral-300' : rank === 3 ? 'text-amber-700' : 'text-neutral-500'
                        }`}
                      >
                        {rank}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-neutral-200 whitespace-nowrap">
                    <div>{row.athlete_name}</div>
                    {row.squad && <div className="text-[10px] text-neutral-500">{row.squad}</div>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-neutral-600 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtSplit(row.avg_split_seconds)}</td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtWatts(row.watts)}</td>
                  {hasWpkg && <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtWpkg(row.wpkg)}</td>}
                  <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtDist(row.result_distance_meters)}</td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-200">{fmtTime(row.result_time_seconds)}</td>
                  <td className="px-3 py-2 text-right text-neutral-200">{row.result_stroke_rate ?? '—'}</td>
                  {isInterval && (
                    <td className="px-3 py-2 text-right font-mono text-neutral-400 text-xs">
                      {row.consistency_sigma != null ? `±${fmtSplit(row.consistency_sigma)}` : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AssignmentResults() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { teamId, isLoadingTeam } = useCoachingContext();

  const [assignment, setAssignment] = useState<GroupAssignment | null>(null);
  const [rawRows, setRawRows] = useState<AssignmentResultRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [squadFilter, setSquadFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!teamId || !assignmentId) return;
    setIsLoading(true);
    try {
      const [assignments, rows] = await Promise.all([
        getGroupAssignments(teamId, {}),
        getAssignmentResultsWithAthletes(assignmentId, teamId),
      ]);
      const found = assignments.find((a) => a.id === assignmentId);
      if (!found) {
        toast.error('Assignment not found');
        navigate('/team-management/assignments');
        return;
      }
      setAssignment(found);
      setRawRows(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, assignmentId, navigate]);

  useEffect(() => {
    if (!isLoadingTeam) load();
  }, [isLoadingTeam, load]);

  // Enrich rows with derived metrics
  const allRows = useMemo(() => enrichRows(rawRows), [rawRows]);

  // Squads available in this assignment
  const squads = useMemo(() => {
    const set = new Set<string>();
    rawRows.forEach((r) => { if (r.squad) set.add(r.squad); });
    return Array.from(set).sort();
  }, [rawRows]);

  // Filtered view (squad pill selection)
  const rows = useMemo(
    () => squadFilter === 'all' ? allRows : allRows.filter((r) => r.squad === squadFilter),
    [allRows, squadFilter],
  );

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

  const completedCount = rows.filter((r) => r.completed).length;
  const totalCount = allRows.length;
  const filteredTotal = rows.length;

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
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* ── Header ── */}
          <div className="space-y-1">
            <Link
              to="/team-management/assignments"
              className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-indigo-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Assignments
            </Link>

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
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-100">{completedCount}</div>
                  <div className="text-xs text-neutral-500">of {squadFilter === 'all' ? totalCount : filteredTotal} completed</div>
                </div>
                <div className="w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#374151" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={completedCount === totalCount ? '#10b981' : '#6366f1'}
                      strokeWidth="3"
                      strokeDasharray={`${totalCount > 0 ? (completedCount / totalCount) * 100 : 0} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {assignment.instructions && (
              <p className="text-sm text-neutral-400 mt-1">{assignment.instructions}</p>
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

          {/* ── Missing athletes notice ── */}
          {(() => {
            const missing = rows.filter((r) => !r.completed);
            if (missing.length === 0) return null;
            return (
              <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 text-sm text-amber-300">
                <span className="font-semibold">Not yet completed:</span>{' '}
                {missing.map((r) => r.athlete_name).join(', ')}
              </div>
            );
          })()}

          {/* ── Summary Table ── */}
          <SummaryTable
            rows={rows}
            isInterval={isInterval}
            onEdit={() => setShowEntryModal(true)}
          />

          {/* ── Charts ── */}
          {completedCount > 0 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-neutral-300 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Charts
              </h2>

              {/* Bar charts (1-2 per row on wider screens) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SplitBarChart rows={rows} />
                <WattsBarChart rows={rows} />
                <WpkgBarChart rows={rows} />
                <PercentileDotPlot rows={rows} />
              </div>

              {/* Interval-specific charts (full-width) */}
              {isInterval && repLabels.length > 0 && (
                <div className="space-y-5">
                  <RepProgressionChart rows={rows} repLabels={repLabels} />
                  <RepHeatmap rows={rows} repLabels={repLabels} />
                </div>
              )}
            </div>
          )}

          {completedCount === 0 && (
            <div className="text-center py-16 space-y-3">
              <BarChart3 className="w-12 h-12 mx-auto opacity-20" />
              <p className="text-neutral-500">No results recorded yet.</p>
              <button
                onClick={() => setShowEntryModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors text-sm font-medium"
              >
                <ClipboardEdit className="w-4 h-4" />
                Enter Results
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results Entry Modal */}
      {showEntryModal && teamId && (
        <ResultsModalLoader
          assignmentId={assignmentId!}
          assignment={assignment}
          teamId={teamId}
          onClose={() => setShowEntryModal(false)}
          onComplete={() => {
            setShowEntryModal(false);
            load();
          }}
        />
      )}
    </>
  );
}

// ─── ResultsModalLoader ──────────────────────────────────────────────────────
// Fetches athletes + current userId then renders the entry modal

function ResultsModalLoader({
  assignmentId,
  assignment,
  teamId,
  onClose,
  onComplete,
}: {
  assignmentId: string;
  assignment: GroupAssignment;
  teamId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    Promise.all([
      getAthletes(teamId),
      supabase.auth.getUser().then(({ data }) => data.user?.id ?? null),
    ]).then(([aths, uid]) => {
      setAthletes(aths);
      setUserId(uid);
    });
  }, [teamId]);

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
      userId={userId}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
}
