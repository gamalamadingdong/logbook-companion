import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import type { GroupAssignment, ComplianceCell } from '../../services/coaching/coachingService';

interface Props {
  assignments: GroupAssignment[];
  cells: ComplianceCell[];
  athleteCount: number;
}

interface WeekPoint {
  weekLabel: string;
  weekStart: string;
  assigned: number;
  completed: number;
  rate: number;
  workouts: number;
}

export function ComplianceTrendChart({ assignments, cells, athleteCount }: Props) {
  const weeklyData = useMemo((): WeekPoint[] => {
    if (assignments.length === 0) return [];

    // Build cell lookup: `${athlete_id}:${assignment_id}` → completed
    const cellMap = new Map<string, boolean>();
    for (const c of cells) {
      cellMap.set(`${c.athlete_id}:${c.group_assignment_id}`, c.completed);
    }

    // Group assignments by week (Mon-start)
    const weekMap = new Map<string, GroupAssignment[]>();
    for (const a of assignments) {
      const ws = startOfWeek(parseISO(a.scheduled_date), { weekStartsOn: 1 });
      const key = ws.toISOString().slice(0, 10);
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(a);
    }

    // Compute per-week compliance
    const points: WeekPoint[] = [];
    for (const [weekStart, weekAssignments] of [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      let assigned = 0;
      let completed = 0;

      for (const a of weekAssignments) {
        // Count cells (athlete × assignment pairs) for this assignment
        for (const c of cells) {
          if (c.group_assignment_id === a.id) {
            assigned++;
            if (c.completed) completed++;
          }
        }
      }

      const ws = parseISO(weekStart);
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const weekLabel = `${format(ws, 'MMM d')}–${format(we, 'd')}`;

      points.push({
        weekLabel,
        weekStart,
        assigned,
        completed,
        rate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
        workouts: weekAssignments.length,
      });
    }

    return points;
  }, [assignments, cells]);

  if (weeklyData.length === 0) {
    return null;
  }

  // Overall compliance
  const totalAssigned = weeklyData.reduce((s, w) => s + w.assigned, 0);
  const totalCompleted = weeklyData.reduce((s, w) => s + w.completed, 0);
  const overallRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
  const totalWorkouts = weeklyData.reduce((s, w) => s + w.workouts, 0);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold tabular-nums ${
            overallRate >= 80 ? 'text-emerald-600 dark:text-emerald-400'
              : overallRate >= 50 ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {overallRate}%
          </span>
          <div>
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Overall Compliance</div>
            <div className="text-[11px] text-neutral-500">
              {totalCompleted}/{totalAssigned} completed · {totalWorkouts} workouts · {athleteCount} athletes
            </div>
          </div>
        </div>
        {/* Mini progress bar */}
        <div className="hidden sm:block w-28">
          <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                overallRate >= 80 ? 'bg-emerald-500'
                  : overallRate >= 50 ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${overallRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chart */}
      {weeklyData.length >= 2 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="complianceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary, #374151)" opacity={0.4} />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 10, fill: 'var(--color-text-tertiary, #9ca3af)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'var(--color-text-tertiary, #9ca3af)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface-secondary, #1f2937)',
                  border: '1px solid var(--color-border-primary, #374151)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--color-text-primary, #e5e7eb)',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, _name: any, props: any) => {
                  const w = props.payload as WeekPoint;
                  return [`${value ?? 0}% (${w.completed}/${w.assigned})`, 'Compliance'];
                }}
                labelFormatter={(label: string) => label}
              />
              <ReferenceLine y={80} stroke="#34d399" strokeDasharray="4 4" opacity={0.5} />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#818cf8"
                strokeWidth={2}
                fill="url(#complianceFill)"
                dot={{ r: 3, fill: '#818cf8', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#818cf8', strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
