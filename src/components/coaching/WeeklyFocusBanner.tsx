import React, { useState, useEffect } from 'react';
import { Target, Pencil, Loader2, BookOpen } from 'lucide-react';
import {
  getWeeklyPlan,
  getWeekStart,
  type CoachingWeeklyPlan,
} from '../../services/coaching/coachingService';

interface WeeklyFocusBannerProps {
  teamId: string;
  /** Override which week to show (ISO date string for Monday). Defaults to current week. */
  weekStart?: string;
  /** Called when user clicks the edit button — navigate to dashboard or open editor */
  onEdit?: () => void;
}

/**
 * Compact read-only banner showing this week's focus.
 * Designed for the top of the CoachingSchedule week view.
 */
export const WeeklyFocusBanner: React.FC<WeeklyFocusBannerProps> = ({
  teamId,
  weekStart: weekStartProp,
  onEdit,
}) => {
  const [plan, setPlan] = useState<CoachingWeeklyPlan | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const weekStart = weekStartProp || getWeekStart();
  const loading = loadedKey !== `${teamId}:${weekStart}`;

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    const key = `${teamId}:${weekStart}`;

    getWeeklyPlan(teamId, weekStart)
      .then((data) => { if (!cancelled) setPlan(data); })
      .catch(() => { if (!cancelled) setPlan(null); })
      .finally(() => { if (!cancelled) setLoadedKey(key); });

    return () => { cancelled = true; };
  }, [teamId, weekStart]);

  // Don't render anything if loading or no plan exists
  if (loading) {
    return (
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
        <Loader2 size={14} className="text-indigo-400 animate-spin" />
        <span className="text-sm text-neutral-500">Loading weekly focus...</span>
      </div>
    );
  }

  if (!plan || (!plan.theme && plan.focus_points.length === 0 && !plan.reflection)) {
    return null; // Nothing to show — keep schedule clean
  }

  return (
    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Theme + Focus */}
          <div className="flex items-center gap-2 mb-1.5">
            <Target size={14} className="text-indigo-400 shrink-0" />
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Weekly Focus
            </span>
          </div>

          {plan.theme && (
            <h3 className="text-white font-semibold text-sm mb-1.5">{plan.theme}</h3>
          )}

          {plan.focus_points.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {plan.focus_points.map((point, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span className="text-indigo-400">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}

          {plan.notes && (
            <p className="text-xs text-neutral-500 italic mt-1.5">{plan.notes}</p>
          )}

          {/* Reflection (if written) */}
          {plan.reflection && (
            <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-indigo-500/10">
              <BookOpen size={12} className="text-amber-400/60 mt-0.5 shrink-0" />
              <p className="text-xs text-neutral-500 line-clamp-2">{plan.reflection}</p>
            </div>
          )}
        </div>

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-neutral-600 hover:text-indigo-400 transition-colors p-1 shrink-0"
            title="Edit weekly focus"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
