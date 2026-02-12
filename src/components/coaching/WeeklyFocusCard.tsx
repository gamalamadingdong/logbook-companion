import React, { useState, useEffect } from 'react';
import { Target, Plus, Pencil, X, Check, Loader2, ChevronLeft, ChevronRight, Trash2, BookOpen } from 'lucide-react';
import {
  getWeeklyPlan,
  upsertWeeklyPlan,
  deleteWeeklyPlan,
  getWeekStart,
  type CoachingWeeklyPlan,
} from '../../services/coaching/coachingService';

interface WeeklyFocusCardProps {
  teamId: string;
  userId: string;
}

/** Format a week_start date into a readable range: "Feb 17 – 23" */
function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
}

/** Get ISO week number for display */
function getWeekNumber(weekStart: string): number {
  const seasonStart = new Date('2026-02-16T00:00:00'); // Season week 1 Monday = Feb 16 (Mon before Feb 17)
  const current = new Date(weekStart + 'T00:00:00');
  const diff = current.getTime() - seasonStart.getTime();
  const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return weekNum > 0 ? weekNum : 0;
}

export const WeeklyFocusCard: React.FC<WeeklyFocusCardProps> = ({ teamId, userId }) => {
  const [plan, setPlan] = useState<CoachingWeeklyPlan | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [weekStart, setWeekStart] = useState(() => getWeekStart());

  // Edit form state
  const [theme, setTheme] = useState('');
  const [focusPoints, setFocusPoints] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [reflection, setReflection] = useState('');

  const loading = loadedKey !== `${teamId}:${weekStart}`;

  // Load plan for current week
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    const key = `${teamId}:${weekStart}`;

    getWeeklyPlan(teamId, weekStart)
      .then((data) => {
        if (cancelled) return;
        setPlan(data);
        if (data) {
          setTheme(data.theme || '');
          setFocusPoints(data.focus_points.length > 0 ? data.focus_points : ['']);
          setNotes(data.notes || '');
          setReflection(data.reflection || '');
        } else {
          setTheme('');
          setFocusPoints(['']);
          setNotes('');
          setReflection('');
        }
      })
      .catch(() => { if (!cancelled) setPlan(null); })
      .finally(() => { if (!cancelled) setLoadedKey(key); });

    return () => { cancelled = true; };
  }, [teamId, weekStart]);

  const navigateWeek = (direction: -1 | 1) => {
    const current = new Date(weekStart + 'T00:00:00');
    current.setDate(current.getDate() + direction * 7);
    setWeekStart(current.toISOString().slice(0, 10));
    setEditing(false);
  };

  const isCurrentWeek = weekStart === getWeekStart();

  const handleSave = async () => {
    setSaving(true);
    try {
      const filtered = focusPoints.map((p) => p.trim()).filter(Boolean);
      const saved = await upsertWeeklyPlan({
        team_id: teamId,
        week_start: weekStart,
        theme: theme.trim() || null,
        focus_points: filtered,
        notes: notes.trim() || null,
        reflection: reflection.trim() || null,
        created_by: userId,
      });
      setPlan(saved);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save weekly plan', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await deleteWeeklyPlan(plan.id);
      setPlan(null);
      setTheme('');
      setFocusPoints(['']);
      setNotes('');
      setReflection('');
      setEditing(false);
    } catch (err) {
      console.error('Failed to delete weekly plan', err);
    } finally {
      setSaving(false);
    }
  };

  const addFocusPoint = () => setFocusPoints([...focusPoints, '']);
  const removeFocusPoint = (index: number) => {
    const next = focusPoints.filter((_, i) => i !== index);
    setFocusPoints(next.length === 0 ? [''] : next);
  };
  const updateFocusPoint = (index: number, value: string) => {
    const next = [...focusPoints];
    next[index] = value;
    setFocusPoints(next);
  };

  const weekNum = getWeekNumber(weekStart);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Header with week navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-neutral-800 bg-neutral-800/30">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-indigo-400 shrink-0" />
          <span className="text-sm font-semibold text-white">Weekly Focus</span>
          {weekNum > 0 && weekNum <= 11 && (
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
              Week {weekNum}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigateWeek(-1)}
            className="p-1 text-neutral-500 hover:text-white transition-colors shrink-0"
            title="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setWeekStart(getWeekStart());
              setEditing(false);
            }}
            className={`text-xs px-2 py-1 rounded transition-colors truncate ${
              isCurrentWeek
                ? 'text-indigo-400 bg-indigo-500/10'
                : 'text-neutral-500 hover:text-white hover:bg-neutral-700'
            }`}
          >
            {formatWeekRange(weekStart)}
          </button>
          <button
            type="button"
            onClick={() => navigateWeek(1)}
            className="p-1 text-neutral-500 hover:text-white transition-colors shrink-0"
            title="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="text-indigo-400 animate-spin" />
          </div>
        ) : editing ? (
          /* ─── Edit Mode ────────────────────────────── */
          <div className="space-y-4">
            {/* Theme */}
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1 block">
                Theme
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. Build the Stroke"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Focus Points */}
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1 block">
                Focus Points
              </label>
              <div className="space-y-2">
                {focusPoints.map((point, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-neutral-600 text-sm">•</span>
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => updateFocusPoint(i, e.target.value)}
                      placeholder="e.g. Emphasize slow recovery"
                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && point.trim()) {
                          e.preventDefault();
                          addFocusPoint();
                        }
                      }}
                    />
                    {focusPoints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFocusPoint(i)}
                        className="text-neutral-600 hover:text-red-400 transition-colors"
                        aria-label="Remove focus point"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFocusPoint}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Plus size={12} />
                  Add point
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1 block">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra notes for the week..."
                rows={2}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Reflection */}
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1 block">
                <span className="flex items-center gap-1"><BookOpen size={11} /> Reflection</span>
              </label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="How did the week go? What worked, what to adjust..."
                rows={3}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm text-neutral-500 hover:text-white px-3 py-2 transition-colors"
              >
                Cancel
              </button>
              {plan && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="ml-auto flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>
          </div>
        ) : plan && (plan.theme || plan.focus_points.length > 0) ? (
          /* ─── Display Mode ─────────────────────────── */
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                {plan.theme && (
                  <h3 className="text-white font-semibold text-lg">{plan.theme}</h3>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-neutral-500 hover:text-indigo-400 transition-colors p-1"
                title="Edit this week"
              >
                <Pencil size={14} />
              </button>
            </div>

            {plan.focus_points.length > 0 && (
              <ul className="space-y-1.5">
                {plan.focus_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    <span className="text-neutral-300">{point}</span>
                  </li>
                ))}
              </ul>
            )}

            {plan.notes && (
              <p className="text-xs text-neutral-500 italic border-t border-neutral-800 pt-2 mt-2">
                {plan.notes}
              </p>
            )}

            {plan.reflection && (
              <div className="border-t border-neutral-800 pt-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-amber-400/70 font-medium mb-1.5">
                  <BookOpen size={12} />
                  Reflection
                </div>
                <p className="text-sm text-neutral-400 whitespace-pre-wrap">{plan.reflection}</p>
              </div>
            )}
          </div>
        ) : (
          /* ─── Empty State ──────────────────────────── */
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full flex flex-col items-center gap-2 py-6 text-neutral-500 hover:text-indigo-400 transition-colors group"
          >
            <div className="p-3 bg-neutral-800 rounded-lg group-hover:bg-indigo-500/10 transition-colors">
              <Plus size={20} />
            </div>
            <span className="text-sm">Set this week's focus</span>
          </button>
        )}
      </div>
    </div>
  );
};
