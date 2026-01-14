import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ZONES, classifyWorkout, formatSplit, wattsToSplit } from '../../utils/zones';
import type { TrainingZone } from '../../utils/zones';
import { calculateLinearRegression } from '../../utils/math';
import { Filter } from 'lucide-react';

interface Props {
    workouts: any[];
    baselineWatts: number;
}

export const ZonePaceTrendChart: React.FC<Props> = ({ workouts, baselineWatts }) => {
    const [selectedZone, setSelectedZone] = useState<TrainingZone>('UT2');
    const navigate = useNavigate();

    const chartData = useMemo(() => {
        if (!baselineWatts) return [];

        return workouts
            .map(w => {
                let watts = w.watts;
                if (!watts && w.distance_meters) {
                    const sec = w.duration_seconds || (w.duration_minutes ? w.duration_minutes * 60 : 0);

                    if (sec > 0) {
                        const split = 500 * (sec / w.distance_meters);
                        watts = 2.8 / Math.pow(split / 500, 3);
                    }
                }
                if (!watts) return null;

                const zone = classifyWorkout(watts, baselineWatts);
                if (zone !== selectedZone) return null;

                // Calculate Split (Seconds)
                const splitSeconds = wattsToSplit(watts);

                return {
                    id: w.id,
                    date: new Date(w.completed_at).getTime(), // Numeric for XAxis types
                    rawDate: w.completed_at,
                    splitSeconds,
                    distance: w.distance_meters,
                    workoutName: w.workout_name,
                    bpm: w.heart_rate?.average
                };
            })
            .filter((w): w is NonNullable<typeof w> => w !== null)
            .sort((a, b) => a.date - b.date);
    }, [workouts, baselineWatts, selectedZone]);

    // Calculate Trend Line
    const trendData = useMemo(() => {
        const points = chartData.map(d => ({ x: d.date, y: d.splitSeconds }));
        const trend = calculateLinearRegression(points);
        if (!trend) return [];
        return trend.map(p => ({ date: p.x, trendSeconds: p.y }));
    }, [chartData]);


    // Determine Y-Axis domain (Min/Max split) to zoom in
    const minSplit = Math.min(...chartData.map(d => d.splitSeconds)) - 5;
    const maxSplit = Math.max(...chartData.map(d => d.splitSeconds)) + 5;

    const currentZoneColor = ZONES.find(z => z.id === selectedZone)?.color || '#fff';

    const CustomTooltip = ({ active, payload, label }: any) => {

        if (active && payload && payload.length) {
            // Find the payload item that is the actual data point (not the trend line)
            const dataPoint = payload.find((p: any) => p.dataKey === 'splitSeconds');
            if (!dataPoint) return null;

            const data = dataPoint.payload;

            return (
                <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg shadow-xl text-xs space-y-1">
                    <p className="text-neutral-400 font-medium mb-2">
                        {new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {data.workoutName && (
                        <p className="text-white font-bold text-sm">{data.workoutName}</p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-neutral-500">Split:</span>
                        <span className="font-mono text-emerald-400">{formatSplit(data.splitSeconds)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-neutral-500">Distance:</span>
                        <span className="text-white">{data.distance.toLocaleString()}m</span>
                    </div>
                    {data.bpm && (
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-neutral-500">HR:</span>
                            <span className="text-red-400">{data.bpm} bpm</span>
                        </div>
                    )}
                    <div className="mt-2 text-[10px] text-neutral-600 italic">Click to view details</div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 h-[500px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Filter size={18} className="text-indigo-400" />
                        Pace Trends: <span style={{ color: currentZoneColor }}>{selectedZone}</span>
                    </h3>
                    <p className="text-xs text-neutral-500">Are you getting faster at the same intensity?</p>
                </div>

                {/* Zone Selector */}
                <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                    {ZONES.map(z => (
                        <button
                            key={z.id}
                            onClick={() => setSelectedZone(z.id)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${selectedZone === z.id
                                ? 'bg-neutral-800 text-white shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                        >
                            {z.id}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
                        No {selectedZone} workouts found in this period.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis
                                dataKey="date"
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(unix) => new Date(unix).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                                stroke="#525252"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDuplicatedCategory={false}
                            />
                            <YAxis
                                stroke="#525252"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                domain={[minSplit, maxSplit]}
                                reversed={true}
                                tickFormatter={(val) => formatSplit(val)}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            {/* Trend Line (Behind data) */}
                            {trendData.length === 2 && (
                                <Line
                                    data={trendData}
                                    type="linear"
                                    dataKey="trendSeconds"
                                    stroke={currentZoneColor}
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    opacity={0.5}
                                    dot={false}
                                    activeDot={false}
                                    isAnimationActive={false}
                                />
                            )}

                            <Line // Actual Data
                                data={chartData}
                                type="monotone"
                                dataKey="splitSeconds"
                                stroke={currentZoneColor}
                                strokeWidth={2}
                                dot={{ r: 3, fill: currentZoneColor, strokeWidth: 0, style: { cursor: 'pointer' } }}
                                activeDot={{
                                    r: 6,
                                    style: { cursor: 'pointer' },
                                    onClick: (_: any, payload: any) => {
                                        if (payload?.payload?.id) {
                                            navigate(`/workout/${payload.payload.id}`);
                                        }
                                    }
                                }}
                                animationDuration={500}
                                connectNulls
                            />
                            <Brush
                                dataKey="date"
                                height={30}
                                stroke="#525252"
                                fill="#171717"
                                tickFormatter={(unix: number) => new Date(unix).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                travellerWidth={10}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};
