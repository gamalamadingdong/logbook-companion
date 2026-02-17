import { useMemo } from 'react';
import type { CoachingErgScore } from '../../services/coaching/coachingService';
import { calculateZonePaceRange, formatSplit, calculateWattsFromSplit } from '../../utils/paceCalculator';

interface Props {
  ergScores: CoachingErgScore[];
}

const ZONES = ['UT2', 'UT1', 'AT', 'TR', 'AN'] as const;

const ZONE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  UT2: { bg: 'bg-emerald-900/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  UT1: { bg: 'bg-blue-900/20', text: 'text-blue-400', bar: 'bg-blue-500' },
  AT:  { bg: 'bg-amber-900/20', text: 'text-amber-400', bar: 'bg-amber-500' },
  TR:  { bg: 'bg-orange-900/20', text: 'text-orange-400', bar: 'bg-orange-500' },
  AN:  { bg: 'bg-red-900/20', text: 'text-red-400', bar: 'bg-red-500' },
};

const ZONE_LABELS: Record<string, string> = {
  UT2: 'Utilization 2 (Recovery)',
  UT1: 'Utilization 1 (Endurance)',
  AT:  'Anaerobic Threshold',
  TR:  'Transport (Race Pace)',
  AN:  'Anaerobic',
};

export function AthleteTrainingZones({ ergScores }: Props) {
  // Find the best (most recent) 2k test score
  const baseline = useMemo(() => {
    const twoKScores = ergScores.filter(s => s.distance === 2000);
    if (twoKScores.length === 0) return null;

    // Use the most recent 2k test
    const sorted = [...twoKScores].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const best = sorted[0];

    const splitSec = best.split_500m ?? (best.time_seconds / best.distance) * 500;
    const watts = best.watts ?? calculateWattsFromSplit(splitSec);

    return {
      date: best.date,
      time_seconds: best.time_seconds,
      split: splitSec,
      watts,
    };
  }, [ergScores]);

  if (!baseline) {
    return (
      <div>
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Training Zones</h3>
        <p className="text-neutral-500 text-sm">
          No 2k test recorded. Mark a 2k assignment as a test to calculate training zones.
        </p>
      </div>
    );
  }

  // Format the 2k time
  const baselineMins = Math.floor(baseline.time_seconds / 60);
  const baselineSecs = (baseline.time_seconds % 60).toFixed(1);
  const baselineTimeStr = `${baselineMins}:${baselineSecs.padStart(4, '0')}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-400">Training Zones</h3>
        <div className="text-xs text-neutral-500">
          Based on 2k: {baselineTimeStr} ({formatSplit(baseline.split)}/500m · {Math.round(baseline.watts)}W)
        </div>
      </div>

      <div className="space-y-2">
        {ZONES.map(zone => {
          const range = calculateZonePaceRange(zone, baseline.watts);
          if (!range) return null;

          const colors = ZONE_COLORS[zone];
          const minWatts = Math.round(baseline.watts * (zone === 'UT2' ? 0.55 : zone === 'UT1' ? 0.65 : zone === 'AT' ? 0.75 : zone === 'TR' ? 0.85 : 0.95));
          const maxWatts = Math.round(baseline.watts * (zone === 'UT2' ? 0.65 : zone === 'UT1' ? 0.75 : zone === 'AT' ? 0.85 : zone === 'TR' ? 0.95 : 1.05));

          // Bar width represents intensity position (UT2 = narrow, AN = wide)
          const barWidth = zone === 'UT2' ? '20%' : zone === 'UT1' ? '40%' : zone === 'AT' ? '60%' : zone === 'TR' ? '80%' : '100%';

          return (
            <div key={zone} className={`p-3 rounded-lg border border-neutral-700/50 ${colors.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${colors.text}`}>{zone}</span>
                  <span className="text-xs text-neutral-500">{ZONE_LABELS[zone]}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="font-mono text-neutral-300">
                  {range.lowFormatted} – {range.highFormatted} /500m
                </div>
                <div className="text-neutral-500">
                  {minWatts}–{maxWatts}W
                </div>
              </div>
              {/* Intensity bar */}
              <div className="mt-2 h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${colors.bar} opacity-60`} style={{ width: barWidth }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
