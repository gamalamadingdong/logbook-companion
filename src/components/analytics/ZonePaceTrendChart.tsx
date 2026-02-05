import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ZONES, classifyWorkout, formatSplit, wattsToSplit } from '../../utils/zones';

import { calculateLinearRegression, getLinearRegressionStats } from '../../utils/math';
import { Filter, ZoomOut, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
    workouts: any[];
    baselineWatts: number;
}

export const ZonePaceTrendChart: React.FC<Props> = ({ workouts, baselineWatts }) => {
    // State for Metric
    const [metric, setMetric] = useState<'pace' | 'watts'>('pace');

    // Zoom State
    const [left, setLeft] = useState<number | null>(null);
    const [right, setRight] = useState<number | null>(null);
    const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
    const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
    const navigate = useNavigate();

    const chartData = useMemo(() => {
        if (!baselineWatts) return [];

        return workouts
            .map(w => {
                let watts = w.watts;

                // 1. Try explicit average split (Most reliable for intervals, excludes rest)
                if (!watts && w.avg_split_500m) {
                    watts = 2.8 / Math.pow(w.avg_split_500m / 500, 3);
                }

                // 2. Fallback to Distance/Time (Includes rest time, less accurate for intervals)
                if (!watts && w.distance_meters) {
                    const sec = w.duration_seconds || (w.duration_minutes ? w.duration_minutes * 60 : 0);

                    if (sec > 0) {
                        const split = 500 * (sec / w.distance_meters);
                        watts = 2.8 / Math.pow(split / 500, 3);
                    }
                }
                if (!watts) return null;

                // Identify Zone
                const zoneId = classifyWorkout(watts, baselineWatts);
                const zoneColor = ZONES.find(z => z.id === zoneId)?.color || '#fff';
                const zoneLabel = ZONES.find(z => z.id === zoneId)?.label || 'Unknown';

                // Calculate Split (Seconds)
                const splitSeconds = wattsToSplit(watts);

                // Determine primary value based on metric
                const value = metric === 'pace' ? splitSeconds : Math.round(watts);

                return {
                    id: w.id,
                    date: new Date(w.completed_at).getTime(),
                    rawDate: w.completed_at,
                    splitSeconds,
                    watts: Math.round(watts),
                    value,
                    distance: w.distance_meters,
                    workoutName: w.workout_name,
                    bpm: w.heart_rate?.average,
                    zoneId,
                    zoneColor,
                    zoneLabel
                };
            })
            .filter((w): w is NonNullable<typeof w> => w !== null)
            .sort((a, b) => a.date - b.date);
    }, [workouts, baselineWatts, metric]);

    // Calculate Trend Line
    const trendData = useMemo(() => {
        // Calculate global trend for all displayed workouts
        const points = chartData.map(d => ({ x: d.date, y: d.value }));
        const trend = calculateLinearRegression(points);
        if (!trend) return [];
        return trend.map(p => ({ date: p.x, trendValue: p.y }));
    }, [chartData]);

    // Calculate Trend Metrics
    const trendMetrics = useMemo(() => {
        const points = chartData.map(d => ({ x: d.date, y: d.value }));
        const stats = getLinearRegressionStats(points);
        if (!stats) return null;

        // Convert slope (units/ms) to units/month
        const valPerMonth = stats.slope * (1000 * 60 * 60 * 24 * 30.44);

        let isImproving = false;
        if (metric === 'pace') {
            isImproving = valPerMonth < 0; // Lower split is better
        } else {
            isImproving = valPerMonth > 0; // Higher watts is better
        }

        return {
            changePerMonth: valPerMonth,
            isImproving
        };
    }, [chartData, metric]);


    // Determine Y-Axis domain (Min/Max) to zoom in
    const vals = chartData.map(d => d.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    // Add padding (5s for split, 20w for watts)
    const padding = metric === 'pace' ? 5 : 20;
    const yDomain: [number, number] = [Math.max(0, minVal - padding), maxVal + padding];

    const zoom = () => {
        if (refAreaLeft === refAreaRight || refAreaRight === null || refAreaLeft === null) {
            setRefAreaLeft(null);
            setRefAreaRight(null);
            return;
        }

        // Ensure correct order
        let [l, r] = [refAreaLeft, refAreaRight];
        if (l > r) [l, r] = [r, l];

        setLeft(l);
        setRight(r);
        setRefAreaLeft(null);
        setRefAreaRight(null);
    };

    const zoomOut = () => {
        setLeft(null);
        setRight(null);
        setRefAreaLeft(null);
        setRefAreaRight(null);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            // Find the payload item that is the actual data point (not the trend line)
            const dataPoint = payload.find((p: any) => p.dataKey === 'value');
            if (!dataPoint) return null;

            const data = dataPoint.payload;

            return (
                <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg shadow-xl text-sm space-y-1">
                    <p className="text-neutral-400 font-medium mb-2">
                        {new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {data.workoutName && (
                        <p className="text-white font-bold text-base">{data.workoutName}</p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-neutral-500">Pace:</span>
                        <span className={`font-mono ${metric === 'pace' ? 'text-emerald-400 font-bold' : 'text-neutral-300'}`}>
                            {formatSplit(data.splitSeconds)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-neutral-500">Power:</span>
                        <span className={`font-mono ${metric === 'watts' ? 'text-emerald-400 font-bold' : 'text-neutral-300'}`}>
                            {data.watts}w
                        </span>
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
                    <div className="mt-2 text-xs text-neutral-600 italic">Click to view details</div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 h-[500px] flex flex-col select-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Filter size={20} className="text-indigo-400" />
                        Pace Trend
                        <span className="text-neutral-500 text-sm font-normal">({chartData.length} workouts)</span>
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 mt-3">
                        {/* Metric Toggle */}
                        <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex">
                            {(['pace', 'watts'] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMetric(m)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${metric === m
                                        ? 'bg-neutral-800 text-white shadow-sm'
                                        : 'text-neutral-500 hover:text-neutral-300'
                                        }`}
                                >
                                    {m === 'pace' ? 'Split' : 'Watts'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-sm text-neutral-500 mt-2">
                        {left ? 'Zoomed View (Click Reset to Full)' : 'Click and drag to zoom'}
                    </p>
                </div>


                {trendMetrics && (
                    <div className="bg-neutral-800/50 rounded-lg px-4 py-2 border border-neutral-700/50 flex items-center gap-3">
                        <div className={`p-2 rounded-full ${Math.abs(trendMetrics.changePerMonth) < 0.1 ? 'bg-neutral-700 text-neutral-400' : trendMetrics.isImproving ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {Math.abs(trendMetrics.changePerMonth) < 0.1 ? <Minus size={20} /> :
                                trendMetrics.isImproving ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        </div>
                        <div>
                            <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Trend</div>
                            <div className={`text-base font-mono font-bold ${Math.abs(trendMetrics.changePerMonth) < 0.1 ? 'text-neutral-300' : trendMetrics.isImproving ? 'text-emerald-400' : 'text-red-400'}`}>
                                {Math.abs(trendMetrics.changePerMonth) < 0.1
                                    ? 'Flat'
                                    : metric === 'pace'
                                        ? `${Math.abs(trendMetrics.changePerMonth).toFixed(1)}s / mo`
                                        : `${Math.abs(trendMetrics.changePerMonth).toFixed(0)}w / mo`
                                }
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    {/* Zoom Out Button */}
                    {left && (
                        <button
                            onClick={zoomOut}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
                        >
                            <ZoomOut size={16} />
                            Reset Zoom
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
                        No workouts found in this period.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                            onMouseDown={(e: any) => e && setRefAreaLeft(e.activeLabel)}
                            onMouseMove={(e: any) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                            onMouseUp={zoom}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis
                                dataKey="date"
                                type="number"
                                allowDataOverflow
                                domain={left && right ? [left, right] : ['dataMin', 'dataMax']}
                                tickFormatter={(unix) => new Date(unix).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                                stroke="#525252"
                                fontSize={13}
                                tickLine={false}
                                axisLine={false}
                                allowDuplicatedCategory={false}
                            />
                            <YAxis
                                stroke="#525252"
                                fontSize={13}
                                tickLine={false}
                                axisLine={false}
                                domain={yDomain}
                                reversed={metric === 'pace'} // Reverse for pace (lower is better), Normal for watts
                                tickFormatter={(val) => metric === 'pace' ? formatSplit(val) : val}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            {/* Trend Line (Behind data) */}
                            {trendData.length === 2 && (
                                <Line
                                    data={trendData}
                                    type="linear"
                                    dataKey="trendValue"
                                    stroke="#ec4899" // Pink trend line (neutral)
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
                                dataKey="value"
                                stroke="#3b82f6" // Default blue
                                strokeWidth={2}
                                // Use custom dot component or just rely on payload color if Recharts supports it easily?
                                // Recharts doesn't support per-dot dynamic styling easily in `dot` prop unless it's a component.
                                // But `dot={{ fill: ... }}` applies to all. 
                                // We can use a customized dot function.
                                dot={(props: any) => {
                                    const { cx, cy, payload } = props;
                                    return (
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={3}
                                            fill={payload.zoneColor}
                                            strokeWidth={0}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    );
                                }}
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

                            {/* Selection Box */}
                            {refAreaLeft && refAreaRight ? (
                                <ReferenceArea
                                    x1={refAreaLeft}
                                    x2={refAreaRight}
                                    strokeOpacity={0.3}
                                    fill="#3b82f6"
                                    fillOpacity={0.1}
                                />
                            ) : null}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div >
    );
};
