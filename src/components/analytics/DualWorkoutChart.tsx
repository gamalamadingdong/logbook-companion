import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { C2Stroke } from '../../api/concept2.types';

interface DualWorkoutChartProps {
    workoutA: any;
    strokesA: C2Stroke[];
    workoutB: any;
    strokesB: C2Stroke[];
    metric?: 'watts' | 'pace' | 'rate' | 'hr';
}

export const DualWorkoutChart: React.FC<DualWorkoutChartProps> = ({
    workoutA,
    strokesA,
    workoutB,
    strokesB,
    metric = 'watts'
}) => {
    // 1. Determine X-Axis Basis (Distance or Time)
    // For rowing, Distance is usually the best normalizer unless it's a fixed time pieces.
    // Let's default to Distance.
    const axis = 'distance';

    // 2. Prepare Data
    // We need a single array of objects for Recharts if we want a shared tooltip easily, 
    // OR we can use two Lines with different data sources if Recharts 2.x supports it (it usually wants unified data).
    // Unified data approach: "Data Points" are derived from the higher resolution stroke set?
    // Actually, simple way: Merge stroke arrays into a normalized list?
    // Or just Map one set to the other's "Points"?

    // Better Recharts approach:
    // data = [ { x: 100, y1: 200, y2: 190 }, ... ]
    // But strokes happen at different distances.
    // We need to sample or interpolate? 
    // Or just union the X points.

    const combinedData: any[] = [];

    // Sort all unique X points
    const xPoints = new Set<number>();
    strokesA.forEach(s => xPoints.add(Math.round(s.d / 10))); // Decimeters -> Meters
    strokesB.forEach(s => xPoints.add(Math.round(s.d / 10)));

    const sortedX = Array.from(xPoints).sort((a, b) => a - b);

    // Helper to find value at X
    // (Simple nearest neighbor or find exact match, interpolation is better but strict match is easier)
    const findValue = (strokes: C2Stroke[], targetMeters: number) => {
        // Find stroke closest to this distance
        // Since sorted, we could optimize, but find is ok for <1000 items
        const match = strokes.find(s => Math.round(s.d / 10) === targetMeters);
        if (match) {
            if (metric === 'watts') return match.p / 10; // Watts are usually whole numbers but C2 uses specific units?
            // Actually `p` in stroke data:
            // 172 => 172 watts? Wait, in previous files we saw `p / 10`.
            // In `WorkoutDetail.tsx`: `watts: s.p / 10`
            return match.p / 10;
        }
        return null;
    };

    // Build Chart Data
    // Optimization: If datasets are huge, this is slow. 
    // But 2k row is ~200 strokes. 10k is ~1000. It's fine.
    sortedX.forEach(x => {
        combinedData.push({
            distance: x,
            [workoutA.id || 'A']: findValue(strokesA, x), // Use external_id or db_id as key?
            [workoutB.id || 'B']: findValue(strokesB, x),
            labelA: 'Base',
            labelB: 'Comparison'
        });
    });

    const formatX = (val: number) => {
        if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
        return `${val}m`;
    };

    return (
        <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis
                        dataKey="distance"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={formatX}
                        stroke="#525252"
                        tick={{ fill: '#737373', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        stroke="#525252"
                        tick={{ fill: '#737373', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040' }}
                        itemStyle={{ fontSize: '12px' }}
                        labelFormatter={(lbl) => `${lbl}m`}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey={workoutA.id || 'A'}
                        name={workoutA.workout_name || 'Base'}
                        stroke="#3b82f6" // Blue
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                    />
                    <Line
                        type="monotone"
                        dataKey={workoutB.id || 'B'}
                        name={workoutB.workout_name || 'Comparison'}
                        stroke="#10b981" // Emerald
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
