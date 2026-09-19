import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { getTotalTrainingDistanceMeters, type TrainingDistanceFields } from '../../utils/workoutDistance';

interface WeeklyVolumeSparklineProps {
    workouts: Array<{ completed_at: string } & TrainingDistanceFields>;
}

interface WeekBucket {
    weekLabel: string;
    meters: number;
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1; // Monday-based weeks
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function buildWeekBuckets(workouts: Array<{ completed_at: string } & TrainingDistanceFields>): WeekBucket[] {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const weeks: WeekBucket[] = [];

    for (let i = 7; i >= 0; i--) {
        const start = new Date(currentWeekStart);
        start.setDate(start.getDate() - i * 7);
        const label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        weeks.push({ weekLabel: label, meters: 0 });
    }

    for (const w of workouts) {
        const wDate = new Date(w.completed_at);
        const wWeekStart = getWeekStart(wDate);

        for (let i = 0; i < weeks.length; i++) {
            const bucketStart = new Date(currentWeekStart);
            bucketStart.setDate(bucketStart.getDate() - (7 - i) * 7);
            const bucketEnd = new Date(bucketStart);
            bucketEnd.setDate(bucketEnd.getDate() + 7);

            if (wWeekStart.getTime() === bucketStart.getTime()) {
                weeks[i].meters += getTotalTrainingDistanceMeters(w);
                break;
            }
        }
    }

    return weeks;
}

function formatMeters(m: number): string {
    if (m >= 1000) return `${(m / 1000).toFixed(1)}k`;
    return `${m}`;
}

export const WeeklyVolumeSparkline: React.FC<WeeklyVolumeSparklineProps> = ({ workouts }) => {
    const weeks = useMemo(() => buildWeekBuckets(workouts), [workouts]);

    const currentWeek = weeks[weeks.length - 1];
    const lastWeek = weeks[weeks.length - 2];

    let pctChange: number | null = null;
    let changeLabel = '';
    if (lastWeek && lastWeek.meters > 0) {
        pctChange = ((currentWeek.meters - lastWeek.meters) / lastWeek.meters) * 100;
        const arrow = pctChange >= 0 ? '↑' : '↓';
        changeLabel = `${arrow}${Math.abs(Math.round(pctChange))}% vs last week`;
    } else if (currentWeek.meters > 0) {
        changeLabel = 'No data last week';
    }

    const changeColor =
        pctChange === null
            ? 'text-neutral-500'
            : pctChange >= 0
              ? 'text-emerald-500'
              : 'text-rose-500';

    return (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                    <TrendingUp size={18} className="text-emerald-500" />
                </div>
                <span className="text-sm text-neutral-400 font-medium">Weekly Volume</span>
            </div>

            <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={weeks} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <defs>
                        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="meters"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#sparkFill)"
                        dot={false}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>

            <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">
                    {formatMeters(currentWeek.meters)}m
                </span>
                {changeLabel && (
                    <span className={`text-xs ${changeColor}`}>{changeLabel}</span>
                )}
            </div>
        </div>
    );
};
