import React, { useState, useEffect, useRef } from 'react';
import { Target, Plus, Pencil, X, Check, Loader2, ChevronLeft, ChevronRight, Trash2, BookOpen, Crosshair, MessageSquare, Activity, Timer, Copy } from 'lucide-react';
import {
  getWeeklyPlan,
  upsertWeeklyPlan,
  deleteWeeklyPlan,
  getWeekStart,
  getGroupAssignments,
  type CoachingWeeklyPlan,
  type GroupAssignment,
} from '../../services/coaching/coachingService';

import { Button, Card, Input } from '../ui';
import { Modal } from '../ui/Modal';
import { toast } from 'sonner';
import { useCoachingContext } from '../../hooks/useCoachingContext';

interface WeeklyFocusCardProps {
  teamId: string;
  userId: string;
  initialWeekStart?: string;
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

export const WeeklyFocusCard: React.FC<WeeklyFocusCardProps> = (props) => <WeeklyFocusEditor key={`${props.userId}:${props.teamId}:${props.initialWeekStart ?? getWeekStart()}`} {...props} />;

const WeeklyFocusEditor: React.FC<WeeklyFocusCardProps> = ({ teamId, userId, initialWeekStart }) => {
  const { teams } = useCoachingContext();
  const canEdit = teams.some(t => t.team_id === teamId && t.role === 'coach');
  const [plan, setPlan] = useState<CoachingWeeklyPlan | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [assignmentsReady, setAssignmentsReady] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [weekStart, setWeekStart] = useState(() => initialWeekStart ?? getWeekStart());

  // Edit form state
  const [theme, setTheme] = useState('');
  const [goals, setGoals] = useState<string[]>(['']);
  const [coachingPoints, setCoachingPoints] = useState<string[]>(['']);
  const [drillExamples, setDrillExamples] = useState<string[]>(['']);
  const [pieceExamples, setPieceExamples] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [reflection, setReflection] = useState('');
  const [activeTab, setActiveTab] = useState<'goals' | 'coaching' | 'drills' | 'pieces'>('goals');
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const mounted = useRef(true);
  const mutationLock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [assignmentsRetry, setAssignmentsRetry] = useState(0);
  const loading = loadedKey !== `${teamId}:${weekStart}`;

  // Load plan for current week
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    const key = `${teamId}:${weekStart}`;
    setLoadError(false); setLoadedKey(null); setError('');

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
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoadedKey(key); });

    return () => { cancelled = true; };
  }, [teamId, weekStart, retry]);

  // Load assignments for this week
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    setAssignments([]); setAssignmentsReady(false); setAssignmentsError(false);
    const weekEnd = new Date(weekStart + 'T00:00:00');
    weekEnd.setDate(weekEnd.getDate() + 6);
    const to = weekEnd.toISOString().slice(0, 10);

    getGroupAssignments(teamId, { from: weekStart, to })
      .then((data) => { if (!cancelled) { setAssignments(data); setAssignmentsReady(true); } })
      .catch(() => { if (!cancelled) setAssignmentsError(true); });

    return () => { cancelled = true; };
  }, [teamId, weekStart, assignmentsRetry]);

  const navigateWeek = (direction: -1 | 1) => {
    const current = new Date(weekStart + 'T00:00:00');
    current.setDate(current.getDate() + direction * 7);
    setWeekStart(current.toISOString().slice(0, 10));
    setEditing(false);
  };

  const isCurrentWeek = weekStart === getWeekStart();

  const handleSave = async () => {
    if (!canEdit || mutationLock.current) return;
    mutationLock.current = true;
    setError('');
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
      if (!mounted.current) return;
      setPlan(saved);
      toast.success('Weekly focus saved');
      setEditing(false);
    } catch {
      if (mounted.current) setError('Weekly focus could not be saved. Your draft is kept; try Save again.');
    } finally {
      mutationLock.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit || mutationLock.current) return;
    if (!plan) return;
    mutationLock.current = true;
    setError('');
    setSaving(true);
    try {
      await deleteWeeklyPlan(plan.id);
      if (!mounted.current) return;
      setConfirmDelete(false);
      toast.success('Weekly focus deleted');
      setPlan(null);
      setTheme('');
      setGoals(['']);
      setCoachingPoints(['']);
      setDrillExamples(['']);
      setPieceExamples(['']);
      setNotes('');
      setReflection('');
      setEditing(false);
    } catch {
      if (mounted.current) setError('Weekly focus could not be deleted. Try again.');
    } finally {
      mutationLock.current = false;
      if (mounted.current) setSaving(false);
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
    { key: 'goals' as const, label: 'Goals', icon: Crosshair, color: 'text-accent-coaching-text' },
    { key: 'coaching' as const, label: 'Coaching', icon: MessageSquare, color: 'text-accent-coaching-text' },
    { key: 'drills' as const, label: 'Drills', icon: Activity, color: 'text-accent-coaching-text' },
    { key: 'pieces' as const, label: 'Pieces', icon: Timer, color: 'text-accent-coaching-text' },
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
    plan.notes || plan.reflection || plan.theme ||
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
      if (!mounted.current) return;
      setCopied(true);
      setTimeout(() => { if (mounted.current) setCopied(false); }, 2000);
    } catch {
      // Fallback: plain text
      try { await navigator.clipboard.writeText(text); } catch { setError('Weekly focus could not be copied. Check clipboard permissions and try again.'); return; }
      if (!mounted.current) return;
      setCopied(true);
      setTimeout(() => { if (mounted.current) setCopied(false); }, 2000);
    }
  };

  return (
    <Card padding="none" className="overflow-hidden break-words">
      {/* Header with week navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border bg-surface-secondary/30">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-accent-coaching-text shrink-0" />
          <span className="text-sm font-semibold text-content-primary">Weekly Focus</span>
          {!loading && !loadError && assignmentsReady && (hasContent || assignments.length > 0) && (
            <Button variant="ghost"
              type="button"
              aria-label={copied ? 'Copied!' : 'Copy to clipboard for email'}
              onClick={copyToClipboard}
              className="min-h-11 min-w-11 text-content-muted hover:text-accent-coaching-text transition-colors p-1"
              title={copied ? 'Copied!' : 'Copy to clipboard for email'}
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost"
            type="button"
            disabled={saving}
            aria-label="Previous week"
            onClick={() => navigateWeek(-1)}
            className="min-h-11 min-w-11 p-1 text-content-muted hover:text-content-primary transition-colors shrink-0"
            title="Previous week"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button variant="ghost"
            type="button"
            disabled={saving}
            onClick={() => {
              setWeekStart(getWeekStart());
              setEditing(false);
            }}
            className={`min-h-11 min-w-11 text-xs px-2 py-1 rounded transition-colors truncate ${
              isCurrentWeek
                ? 'text-accent-coaching-text bg-accent-coaching-surface/10'
                : 'text-content-muted hover:text-content-primary hover:bg-surface-elevated'
            }`}
          >
            {formatWeekRange(weekStart)}
          </Button>
          <Button variant="ghost"
            type="button"
            disabled={saving}
            aria-label="Next week"
            onClick={() => navigateWeek(1)}
            className="min-h-11 min-w-11 p-1 text-content-muted hover:text-content-primary transition-colors shrink-0"
            title="Next week"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="px-4 sm:px-5 pt-3">
        <a className="inline-flex items-center min-h-11 text-sm text-accent-coaching-text rounded focus-visible:ring-2 focus-visible:ring-focus" href={`/team-management/schedule?date=${weekStart}`}>Open this week in Schedule</a>
        {assignmentsError && <div><p role="alert">Weekly assignments could not be loaded for sharing.</p><Button variant="secondary" className="min-h-11 min-w-11" onClick={() => setAssignmentsRetry(value => value + 1)}>Retry assignments</Button></div>}
        {error && <p role="alert">{error}</p>}
      </div>
      <Modal open={confirmDelete} title="Delete weekly focus?" onClose={() => { if (!saving) setConfirmDelete(false); }} footer={<Button className="min-h-11 min-w-11" variant="danger" loading={saving} onClick={handleDelete}>Confirm delete</Button>}>
        <p>This removes the focus and reflection for this week.</p>{error && <p role="alert">{error}</p>}
      </Modal>
      {/* Content */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="text-accent-coaching-text animate-spin" />
          </div>
        ) : loadError ? <div><p role="alert">Weekly focus could not be loaded. Check your connection and try again.</p><Button variant="secondary" className="min-h-11 min-w-11" onClick={() => setRetry(value => value + 1)}>Retry weekly focus</Button></div> : editing && canEdit ? (
          /* ─── Edit Mode ────────────────────────────── */
          <div className="space-y-4">
            {/* Theme */}
            <div>
              <label className="text-xs text-content-muted uppercase tracking-wider mb-1 block">
                Theme
              </label>
              <Input
                aria-label="Theme"
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. Build the Stroke"
                className="min-h-11 w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-content-primary placeholder-content-faint focus:outline-none focus:border-accent-coaching"
              />
            </div>

            {/* Tabs */}
            <div>
              <div className="relative">
                <div className="flex flex-wrap gap-1 border-b border-border mb-3 pb-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <Button variant="ghost"
                        key={tab.key}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveTab(tab.key)}
                        className={`min-h-11 min-w-11 shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                          isActive
                            ? `${tab.color} border-current`
                            : 'text-content-muted border-transparent hover:text-content-secondary'
                        }`}
                      >
                        <Icon size={12} />
                        {tab.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Active tab content (edit mode) */}
              {(                /* Editable tab list */
                (() => {
                  const data = tabData[activeTab as keyof typeof tabData];
                  const { items, setter, placeholder } = data;
                  return (
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-content-faint text-sm">•</span>
                          <div className="flex-1 min-w-0"><Input
                            aria-label={`${tabs.find(tab => tab.key === activeTab)?.label} item ${i + 1}`}
                            type="text"
                            value={item}
                            onChange={(e) => updateItem(setter, i, e.target.value)}
                            placeholder={placeholder}
                            className="min-h-11 bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-content-primary placeholder-content-faint focus:outline-none focus:border-accent-coaching"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && item.trim()) {
                                e.preventDefault();
                                addItem(setter);
                              }
                            }}
                          /></div>
                          {items.length > 1 && (
                            <Button variant="ghost"
                              type="button"
                              onClick={() => removeItem(setter, i)}
                              className="min-h-11 min-w-11 text-content-faint hover:text-accent-danger-text transition-colors"
                              aria-label="Remove item"
                            >
                              <X size={14} />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="ghost"
                        type="button"
                        onClick={() => addItem(setter)}
                        className="min-h-11 min-w-11 flex items-center gap-1 text-xs text-accent-coaching-text hover:text-accent-coaching-text transition-colors"
                      >
                        <Plus size={12} />
                        Add item
                      </Button>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-content-muted uppercase tracking-wider mb-1 block">
                Notes
              </label>
              <textarea
                aria-label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra notes for the week..."
                rows={2}
                className="min-h-11 w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-content-primary placeholder-content-faint focus:outline-none focus:border-accent-coaching resize-none"
              />
            </div>

            {/* Reflection */}
            <div>
              <label className="text-xs text-content-muted uppercase tracking-wider mb-1 block">
                <span className="flex items-center gap-1"><BookOpen size={11} /> Reflection</span>
              </label>
              <textarea
                aria-label="Reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="How did the week go? What worked, what to adjust..."
                rows={3}
                className="min-h-11 w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-content-primary placeholder-content-faint focus:outline-none focus:border-accent-coaching resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="coaching"
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="min-h-11 min-w-11 flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save
              </Button>
              <Button variant="ghost"
                type="button"
                disabled={saving}
                onClick={() => setEditing(false)}
                className="min-h-11 min-w-11 text-sm text-content-muted hover:text-content-primary px-3 py-2 transition-colors"
              >
                Cancel
              </Button>
              {plan && (
                <Button variant="ghost"
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                  className="min-h-11 min-w-11 ml-auto flex items-center gap-1 text-xs text-accent-danger-text hover:text-accent-danger-text transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  Delete
                </Button>
              )}
            </div>
          </div>
        ) : hasContent ? (
          /* ─── Display Mode ─────────────────────────── */
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                {plan!.theme && (
                  <h3 className="text-content-primary font-semibold text-lg">{plan!.theme}</h3>
                )}
              </div>
              {canEdit && (<Button variant="ghost"
                type="button"
                aria-label="Edit this week"
                onClick={() => setEditing(true)}
                className="min-h-11 min-w-11 text-content-muted hover:text-accent-coaching-text transition-colors p-1"
                title="Edit this week"
              >
                <Pencil size={14} />
              </Button>)}
            </div>

            {/* Tabs (display) */}
            <div>
              <div className="relative">
                <div className="flex flex-wrap gap-1 border-b border-border mb-3 pb-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    const count = planTabData?.[tab.key]?.length ?? 0;
                    return (
                      <Button variant="ghost"
                        key={tab.key}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveTab(tab.key)}
                        className={`min-h-11 min-w-11 shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                          isActive
                            ? `${tab.color} border-current`
                            : 'text-content-muted border-transparent hover:text-content-secondary'
                        }`}
                      >
                        <Icon size={12} />
                        {tab.label}
                        {count > 0 && (
                          <span className="text-[10px] bg-surface-secondary text-content-secondary px-1.5 py-0.5 rounded-full">
                            {count}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Active tab content */}
              {(() => {
                const items = planTabData?.[activeTab as keyof typeof planTabData] ?? [];
                if (items.length === 0) {
                  return (
                    <p className="text-xs text-content-faint italic py-2">No items set</p>
                  );
                }
                return (
                  <ul className="space-y-1.5">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 ${tabs.find((t) => t.key === activeTab)?.color ?? 'text-accent-coaching-text'}`}>•</span>
                        <span className="text-content-secondary">{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            {plan!.notes && (
              <p className="text-xs text-content-muted italic border-t border-border pt-2 mt-2">
                {plan!.notes}
              </p>
            )}

            {plan!.reflection && (
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-accent-coaching-text/70 font-medium mb-1.5">
                  <BookOpen size={12} />
                  Reflection
                </div>
                <p className="text-sm text-content-secondary whitespace-pre-wrap">{plan!.reflection}</p>
              </div>
            )}
          </div>
        ) : (
          /* ─── Empty State ──────────────────────────── */
          canEdit ? <Button variant="ghost"
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 min-w-11 w-full flex flex-col items-center gap-2 py-6 text-content-muted hover:text-accent-coaching-text transition-colors group"
          >
            <div className="p-3 bg-surface-secondary rounded-lg group-hover:bg-accent-coaching-surface/10 transition-colors">
              <Plus size={20} />
            </div>
            <span className="text-sm">Set this week's focus</span>
          </Button> : <p className="py-6 text-sm text-content-muted">No weekly focus published.</p>
        )}
      </div>
    </Card>
  );
};
