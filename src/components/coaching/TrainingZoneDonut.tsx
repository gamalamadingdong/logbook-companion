import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';

interface ZoneData {
  zone: string;
  count: number;
  [key: string]: unknown;
}

interface Props {
  /** Array of training_zone values from assignments (may include nulls) */
  zones: (string | null | undefined)[];
}

const ZONE_COLORS: Record<string, string> = {
  UT2: '#10b981', // emerald
  UT1: '#3b82f6', // blue
  AT: '#f59e0b',  // amber
  TR: '#f97316',  // orange
  AN: '#ef4444',  // red
};

const ZONE_LABELS: Record<string, string> = {
  UT2: 'UT2 — Steady State',
  UT1: 'UT1 — Endurance',
  AT: 'AT — Anaerobic Threshold',
  TR: 'TR — Transportation',
  AN: 'AN — Anaerobic',
};

const UNSET_COLOR = '#404040';

export function TrainingZoneDonut({ zones }: Props) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const z of zones) {
      const key = z ?? 'Unset';
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    // Fixed order
    const order = ['UT2', 'UT1', 'AT', 'TR', 'AN', 'Unset'];
    const result: ZoneData[] = [];
    for (const zone of order) {
      const count = counts.get(zone);
      if (count) result.push({ zone, count });
    }
    return result;
  }, [zones]);

  if (zones.length === 0) return null;

  const total = zones.length;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-neutral-400">Training Zone Distribution</h3>
      <div className="flex items-center gap-4">
        <div className="w-[160px] h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="zone"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.zone}
                    fill={ZONE_COLORS[entry.zone] ?? UNSET_COLOR}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as ZoneData;
                  const pct = ((d.count / total) * 100).toFixed(0);
                  return (
                    <div className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 shadow-xl text-xs">
                      <span className="font-semibold" style={{ color: ZONE_COLORS[d.zone] ?? '#999' }}>
                        {ZONE_LABELS[d.zone] ?? d.zone}
                      </span>
                      <div className="text-neutral-400 mt-0.5">
                        {d.count} workout{d.count !== 1 ? 's' : ''} ({pct}%)
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {data.map((d) => {
            const pct = ((d.count / total) * 100).toFixed(0);
            return (
              <div key={d.zone} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ZONE_COLORS[d.zone] ?? UNSET_COLOR }}
                />
                <span className="text-neutral-300 font-medium min-w-[28px]">
                  {d.zone === 'Unset' ? '—' : d.zone}
                </span>
                <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: ZONE_COLORS[d.zone] ?? UNSET_COLOR,
                    }}
                  />
                </div>
                <span className="text-neutral-500 min-w-[32px] text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
