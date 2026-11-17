import React, { useState, useEffect, useRef } from 'react';
import { Target, Plus, Pencil, X, Check, Loader2, ChevronLeft, ChevronRight, Trash2, BookOpen, Crosshair, MessageSquare, Activity, Timer, ClipboardList, Copy, ChevronsRight } from 'lucide-react';
import {
  getWeeklyPlan,
  upsertWeeklyPlan,
  deleteWeeklyPlan,
  getWeekStart,
  getGroupAssignments,
  type CoachingWeeklyPlan,
  type GroupAssignment,
} from '../../services/coaching/coachingService';

import { useCoachingContext } from '../../hooks/useCoachingContext';

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

export const WeeklyFocusCard: React.FC<WeeklyFocusCardProps> = ({ teamId, userId }) => {
  const { teams } = useCoachingContext();
  const canEdit = teams.some(t => t.team_id === teamId && t.role === 'coach');
  const [plan, setPlan] = useState<CoachingWeeklyPlan | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [weekStart, setWeekStart] = useState(() => getWeekStart());

  // Edit form state
  const [theme, setTheme] = useState('');
  const [goals, setGoals] = useState<string[]>(['']);
  const [coachingPoints, setCoachingPoints] = useState<string[]>(['']);
  const [drillExamples, setDrillExamples] = useState<string[]>(['']);
  const [pieceExamples, setPieceExamples] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [reflection, setReflection] = useState('');
  const [activeTab, setActiveTab] = useState<'goals' | 'coaching' | 'drills' | 'pieces' | 'assignments'>('goals');
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [showTabsScrollHint, setShowTabsScrollHint] = useState(false);
  const tabsStripRef = useRef<HTMLDivElement | null>(null);
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
          setGoals(data.goals.length > 0 ? data.goals : ['']);
          setCoachingPoints(data.coaching_points.length > 0 ? data.coaching_points : ['']);
          setDrillExamples(data.drill_examples.length > 0 ? data.drill_examples : ['']);
          setPieceExamples(data.piece_examples.length > 0 ? data.piece_examples : ['']);
          setNotes(data.notes || '');
          setReflection(data.reflection || '');
        } else {
          setTheme('');
          setGoals(['']);
          setCoachingPoints(['']);
          setDrillExamples(['']);
          setPieceExamples(['']);
          setNotes('');
          setReflection('');
        }
      })
      .catch(() => { if (!cancelled) setPlan(null); })
      .finally(() => { if (!cancelled) setLoadedKey(key); });

    return () => { cancelled = true; };
  }, [teamId, weekStart]);

  useEffect(() => {
    const el = tabsStripRef.current;
    if (!el) {
      setShowTabsScrollHint(false);
      return;
    }

    const updateHint = () => {
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      const hasOverflow = maxScrollLeft > 2;
      const atRightEdge = el.scrollLeft >= maxScrollLeft - 2;
      setShowTabsScrollHint(hasOverflow && !atRightEdge);
    };

    const raf = requestAnimationFrame(updateHint);
    el.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, [editing, activeTab, assignments.length, goals.length, coachingPoints.length, drillExamples.length, pieceExamples.length, plan?.goals.length, plan?.coaching_points.length, plan?.drill_examples.length, plan?.piece_examples.length]);

  // Load assignments for this week
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    const weekEnd = new Date(weekStart + 'T00:00:00');
    weekEnd.setDate(weekEnd.getDate() + 6);
    const to = weekEnd.toISOString().slice(0, 10);

    getGroupAssignments(teamId, { from: weekStart, to })
      .then((data) => { if (!cancelled) setAssignments(data); })
      .catch(() => { if (!cancelled) setAssignments([]); });

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
    if (!canEdit) return;
    setSaving(true);
    try {
      const filteredGoals = goals.map((p) => p.trim()).filter(Boolean);
      const filteredCoaching = coachingPoints.map((p) => p.trim()).filter(Boolean);
      const filteredDrills = drillExamples.map((p) => p.trim()).filter(Boolean);
      const filteredPieces = pieceExamples.map((p) => p.trim()).filter(Boolean);
      const saved = await upsertWeeklyPlan({
        team_id: teamId,
        week_start: weekStart,
        theme: theme.trim() || null,
        goals: filteredGoals,
        coaching_points: filteredCoaching,
        drill_examples: filteredDrills,
        piece_examples: filteredPieces,
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
    if (!canEdit) return;
    if (!plan) return;
    setSaving(true);
    try {
      await deleteWeeklyPlan(plan.id);
      setPlan(null);
      setTheme('');
      setGoals(['']);
      setCoachingPoints(['']);
      setDrillExamples(['']);
      setPieceExamples(['']);
      setNotes('');
      setReflection('');
      setEditing(false);
    } catch (err) {
      console.error('Failed to delete weekly plan', err);
    } finally {
      setSaving(false);
    }
  };

  // Generic list helpers
  const addItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter((prev) => [...prev, '']);
  const removeItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) =>
    setter((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [''] : next;
    });
  const updateItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) =>
    setter((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

  const tabs = [
    { key: 'goals' as const, label: 'Goals', icon: Crosshair, color: 'text-emerald-400' },
    { key: 'coaching' as const, label: 'Coaching', icon: MessageSquare, color: 'text-amber-400' },
    { key: 'drills' as const, label: 'Drills', icon: Activity, color: 'text-cyan-400' },
    { key: 'pieces' as const, label: 'Pieces', icon: Timer, color: 'text-purple-400' },
    { key: 'assignments' as const, label: 'Schedule', icon: ClipboardList, color: 'text-indigo-400' },
  ] as const;

  const tabData = {
    goals: { items: goals, setter: setGoals, placeholder: 'e.g. All 8 square for 3+ min' },
    coaching: { items: coachingPoints, setter: setCoachingPoints, placeholder: 'e.g. Swing is TIMING, not power' },
    drills: { items: drillExamples, setter: setDrillExamples, placeholder: 'e.g. Pause at hands away' },
    pieces: { items: pieceExamples, setter: setPieceExamples, placeholder: 'e.g. 3x2 min continuous, square, 20-22' },
  };

  const planTabData = plan ? {
    goals: plan.goals,
    coaching: plan.coaching_points,
    drills: plan.drill_examples,
    pieces: plan.piece_examples,
  } : null;

  /** Check if plan has any meaningful content */
  const hasContent = plan && (
    plan.theme ||
    plan.goals.length > 0 ||
    plan.coaching_points.length > 0 ||
    plan.drill_examples.length > 0 ||
    plan.piece_examples.length > 0
  );

  /** Export the weekly plan + assignments as rich text to clipboard */
  const [copied, setCopied] = useState(false);
  const copyToClipboard = async () => {
    const weekRange = formatWeekRange(weekStart);

    // Light background, standard dark text colors for email compatibility
    const section = (title: string, items: string[]) => {
      if (!items || items.length === 0) return { html: '', text: '' };
      return {
        html: `<p style="margin:14px 0 4px;font-weight:700;font-size:14px;color:#333;text-transform:uppercase;letter-spacing:0.5px">${title}</p><ul style="margin:0;padding-left:20px;color:#222">${items.map(i => `<li style="margin-bottom:2px">${i}</li>`).join('')}</ul>`,
        text: `${title}\n${items.map(i => `  • ${i}`).join('\n')}`,
      };
    };

    const sections = [
      section('Goals', plan?.goals ?? []),
      section('Coaching Points', plan?.coaching_points ?? []),
      section('Drills', plan?.drill_examples ?? []),
      section('Pieces', plan?.piece_examples ?? []),
    ];

    // Schedule section
    let scheduleHtml = '';
    let scheduleText = '';
    if (assignments.length > 0) {
      const rows = assignments.map(a => {
        const d = new Date(a.scheduled_date + 'T00:00:00');
        const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        const label = a.title || a.template_name || 'Untitled';
        const meta = [a.workout_type, a.training_zone].filter(Boolean).join(' \u00b7 ');
        const test = a.is_test_template ? ' [TEST]' : '';
        return {
          html: `<tr><td style="padding:3px 12px 3px 0;color:#666;white-space:nowrap;vertical-align:top;font-size:13px">${day}</td><td style="padding:3px 0;color:#222"><strong>${label}</strong>${meta ? ` <span style="color:#555">\u00b7 ${meta}</span>` : ''}${a.is_test_template ? ' <strong style="color:#b45309">TEST</strong>' : ''}</td></tr>`,
          text: `  ${day}  ${label}${meta ? ` \u00b7 ${meta}` : ''}${test}`,
        };
      });
      scheduleHtml = `<p style="margin:14px 0 4px;font-weight:700;font-size:14px;color:#333;text-transform:uppercase;letter-spacing:0.5px">Schedule</p><table style="border-collapse:collapse">${rows.map(r => r.html).join('')}</table>`;
      scheduleText = `Schedule\n${rows.map(r => r.text).join('\n')}`;
    }

    // Notes & reflection
    const notesHtml = plan?.notes ? `<p style="margin-top:14px;padding-top:10px;border-top:1px solid #ddd;color:#555;font-style:italic">${plan.notes}</p>` : '';
    const notesText = plan?.notes ? `\nNotes: ${plan.notes}` : '';
    const reflectionHtml = plan?.reflection ? `<p style="margin-top:8px;color:#333"><strong>Reflection:</strong> ${plan.reflection}</p>` : '';
    const reflectionText = plan?.reflection ? `\nReflection: ${plan.reflection}` : '';

    const heading = `Weekly Focus \u2014 ${weekRange}${plan?.theme ? ` \u2014 ${plan.theme}` : ''}`;

    const html = [
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;color:#222;background:#fff;padding:16px">`,
      `<h2 style="margin:0 0 4px;color:#111;font-size:18px">${heading}</h2>`,
      `<hr style="border:none;border-top:2px solid #4f46e5;margin:8px 0 12px;width:60px">`,
      ...sections.map(s => s.html),
      scheduleHtml,
      notesHtml,
      reflectionHtml,
      `</div>`,
    ].filter(Boolean).join('');

    const text = [
      heading,
      '',
      ...sections.map(s => s.text).filter(Boolean),
      scheduleText,
      notesText,
      reflectionText,
    ].filter(s => s !== undefined).join('\n');

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: plain text
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Header with week navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-neutral-800 bg-neutral-800/30">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-indigo-400 shrink-0" />
          <span className="text-sm font-semibold text-white">Weekly Focus</span>
          {(hasContent || assignments.length > 0) && (
            <button
              type="button"
              onClick={copyToClipboard}
              className="text-neutral-500 hover:text-indigo-400 transition-colors p-1"
              title={copied ? 'Copied!' : 'Copy to clipboard for email'}
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
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
        ) : editing && canEdit ? (
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

            {/* Tabs */}
            <div>
              <div className="relative">
                <div ref={tabsStripRef} className="flex gap-1 border-b border-neutral-800 mb-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                          isActive
                            ? `${tab.color} border-current`
                            : 'text-neutral-500 border-transparent hover:text-neutral-300'
                        }`}
                      >
                        <Icon size={12} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                {showTabsScrollHint && (
                  <ChevronsRight className="sm:hidden pointer-events-none absolute right-1 top-[calc(50%-7px)] w-3.5 h-3.5 text-neutral-500/80" aria-hidden="true" />
                )}
              </div>

              {/* Active tab content (edit mode) */}
              {activeTab === 'assignments' ? (
                /* Assignments tab — read-only in edit mode */
                assignments.length === 0 ? (
                  <p className="text-xs text-neutral-600 italic py-2">No workouts scheduled this week</p>
                ) : (
                  <ul className="space-y-2">
                    {assignments.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 text-sm">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        <div className="min-w-0">
                          <span className="text-white font-medium">{a.title || a.template_name || 'Untitled'}</span>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <span>{new Date(a.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            {a.workout_type && <span className="text-neutral-600">· {a.workout_type}</span>}
                            {a.training_zone && <span className="text-neutral-600">· {a.training_zone}</span>}
                            {a.is_test_template && <span className="text-amber-400 font-medium">TEST</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                /* Editable tab list */
                (() => {
                  const data = tabData[activeTab as keyof typeof tabData];
                  const { items, setter, placeholder } = data;
                  return (
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-neutral-600 text-sm">•</span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => updateItem(setter, i, e.target.value)}
                            placeholder={placeholder}
                            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && item.trim()) {
                                e.preventDefault();
                                addItem(setter);
                              }
                            }}
                          />
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(setter, i)}
                              className="text-neutral-600 hover:text-red-400 transition-colors"
                              aria-label="Remove item"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addItem(setter)}
                        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <Plus size={12} />
                        Add item
                      </button>
                    </div>
                  );
                })()
              )}
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
        ) : hasContent ? (
          /* ─── Display Mode ─────────────────────────── */
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                {plan!.theme && (
                  <h3 className="text-white font-semibold text-lg">{plan!.theme}</h3>
                )}
              </div>
              {canEdit && (<button
                type="button"
                onClick={() => setEditing(true)}
                className="text-neutral-500 hover:text-indigo-400 transition-colors p-1"
                title="Edit this week"
              >
                <Pencil size={14} />
              </button>)}
            </div>

            {/* Tabs (display) */}
            <div>
              <div className="relative">
                <div ref={tabsStripRef} className="flex gap-1 border-b border-neutral-800 mb-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    const count = tab.key === 'assignments'
                      ? assignments.length
                      : (planTabData?.[tab.key as keyof typeof planTabData]?.length ?? 0);
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                          isActive
                            ? `${tab.color} border-current`
                            : 'text-neutral-500 border-transparent hover:text-neutral-300'
                        }`}
                      >
                        <Icon size={12} />
                        {tab.label}
                        {count > 0 && (
                          <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-full">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {showTabsScrollHint && (
                  <ChevronsRight className="sm:hidden pointer-events-none absolute right-1 top-[calc(50%-7px)] w-3.5 h-3.5 text-neutral-500/80" aria-hidden="true" />
                )}
              </div>

              {/* Active tab content */}
              {activeTab === 'assignments' ? (
                assignments.length === 0 ? (
                  <p className="text-xs text-neutral-600 italic py-2">No workouts scheduled this week</p>
                ) : (
                  <ul className="space-y-2">
                    {assignments.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 text-sm">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        <div className="min-w-0">
                          <span className="text-white font-medium">{a.title || a.template_name || 'Untitled'}</span>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <span>{new Date(a.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            {a.workout_type && <span className="text-neutral-600">· {a.workout_type}</span>}
                            {a.training_zone && <span className="text-neutral-600">· {a.training_zone}</span>}
                            {a.is_test_template && <span className="text-amber-400 font-medium">TEST</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : (() => {
                const items = planTabData?.[activeTab as keyof typeof planTabData] ?? [];
                if (items.length === 0) {
                  return (
                    <p className="text-xs text-neutral-600 italic py-2">No items set</p>
                  );
                }
                return (
                  <ul className="space-y-1.5">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 ${tabs.find((t) => t.key === activeTab)?.color ?? 'text-indigo-400'}`}>•</span>
                        <span className="text-neutral-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            {plan!.notes && (
              <p className="text-xs text-neutral-500 italic border-t border-neutral-800 pt-2 mt-2">
                {plan!.notes}
              </p>
            )}

            {plan!.reflection && (
              <div className="border-t border-neutral-800 pt-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-amber-400/70 font-medium mb-1.5">
                  <BookOpen size={12} />
                  Reflection
                </div>
                <p className="text-sm text-neutral-400 whitespace-pre-wrap">{plan!.reflection}</p>
              </div>
            )}
          </div>
        ) : (
          /* ─── Empty State ──────────────────────────── */
          canEdit ? <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full flex flex-col items-center gap-2 py-6 text-neutral-500 hover:text-indigo-400 transition-colors group"
          >
            <div className="p-3 bg-neutral-800 rounded-lg group-hover:bg-indigo-500/10 transition-colors">
              <Plus size={20} />
            </div>
            <span className="text-sm">Set this week's focus</span>
          </button> : <p className="py-6 text-sm text-content-muted">No weekly focus published.</p>
        )}
      </div>
    </div>
  );
};
