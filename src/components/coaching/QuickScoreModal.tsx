import { useState } from 'react';
import { X, Loader2, Clock, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import {
  quickScoreAndComplete,
  completeAthleteAssignment,
  type CoachingAthlete,
  type AssignmentCompletion,
} from '../../services/coaching/coachingService';

interface QuickScoreModalProps {
  athlete: CoachingAthlete;
  /** Completion records where this athlete is missing */
  missingCompletions: AssignmentCompletion[];
  teamId: string;
  coachUserId: string;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Quick score entry modal — lets a coach record a result for a missing athlete
 * and mark their assignment as complete. Writes to coaching_erg_scores.
 */
export function QuickScoreModal({
  athlete,
  missingCompletions,
  teamId,
  coachUserId,
  onClose,
  onComplete,
}: QuickScoreModalProps) {
  // Pick the first missing assignment (most common: one assignment per day)
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedCompletion = missingCompletions[selectedIdx];

  // Score fields
  const [distance, setDistance] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [tenths, setTenths] = useState('');
  const [strokeRate, setStrokeRate] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [notes, setNotes] = useState('');
  const [markOnlyMode, setMarkOnlyMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Computed values
  const totalSeconds =
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0) +
    (parseInt(tenths) || 0) / 10;
  const distanceNum = parseInt(distance) || 0;
  const split500m =
    distanceNum > 0 && totalSeconds > 0
      ? (totalSeconds / distanceNum) * 500
      : undefined;
  const watts =
    split500m && split500m > 0
      ? Math.round(2.8 / Math.pow(split500m / 500, 3))
      : undefined;

  const canSubmit = markOnlyMode || (distanceNum > 0 && totalSeconds > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCompletion) return;
    setSubmitting(true);
    try {
      if (markOnlyMode) {
        // Just mark complete — no score
        await completeAthleteAssignment(
          selectedCompletion.group_assignment_id,
          athlete.id
        );
      } else {
        await quickScoreAndComplete(teamId, coachUserId, athlete.id, selectedCompletion.group_assignment_id, {
          distance: distanceNum,
          time_seconds: totalSeconds,
          split_500m: split500m,
          watts,
          stroke_rate: parseInt(strokeRate) || undefined,
          heart_rate: parseInt(heartRate) || undefined,
          notes: notes.trim() || undefined,
        });
      }
      toast.success(`Score recorded for ${athlete.name}`);
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save score');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSplit = (s: number | undefined) => {
    if (!s || s <= 0) return '--:--.-';
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Quick Score</h2>
            <p className="text-sm text-neutral-400">{athlete.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Assignment selector (if multiple missing) */}
        {missingCompletions.length > 1 && (
          <div className="mb-4">
            <label htmlFor="quick-score-assignment" className="text-xs text-neutral-500 block mb-1">Assignment</label>
            <select
              id="quick-score-assignment"
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              aria-label="Assignment"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {missingCompletions.map((c, i) => (
                <option key={c.group_assignment_id} value={i}>
                  Assignment {i + 1} ({c.completed}/{c.total} done)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mark-only toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markOnlyMode}
              onChange={(e) => setMarkOnlyMode(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="text-sm text-neutral-300">
              Just mark complete (no score)
            </span>
          </label>
        </div>

        {/* Score fields (hidden in mark-only mode) */}
        {!markOnlyMode && (
          <div className="space-y-4">
            {/* Distance */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                <Ruler className="w-3 h-3" />
                Distance (meters)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="e.g. 6000"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>

            {/* Time — mm:ss.d */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                <Clock className="w-3 h-3" />
                Time
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="mm"
                  className="w-20 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center placeholder-neutral-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-neutral-500 text-lg font-bold">:</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  placeholder="ss"
                  className="w-20 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center placeholder-neutral-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-neutral-500 text-lg font-bold">.</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9}
                  value={tenths}
                  onChange={(e) => setTenths(e.target.value)}
                  placeholder="0"
                  className="w-16 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center placeholder-neutral-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Calculated split + watts */}
            {distanceNum > 0 && totalSeconds > 0 && (
              <div className="flex gap-4 text-sm">
                <div className="bg-neutral-800/50 rounded-lg px-3 py-2 flex-1 text-center">
                  <div className="text-neutral-500 text-xs">Split /500m</div>
                  <div className="text-indigo-400 font-mono font-medium">
                    {formatSplit(split500m)}
                  </div>
                </div>
                {watts && (
                  <div className="bg-neutral-800/50 rounded-lg px-3 py-2 flex-1 text-center">
                    <div className="text-neutral-500 text-xs">Watts</div>
                    <div className="text-amber-400 font-mono font-medium">{watts}W</div>
                  </div>
                )}
              </div>
            )}

            {/* Optional fields — inline row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-neutral-500 block mb-1">S/M</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={strokeRate}
                  onChange={(e) => setStrokeRate(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center placeholder-neutral-600 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-neutral-500 block mb-1">HR</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center placeholder-neutral-600 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-600 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {markOnlyMode ? 'Mark Complete' : 'Save Score'}
          </button>
        </div>
      </div>
    </div>
  );
}
