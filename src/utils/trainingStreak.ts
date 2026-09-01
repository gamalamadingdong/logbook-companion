interface CompletedWorkout {
    completed_at: string;
}

interface TrainingStreak {
    streak: number;
    lastWorkoutDate: Date | null;
}

function toDateStr(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function computeStreak(workouts: CompletedWorkout[]): TrainingStreak {
    if (workouts.length === 0) return { streak: 0, lastWorkoutDate: null };

    const uniqueDays = new Set(
        workouts.map(w => {
            const d = new Date(w.completed_at);
            return toDateStr(d);
        })
    );

    const sorted = Array.from(uniqueDays).sort().reverse();
    if (sorted.length === 0) return { streak: 0, lastWorkoutDate: null };

    const lastWorkoutDate = new Date(sorted[0] + 'T00:00:00');
    const today = new Date();
    const todayStr = toDateStr(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateStr(yesterday);

    if (sorted[0] !== todayStr && sorted[0] !== yesterdayStr) {
        return { streak: 0, lastWorkoutDate };
    }

    let streak = 1;
    let cursor = new Date(sorted[0] + 'T00:00:00');

    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(cursor);
        prev.setDate(prev.getDate() - 1);
        if (sorted[i] === toDateStr(prev)) {
            streak++;
            cursor = prev;
        } else {
            break;
        }
    }

    return { streak, lastWorkoutDate };
}
