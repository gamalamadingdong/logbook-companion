import React, { useMemo } from 'react';
import { Flame, Calendar } from 'lucide-react';
import { computeStreak } from '../../utils/trainingStreak';

interface TrainingStreakWidgetProps {
    workouts: { completed_at: string }[];
}

function toDateStr(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const TrainingStreakWidget: React.FC<TrainingStreakWidgetProps> = ({ workouts }) => {
    const { streak, lastWorkoutDate } = useMemo(() => computeStreak(workouts), [workouts]);

    const todayStr = toDateStr(new Date());
    const isToday = lastWorkoutDate ? toDateStr(lastWorkoutDate) === todayStr : false;
    const Icon = streak >= 2 ? Flame : Calendar;
    const iconColor = streak >= 2 ? 'text-orange-500' : 'text-neutral-400';
    const iconBg = streak >= 2 ? 'bg-orange-500/10' : 'bg-neutral-800';

    const lastLabel = lastWorkoutDate
        ? isToday
            ? 'Today'
            : lastWorkoutDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'No workouts';

    return (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${iconBg}`}>
                <Icon size={24} className={iconColor} />
            </div>
            <div className="flex flex-col min-w-0">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-white">{streak}</span>
                    <span className="text-sm text-neutral-400">
                        {streak === 1 ? 'day streak' : 'days streak'}
                    </span>
                </div>
                <span className="text-xs text-neutral-500 truncate">
                    Last workout: {lastLabel}
                </span>
            </div>
        </div>
    );
};
