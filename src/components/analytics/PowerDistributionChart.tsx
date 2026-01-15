
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { aggregateBucketsByZone } from '../../utils/zones';

interface PowerDistributionChartProps {
    buckets: Record<string, number>; // "200" -> 45.5 (seconds)
    baselineWatts: number; // Required for zone classification
    className?: string;
}

export const PowerDistributionChart: React.FC<PowerDistributionChartProps> = ({
    buckets,
    baselineWatts,
    className
}) => {

    const zoneData = useMemo(() => {
        if (!buckets || !baselineWatts) return [];
        return aggregateBucketsByZone(buckets, baselineWatts);
    }, [buckets, baselineWatts]);

    if (zoneData.length === 0) {
        return <div className="text-center text-neutral-500 text-sm py-4">No power data available.</div>;
    }

    const totalSeconds = zoneData.reduce((sum, z) => sum + z.seconds, 0);
    const dominantZone = zoneData.reduce((max, z) => z.seconds > max.seconds ? z : max, zoneData[0]);
    const dominantPct = Math.round((dominantZone.seconds / totalSeconds) * 100);

    return (
        <div className={`w-full h-full flex flex-col ${className || ''}`}>
            {/* Donut Chart */}
            <div className="flex-1 relative min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={zoneData}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="seconds"
                        >
                            {zoneData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(val: any) => {
                                const pct = ((val / totalSeconds) * 100).toFixed(1);
                                return [`${pct}% (${Math.round(val)}s)`, 'Time'];
                            }}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center Label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <span className="text-2xl font-bold text-white">{dominantPct}%</span>
                        <div className="text-xs text-neutral-500 uppercase">is {dominantZone.zone}</div>
                    </div>
                </div>
            </div>

            {/* Zone Ranges Legend */}
            <div className="mt-4 pt-4 border-t border-neutral-800">
                <div className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-2">
                    Zone Ranges (Baseline: {baselineWatts}W)
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {zoneData.map((zone) => (
                        <div key={zone.zone} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: zone.color }}
                            />
                            <span className="text-neutral-400 font-medium">{zone.zone}:</span>
                            <span className="text-neutral-300 font-mono">{zone.wattsRange}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
