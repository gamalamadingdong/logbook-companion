import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import type { C2Stroke } from '../../api/concept2.types';
import { stitchWorkStrokes } from '../../utils/strokeUtils';
import { splitToWatts, wattsToSplit, formatSplit } from '../../utils/zones';

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
    const [hoveredPoint, setHoveredPoint] = React.useState<any>(null);
    const [pinnedPoint, setPinnedPoint] = React.useState<any>(null);

    // 1. Stitch Strokes
    const stitchedA = React.useMemo(() => stitchWorkStrokes(strokesA, workoutA), [strokesA, workoutA]);
    const stitchedB = React.useMemo(() => stitchWorkStrokes(strokesB, workoutB), [strokesB, workoutB]);

    // Helpers for extracting accurate Watts/Pace from ambiguous 'p' field
    const getSafeWatts = React.useCallback((p: number | undefined) => {
        if (!p) return 0;
        // Heuristic: If p > 500, it's likely Pace in deciseconds (e.g. 1:40 = 1000).
        // If p <= 500, it's likely Watts (World record watts ~1000+, but typical user < 500).
        // Let's use 350 as safe cutoff? (350W = 1:33, 1:33 in ds = 930. 350 vs 930. Safe.)
        // What about 800W? 1:13 pace = 730ds. Overlap danger zone: 600W-800W vs 60s-80s pace.
        // Concept2 usually adheres to: if p > 1000 it is pace?
        // Let's rely on the Zones heuristic: p > 300 check.
        // If p = 400 (Watts), p > 300 -> treats as Pace 40.0s? 40s/500m is impossible (fast).
        // 40s/500m = 400ds.
        // If it treats 400 as Pace -> 40s -> Huge Watts.
        // If it treats 400 as Watts -> 400W.
        // Let's try to refine:
        // Pace of 1:00/500m (World Recordish) = 60s = 600ds.
        // Watts for 1:00 = 2.8 * (500/60)^3 = ~1600W.
        // So Watts > Pace(ds) usually.
        // Except for slow stuff. 2:00 = 1200ds. Watts = 200W.
        // Here Pace(ds) > Watts.
        // Crossover point: 1:35.8 (958ds) ~ 300W.
        // If p > 1000, it is almost certainly Pace (unless Hulk).
        // If p < 300, it is almost certainly Watts.
        // In between is tricky.
        return p > 600 ? splitToWatts(p / 10) : p;
    }, []);

    const getSafePace = React.useCallback((p: number | undefined) => {
        if (!p) return 0;
        return p > 600 ? p / 10 : wattsToSplit(p);
    }, []);


    // 2. Build Unified Data
    // We map both to a common distance axis (every 10m) using linear interpolation
    const combinedData = React.useMemo(() => {
        // NORMALIZE DATA: C2 often returns distance in decimeters (0.1m).
        // Do NOT divide p by 10 here, keep raw to preserve heuristic ability (large vs small numbers)
        const normA = stitchedA.map(s => ({ ...s, d: s.d / 10 }));
        const normB = stitchedB.map(s => ({ ...s, d: s.d / 10 }));

        const maxDistA = normA.length ? normA[normA.length - 1].d : 0;
        const maxDistB = normB.length ? normB[normB.length - 1].d : 0;
        const maxDist = Math.max(maxDistA, maxDistB);

        // Safety check: Cap at 50,000m (50km)
        const safeMax = Math.min(maxDist, 50000);

        const results = [];
        let idxA = 0;
        let idxB = 0;

        for (let x = 0; x <= safeMax; x += 10) {

            // Reusable Interpolation Helper for Single Pass
            const getVal = (target: number, strokes: C2Stroke[], startIdx: number): { val: number | null, newIdx: number, nearest: C2Stroke | undefined } => {
                let curr = startIdx;
                // Advance pointer until we find a stroke >= target or hit end
                while (curr < strokes.length && strokes[curr].d < target) {
                    curr++;
                }

                if (curr >= strokes.length) {
                    return { val: null, newIdx: curr, nearest: strokes[strokes.length - 1] };
                }

                const currentStroke = strokes[curr];
                const getValue = (s: C2Stroke) => {
                    if (!s) return null;
                    if (metric === 'watts') return getSafeWatts(s.p);
                    if (metric === 'pace') return getSafePace(s.p);
                    if (metric === 'rate') return s.spm;
                    if (metric === 'hr') return s.hr;
                    return null;
                };

                // Exact match (within 0.1m)
                if (Math.abs(currentStroke.d - target) < 0.1) {
                    return { val: getValue(currentStroke), newIdx: curr, nearest: currentStroke };
                }

                if (curr === 0) {
                    return { val: null, newIdx: curr, nearest: currentStroke };
                }

                const after = strokes[curr];
                const before = strokes[curr - 1];

                // Gap check: if gap > 100m, break line
                if (after.d - before.d > 100) {
                    return { val: null, newIdx: curr, nearest: Math.abs(after.d - x) < Math.abs(before.d - x) ? after : before };
                }

                const ratio = (target - before.d) / (after.d - before.d);

                const v1 = getValue(before);
                const v2 = getValue(after);

                if (v1 === null || v2 === null) return { val: null, newIdx: curr, nearest: after };

                const val = v1 + (v2 - v1) * ratio;
                const nearest = Math.abs(after.d - x) < Math.abs(before.d - x) ? after : before;

                return { val, newIdx: curr, nearest };
            };

            const resA = getVal(x, normA, idxA);
            const resB = getVal(x, normB, idxB);

            idxA = Math.max(0, resA.newIdx - 1);
            idxB = Math.max(0, resB.newIdx - 1);

            let delta = null;
            if (resA.val !== null && resB.val !== null) {
                delta = resB.val - resA.val;
            }

            const strokeA = (resA.nearest && Math.abs(resA.nearest.d - x) < 50) ? resA.nearest : undefined;
            const strokeB = (resB.nearest && Math.abs(resB.nearest.d - x) < 50) ? resB.nearest : undefined;

            results.push({
                distance: x,
                strokeA,
                strokeB,
                valA: resA.val ? Math.round(resA.val) : null,
                valB: resB.val ? Math.round(resB.val) : null,
                delta
            });
        }
        return results;
    }, [stitchedA, stitchedB, metric, getSafeWatts, getSafePace]);

    // Derived helpers
    const formatX = React.useCallback((val: number) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}m`, []);


    // Calculate Gradient Offset for coloring the Area chart
    const off = React.useMemo(() => {
        const dataMax = Math.max(...combinedData.map((i) => i.delta || 0));
        const dataMin = Math.min(...combinedData.map((i) => i.delta || 0));
        if (dataMax <= 0) return 0;
        if (dataMin >= 0) return 1;
        return dataMax / (dataMax - dataMin);
    }, [combinedData]);

    // Chart Interaction
    const handleMouseMove = React.useCallback((state: any) => {
        // Fallback: If Recharts doesn't provide payload but gives us the label (distance), lookup manually.
        let point = null;

        if (state && state.activePayload && state.activePayload.length > 0) {
            point = state.activePayload[0].payload;
        } else if (state && state.activeLabel !== undefined) {
            // Fallback lookup using activeLabel (distance)
            // Note: activeLabel matches the XAxis dataKey 'distance'
            point = combinedData.find(d => d.distance === state.activeLabel);
        }

        if (point) {
            // Only update if changed to avoid thrashing
            setHoveredPoint((prev: any) => {
                if (prev?.distance === point.distance) return prev;
                return point;
            });
        } else {
            setHoveredPoint(null);
        }
    }, [combinedData]);

    const handleMouseLeave = React.useCallback(() => {
        setHoveredPoint(null);
    }, []);

    const handleChartClick = React.useCallback((state: any) => {
        let payload = null;
        if (state && state.activePayload && state.activePayload.length > 0) {
            payload = state.activePayload[0].payload;
        } else if (state && state.activeLabel !== undefined) {
            // Fallback using x-axis value (distance)
            payload = combinedData.find(d => d.distance === state.activeLabel);
        }

        if (payload) {
            // Toggle pin if clicking the same point, otherwise pin the new point
            setPinnedPoint((prev: any) => {
                if (prev && prev.distance === payload.distance) {
                    return null;
                }
                return payload;
            });
        } else {
            setPinnedPoint(null);
        }
    }, [combinedData]);

    // Active Data for Header
    const activeData = pinnedPoint || hoveredPoint || null;



    const nameA = workoutA.workout_name || 'Base Workout';
    const nameB = workoutB.workout_name || 'Comparison';

    // Stable Tooltip Content (Must return an element for Recharts to process events correctly in some versions)
    const CustomTooltip = React.useCallback(() => <div className="hidden" />, []);

    return (
        <div className="w-full h-full flex flex-col gap-4">

            {/* 1. Stats Header (Multi-Metric) */}
            <div className="flex items-center justify-between min-h-[60px] px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl transition-all">
                {!activeData ? (
                    <div className="w-full flex items-center justify-center text-neutral-600 text-sm gap-2">
                        <span className="animate-pulse">●</span> Hover to inspect, click to pin
                    </div>
                ) : (
                    <div className="w-full flex items-center justify-between gap-2 text-sm">

                        {/* Distance Label */}
                        <div className="flex flex-col items-center w-12 border-r border-neutral-800 mr-2">
                            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Dist</span>
                            <span className="text-white font-mono font-bold">{activeData.distance}m</span>
                        </div>

                        {/* Workout A Stats */}
                        <div className="flex-1 flex flex-col items-end pr-4 border-r border-neutral-800">
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider truncate max-w-[120px] mb-1">{nameA}</span>
                            <div className="grid grid-cols-4 gap-4 w-full justify-items-end">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-neutral-600 uppercase">Watts</span>
                                    <span className="text-white font-mono font-bold text-base">{activeData.strokeA ? getSafeWatts(activeData.strokeA.p).toFixed(0) : '-'}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-neutral-600 uppercase">Pace</span>
                                    <span className="text-white font-mono font-bold text-base">{activeData.strokeA ? formatSplit(getSafePace(activeData.strokeA.p)) : '-'}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-neutral-600 uppercase">Rate</span>
                                    <span className="text-white font-mono font-bold text-base">{activeData.strokeA?.spm || '-'}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-neutral-600 uppercase">HR</span>
                                    <span className="text-red-400 font-mono font-bold text-base">{activeData.strokeA?.hr || '-'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Workout B Stats */}
                        <div className="flex-1 flex flex-col items-start pl-4">
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider truncate max-w-[120px] mb-1">{nameB}</span>
                            <div className="grid grid-cols-4 gap-4 w-full justify-items-start">
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-neutral-600 uppercase">Watts</span>
                                    <span className="text-white font-mono font-bold text-base">{activeData.strokeB ? getSafeWatts(activeData.strokeB.p).toFixed(0) : '-'}</span>
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-neutral-600 uppercase">Pace</span>
                                    <span className="text-white font-mono font-bold text-base">{activeData.strokeB ? formatSplit(getSafePace(activeData.strokeB.p)) : '-'}</span>
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-neutral-600 uppercase">Rate</span>
                                    <span className="text-white font-mono font-bold text-base">{activeData.strokeB?.spm || '-'}</span>
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-neutral-600 uppercase">HR</span>
                                    <span className="text-red-400 font-mono font-bold text-base">{activeData.strokeB?.hr || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Main Line Chart */}
            <div className="flex-1 min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={combinedData}
                        syncId="dualWorkout"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        onClick={handleChartClick}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis
                            dataKey="distance"
                            type="number"
                            hide
                            domain={['dataMin', 'dataMax']}
                        />
                        <YAxis
                            stroke="#525252"
                            tick={{ fill: '#737373', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                            domain={['auto', 'auto']}
                        />
                        <Line
                            type="monotone"
                            dataKey="valA"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }}
                            connectNulls
                            isAnimationActive={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="valB"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
                            connectNulls
                            isAnimationActive={false}
                        />
                        <Tooltip content={CustomTooltip} cursor={{ stroke: '#525252', strokeWidth: 1 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 3. Delta Area Chart */}
            <div className="h-[120px] min-h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={combinedData}
                        syncId="dualWorkout"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        onClick={handleChartClick}
                    >
                        <defs>
                            {metric === 'watts' ? (
                                <linearGradient id="wattsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={off} stopColor="#10b981" stopOpacity={0.5} />
                                    <stop offset={off} stopColor="#ef4444" stopOpacity={0.5} />
                                </linearGradient>
                            ) : (
                                <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={off} stopColor="#ef4444" stopOpacity={0.5} />
                                    <stop offset={off} stopColor="#10b981" stopOpacity={0.5} />
                                </linearGradient>
                            )}
                        </defs>
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
                            tick={{ fill: '#737373', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                            tickFormatter={(val) => Math.abs(val).toFixed(0)}
                        />
                        <Area
                            type="monotone"
                            dataKey="delta"
                            stroke="#525252"
                            fill={`url(#${metric === 'watts' ? 'wattsGradient' : 'paceGradient'})`}
                            strokeWidth={1}
                            activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                            isAnimationActive={false}
                        />
                        <Tooltip content={CustomTooltip} cursor={{ stroke: '#525252', strokeWidth: 1 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
