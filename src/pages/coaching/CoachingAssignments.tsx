import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import {
  getGroupAssignments,
  createGroupAssignment,
  deleteGroupAssignment,
  updateGroupAssignment,
  getAthleteAssignmentRows,
  saveAssignmentResults,
  markAssignmentAsTest,
  getComplianceData,
  getAthletes,
  getTeamSquads,
  type GroupAssignment,
  type GroupAssignmentInput,
  type CoachingAthlete,
  type IntervalResult,
  type ComplianceCell,
} from '../../services/coaching/coachingService';
import { fetchTemplates } from '../../services/templateService';
import type { WorkoutTemplateListItem } from '../../types/workoutStructure.types';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { format, addDays, startOfWeek, endOfWeek, isToday, eachDayOfInterval, parseISO } from 'date-fns';
import {
  Plus, Trash2, Loader2, ChevronLeft, ChevronRight,
  Calendar, ClipboardList, Search, CheckSquare, X, Edit2, Repeat,
  BarChart3, CheckCircle2, Circle, Timer,
} from 'lucide-react';
import { calculateWattsFromSplit } from '../../utils/paceCalculator';
import { toast } from 'sonner';
import {
  parseWorkoutStructureForEntry,
  parseCanonicalForEntry,
  computeSplit,
  fmtTime,
  parseTimeInput,
  type EntryShape,
} from '../../utils/workoutEntryClassifier';

// ─── Main Page ──────────────────────────────────────────────────────────────

export function CoachingAssignments() {
  const { userId, teamId, isLoadingTeam } = useCoachingContext();

  // Data
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [squads, setSquads] = useState<string[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplateListItem[]>([]);

  // UI
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [bulkCompleteAssignmentId, setBulkCompleteAssignmentId] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<GroupAssignment | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'compliance'>('calendar');
  const [complianceCells, setComplianceCells] = useState<ComplianceCell[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Computed dates
  const today = new Date();
  const refDate = addDays(today, weekOffset * 7);
  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadData = useCallback(async () => {
    if (!teamId) return;
    try {
      const fromStr = format(weekStart, 'yyyy-MM-dd');
      const toStr = format(weekEnd, 'yyyy-MM-dd');
      const [asgn, ath, sq, tmpl, compliance] = await Promise.all([
        getGroupAssignments(teamId, { from: fromStr, to: toStr }),
        getAthletes(teamId),
        getTeamSquads(teamId),
        fetchTemplates({ sortBy: 'popular' }),
        getComplianceData(teamId, fromStr, toStr),
      ]);
      setAssignments(asgn);
      setAthletes(ath);
      setSquads(sq);
      setTemplates(tmpl);
      setComplianceCells(compliance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, weekStart.toISOString(), weekEnd.toISOString()]);

  useEffect(() => {
    if (!isLoadingTeam && teamId) {
      setIsLoading(true);
      loadData();
    }
  }, [isLoadingTeam, teamId, loadData]);

  const handleCreate = async (input: GroupAssignmentInput, athleteIds: string[]) => {
    try {
      await createGroupAssignment(input, athleteIds);
      toast.success('Workout assigned');
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create assignment');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGroupAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      toast.success('Assignment removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleEdit = async (id: string, updates: { title?: string | null; instructions?: string | null; scheduled_date?: string }) => {
    try {
      await updateGroupAssignment(id, updates);
      toast.success('Assignment updated');
      setEditingAssignment(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  // Group assignments by date
  const assignmentsByDate = new Map<string, GroupAssignment[]>();
  for (const a of assignments) {
    const key = a.scheduled_date;
    if (!assignmentsByDate.has(key)) assignmentsByDate.set(key, []);
    assignmentsByDate.get(key)!.push(a);
  }

  if (isLoadingTeam || isLoading) {
    return (
      <>
        <CoachingNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CoachingNav />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300">
            {error}
            <button onClick={loadData} className="ml-3 underline hover:text-red-200">
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CoachingNav />
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-100">Workout Assignments</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Assign workouts to your team and track completion.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Assign Workout
          </button>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-sm font-medium text-neutral-300">
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </span>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="ml-3 text-xs text-indigo-400 hover:text-indigo-300"
              >
                Today
              </button>
            )}
          </div>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-1 bg-neutral-800/50 rounded-lg p-1 w-fit">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'calendar'
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setViewMode('compliance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'compliance'
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Compliance
          </button>
        </div>

        {viewMode === 'compliance' ? (
          <ComplianceGrid
            assignments={assignments}
            athletes={athletes}
            cells={complianceCells}
            onOpenResults={(id) => setBulkCompleteAssignmentId(id)}
          />
        ) : (
        <>
        {/* Week Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayAssignments = assignmentsByDate.get(dateStr) ?? [];
            const today_ = isToday(date);

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`rounded-lg border p-3 min-h-[120px] transition-colors cursor-pointer ${
                  selectedDate === dateStr
                    ? 'border-indigo-500 bg-indigo-900/20 ring-1 ring-indigo-500/40'
                    : today_
                      ? 'border-indigo-500/30 bg-indigo-900/5 hover:bg-indigo-900/10'
                      : 'border-neutral-800 bg-neutral-900/30 hover:bg-neutral-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs font-medium text-neutral-500 uppercase">
                      {format(date, 'EEE')}
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        today_ ? 'text-indigo-400' : 'text-neutral-300'
                      }`}
                    >
                      {format(date, 'd')}
                    </div>
                  </div>
                </div>

                {dayAssignments.length === 0 ? (
                  <div className="text-xs text-neutral-600 italic">No workouts</div>
                ) : (
                  <div className="space-y-1.5">
                    {dayAssignments.map((a) => (
                      <AssignmentCard
                        key={a.id}
                        assignment={a}
                        onDelete={handleDelete}
                        onEdit={() => setEditingAssignment(a)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Day Detail Panel */}
        {(() => {
          const dayAssignments = assignmentsByDate.get(selectedDate) ?? [];
          if (dayAssignments.length === 0) return null;
          const parsedDate = parseISO(selectedDate);
          const isSelectedToday = isToday(parsedDate);

          return (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-semibold text-neutral-100">
                  {isSelectedToday
                    ? "Today\u2019s Workouts"
                    : `${format(parsedDate, 'EEEE, MMM d')} Workouts`}
                </h2>
              </div>
              {dayAssignments.map((a) => (
                <div
                  key={a.id}
                  className="bg-neutral-800/50 rounded-lg p-4 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <ClipboardList className="w-4 h-4 text-indigo-400 shrink-0 hidden sm:block" />
                    <span className="font-medium text-neutral-200">
                      {a.title || a.template_name || 'Workout'}
                    </span>
                    {a.training_zone && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 self-start">
                        {a.training_zone}
                      </span>
                    )}
                    {a.canonical_name && (
                      <span className="text-xs text-neutral-500 font-mono">
                        {a.canonical_name}
                      </span>
                    )}
                    <button
                      onClick={() => setBulkCompleteAssignmentId(a.id)}
                      className="sm:ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors self-start"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Enter Results
                    </button>
                  </div>
                  {a.instructions && (
                    <p className="text-sm text-neutral-400 pl-7">{a.instructions}</p>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        </>
        )}

        {/* Create Form Modal */}
        {showCreateForm && (
          <CreateAssignmentForm
            teamId={teamId}
            userId={userId}
            athletes={athletes}
            squads={squads}
            templates={templates}
            onCreate={handleCreate}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {/* Results Entry Modal */}
        {bulkCompleteAssignmentId && (
          <ResultsEntryModal
            groupAssignmentId={bulkCompleteAssignmentId}
            assignment={assignments.find((a) => a.id === bulkCompleteAssignmentId)!}
            athletes={athletes}
            teamId={teamId!}
            userId={userId}
            onClose={() => setBulkCompleteAssignmentId(null)}
            onComplete={loadData}
          />
        )}

        {/* Edit Assignment Modal */}
        {editingAssignment && (
          <EditAssignmentModal
            assignment={editingAssignment}
            onSave={(updates) => handleEdit(editingAssignment.id, updates)}
            onClose={() => setEditingAssignment(null)}
          />
        )}
      </div>
    </>
  );
}

// ─── Assignment Card (in week grid) ─────────────────────────────────────────

function AssignmentCard({
  assignment,
  onDelete,
  onEdit,
}: {
  assignment: GroupAssignment;
  onDelete: (id: string) => void;
  onEdit: () => void;
}) {
  const zoneBg: Record<string, string> = {
    UT2: 'bg-green-900/40 text-green-400',
    UT1: 'bg-emerald-900/40 text-emerald-400',
    AT: 'bg-yellow-900/40 text-yellow-400',
    TR: 'bg-orange-900/40 text-orange-400',
    AN: 'bg-red-900/40 text-red-400',
  };

  return (
    <div className="group flex items-start gap-1.5 bg-neutral-800/50 rounded p-1.5">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="text-xs font-medium text-neutral-200 truncate">
          {assignment.title || assignment.template_name || 'Workout'}
        </div>
        {assignment.training_zone && (
          <span
            className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-0.5 ${
              zoneBg[assignment.training_zone] ?? 'bg-neutral-700 text-neutral-300'
            }`}
          >
            {assignment.training_zone}
          </span>
        )}
      </div>
      <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
        <button
          onClick={onEdit}
          className="p-0.5 text-neutral-600 hover:text-indigo-400 transition-colors"
          aria-label="Edit assignment"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDelete(assignment.id)}
          className="p-0.5 text-neutral-600 hover:text-red-400 transition-colors"
          aria-label="Delete assignment"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Create Assignment Form (overlay) ───────────────────────────────────────

function CreateAssignmentForm({
  teamId,
  userId,
  athletes,
  squads,
  templates,
  onCreate,
  onCancel,
}: {
  teamId: string;
  userId: string;
  athletes: CoachingAthlete[];
  squads: string[];
  templates: WorkoutTemplateListItem[];
  onCreate: (input: GroupAssignmentInput, athleteIds: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [assignTo, setAssignTo] = useState<'all' | 'squad'>('all');
  const [selectedSquad, setSelectedSquad] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'daily' | 'weekdays' | 'weekly'>('none');
  const [repeatUntil, setRepeatUntil] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  // Filter templates by search
  const filteredTemplates = templateSearch
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
          (t.canonical_name ?? '').toLowerCase().includes(templateSearch.toLowerCase())
      )
    : templates;

  const selectedTemplate = templates.find((t) => t.id === templateId);

  // Determine which athletes get this assignment
  const targetAthleteIds =
    assignTo === 'all'
      ? athletes.map((a) => a.id)
      : athletes.filter((a) => a.squad === selectedSquad).map((a) => a.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId) {
      toast.error('Please select a workout template');
      return;
    }
    if (targetAthleteIds.length === 0) {
      toast.error('No athletes match the selected group');
      return;
    }

    setIsSaving(true);
    try {
      // Generate all dates based on recurrence
      const dates: string[] = [date];
      if (repeatMode !== 'none') {
        const startDate = parseISO(date);
        const endDate = parseISO(repeatUntil);
        if (endDate > startDate) {
          const allDays = eachDayOfInterval({ start: addDays(startDate, 1), end: endDate });
          for (const d of allDays) {
            const dow = d.getDay();
            if (repeatMode === 'daily') {
              dates.push(format(d, 'yyyy-MM-dd'));
            } else if (repeatMode === 'weekdays' && dow >= 1 && dow <= 5) {
              dates.push(format(d, 'yyyy-MM-dd'));
            } else if (repeatMode === 'weekly' && dow === startDate.getDay()) {
              dates.push(format(d, 'yyyy-MM-dd'));
            }
          }
        }
      }

      for (const d of dates) {
        await onCreate(
          {
            team_id: teamId,
            template_id: templateId,
            scheduled_date: d,
            title: title || null,
            instructions: instructions || null,
            created_by: userId,
          },
          targetAthleteIds
        );
      }
      if (dates.length > 1) {
        toast.success(`Created ${dates.length} assignments`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <h2 className="text-lg font-semibold text-neutral-100">Assign Workout</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Template Search + Select */}
            <div>
              <label htmlFor="assignment-template-select" className="block text-sm font-medium text-neutral-300 mb-1">
                Workout Template
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <select
                id="assignment-template-select"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                size={5}
                aria-label="Workout Template"
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="" disabled>
                  Select a template…
                </option>
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.canonical_name ? ` (${t.canonical_name})` : ''}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <div className="mt-1.5 text-xs text-neutral-500">
                  {selectedTemplate.workout_type}
                  {selectedTemplate.canonical_name && (
                    <span className="ml-2 font-mono">{selectedTemplate.canonical_name}</span>
                  )}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="assignment-date" className="block text-sm font-medium text-neutral-300 mb-1">
                Date
              </label>
              <input
                id="assignment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Assign To */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Assign To
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="radio"
                    name="assignTo"
                    checked={assignTo === 'all'}
                    onChange={() => setAssignTo('all')}
                    className="accent-indigo-500"
                  />
                  All Athletes ({athletes.length})
                </label>
                {squads.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="radio"
                      name="assignTo"
                      checked={assignTo === 'squad'}
                      onChange={() => setAssignTo('squad')}
                      className="accent-indigo-500"
                    />
                    Squad
                  </label>
                )}
              </div>
              {assignTo === 'squad' && (
                <>
                  <label htmlFor="assignment-squad-select" className="block text-sm font-medium text-neutral-300 mt-2 mb-1">
                    Squad
                  </label>
                  <select
                    id="assignment-squad-select"
                    value={selectedSquad}
                    onChange={(e) => setSelectedSquad(e.target.value)}
                    aria-label="Squad"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select squad…</option>
                    {squads.map((s) => (
                      <option key={s} value={s}>
                        {s} ({athletes.filter((a) => a.squad === s).length} athletes)
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div className="mt-1 text-xs text-neutral-500">
                {targetAthleteIds.length} athlete{targetAthleteIds.length !== 1 ? 's' : ''} will
                receive this assignment
              </div>
            </div>

            {/* Title (optional) */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Title <span className="text-neutral-500">(optional override)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={selectedTemplate?.name ?? 'e.g. Morning Erg Session'}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Instructions (optional) */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Instructions <span className="text-neutral-500">(optional)</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. Target rate 18-20, focus on connection at the catch"
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Repeat */}
            <div>
              <label htmlFor="repeat-mode" className="block text-sm font-medium text-neutral-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-indigo-400" />
                  Repeat
                </span>
              </label>
              <select
                id="repeat-mode"
                value={repeatMode}
                onChange={(e) => setRepeatMode(e.target.value as typeof repeatMode)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays (Mon–Fri)</option>
                <option value="weekly">Weekly (same day)</option>
              </select>
              {repeatMode !== 'none' && (
                <div className="mt-2">
                  <label htmlFor="repeat-until" className="block text-xs font-medium text-neutral-400 mb-1">
                    Repeat until
                  </label>
                  <input
                    id="repeat-until"
                    type="date"
                    value={repeatUntil}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                    min={date}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !templateId}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Assign
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Results Entry Modal ────────────────────────────────────────────────────

interface AthleteResultEntry {
  athlete_id: string;
  completed: boolean;
  wasCompleted: boolean;
  /** The measured value — time for fixed_distance, distance for fixed_time */
  primary: string;
  /** Stroke rate (spm) */
  spm: string;
  /** Per-rep measured values for interval workouts */
  reps: string[];
  /** Per-rep spm for interval workouts */
  repSpm: string[];
  /** Mark this result as a test/baseline — auto-creates erg score */
  isTest: boolean;
}

function ResultsEntryModal({
  groupAssignmentId,
  assignment,
  athletes,
  teamId,
  userId,
  onClose,
  onComplete,
}: {
  groupAssignmentId: string;
  assignment: GroupAssignment;
  athletes: CoachingAthlete[];
  teamId: string;
  userId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  // Classify the workout once (memoized to avoid unstable refs triggering reloads)
  const shape: EntryShape = useMemo(() => {
    const shapeSource = assignment.canonical_name;
    const shapeLabelSource = assignment.canonical_name ?? assignment.template_name ?? assignment.title;
    return (
      parseWorkoutStructureForEntry(assignment.workout_structure, shapeLabelSource ?? undefined) ??
      parseCanonicalForEntry(shapeSource)
    );
  }, [assignment.canonical_name, assignment.template_name, assignment.title, assignment.workout_structure]);
  const isInterval = shape.reps > 1;

  const [entries, setEntries] = useState<AthleteResultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const rows = await getAthleteAssignmentRows(groupAssignmentId);
        if (cancelled) return;
        const mapped: AthleteResultEntry[] = rows.map((r) => {
          const existingIntervals = (r.result_intervals ?? []) as IntervalResult[];

          // Determine primary value from existing data
          let primary = '';
          if (shape.type === 'fixed_distance' || shape.type === 'freeform') {
            primary = fmtTime(r.result_time_seconds);
          } else if (shape.type === 'fixed_time') {
            primary = r.result_distance_meters ? String(r.result_distance_meters) : '';
          }

          // Build per-rep values from existing intervals
          const reps: string[] = [];
          const repSpm: string[] = [];
          for (let i = 0; i < shape.reps; i++) {
            const iv = existingIntervals[i];
            if (shape.type === 'distance_interval') {
              reps.push(iv ? fmtTime(iv.time_seconds) : '');
            } else if (shape.type === 'time_interval') {
              reps.push(iv?.distance_meters ? String(iv.distance_meters) : '');
            } else if (shape.type === 'variable_interval' && shape.variableReps) {
              const vr = shape.variableReps[i];
              if (vr?.fixedType === 'distance') {
                reps.push(iv ? fmtTime(iv.time_seconds) : '');
              } else {
                reps.push(iv?.distance_meters ? String(iv.distance_meters) : '');
              }
            } else {
              reps.push('');
            }
            repSpm.push(iv?.stroke_rate ? String(iv.stroke_rate) : '');
          }

          return {
            athlete_id: r.athlete_id,
            completed: r.completed,
            wasCompleted: r.completed,
            primary,
            spm: r.result_stroke_rate ? String(r.result_stroke_rate) : '',
            reps,
            repSpm,
            isTest: assignment.is_test_template ?? false,
          };
        });
        setEntries(mapped);
      } catch {
        if (!cancelled) {
          toast.error('Failed to load athlete assignments');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignment.is_test_template, groupAssignmentId, shape]);

  const athleteMap = new Map(athletes.map((a) => [a.id, a]));

  const updateEntry = (idx: number, field: keyof AthleteResultEntry, value: string | boolean) => {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const updateRep = (entryIdx: number, repIdx: number, value: string) => {
    setEntries((prev) => {
      const next = [...prev];
      const reps = [...next[entryIdx].reps];
      reps[repIdx] = value;
      next[entryIdx] = { ...next[entryIdx], reps };
      return next;
    });
  };

  const markAllComplete = () => {
    setEntries((prev) =>
      prev.map((e) => (e.wasCompleted ? e : { ...e, completed: true }))
    );
  };

  /** Compute the displayed split for the overall result */
  const getOverallSplit = (entry: AthleteResultEntry): string => {
    if (shape.type === 'fixed_distance' && shape.fixedDistance) {
      const timeSec = parseTimeInput(entry.primary);
      if (timeSec) {
        const s = computeSplit(timeSec, shape.fixedDistance);
        return s ? fmtTime(s) : '';
      }
    }
    if (shape.type === 'fixed_time' && shape.fixedTime) {
      const distM = parseFloat(entry.primary);
      if (distM) {
        const s = computeSplit(shape.fixedTime, distM);
        return s ? fmtTime(s) : '';
      }
    }
    return '';
  };

  /** Compute the displayed split for a single rep */
  const getRepSplit = (entry: AthleteResultEntry, repIdx: number): string => {
    const val = entry.reps[repIdx];
    if (!val) return '';

    if (shape.type === 'distance_interval' && shape.fixedDistance) {
      const timeSec = parseTimeInput(val);
      if (timeSec) {
        const s = computeSplit(timeSec, shape.fixedDistance);
        return s ? fmtTime(s) : '';
      }
    }
    if (shape.type === 'time_interval' && shape.fixedTime) {
      const distM = parseFloat(val);
      if (distM) {
        const s = computeSplit(shape.fixedTime, distM);
        return s ? fmtTime(s) : '';
      }
    }
    if (shape.type === 'variable_interval' && shape.variableReps) {
      const vr = shape.variableReps[repIdx];
      if (vr?.fixedType === 'distance') {
        const timeSec = parseTimeInput(val);
        if (timeSec) {
          const s = computeSplit(timeSec, vr.fixedValue);
          return s ? fmtTime(s) : '';
        }
      } else if (vr?.fixedType === 'time') {
        const distM = parseFloat(val);
        if (distM) {
          const s = computeSplit(vr.fixedValue, distM);
          return s ? fmtTime(s) : '';
        }
      }
    }
    return '';
  };

  /** Compute average split across all reps for interval workouts */
  const getAvgSplit = (entry: AthleteResultEntry): string => {
    if (!isInterval) return getOverallSplit(entry);
    const splits: number[] = [];
    for (let i = 0; i < shape.reps; i++) {
      const s = getRepSplit(entry, i);
      if (s) {
        const parsed = parseTimeInput(s);
        if (parsed) splits.push(parsed);
      }
    }
    if (splits.length === 0) return '';
    const avg = splits.reduce((a, b) => a + b, 0) / splits.length;
    return fmtTime(avg);
  };

  const handleSave = async () => {
    const results = entries
      .filter((e) => {
        if (e.wasCompleted && !e.primary && e.reps.every((r) => !r)) return false;
        return true;
      })
      .map((e) => {
        let resultTime: number | null = null;
        let resultDist: number | null = null;
        let resultSplit: number | null = null;
        const resultSpm = e.spm ? parseInt(e.spm, 10) || null : null;

        if (shape.type === 'fixed_distance') {
          resultTime = parseTimeInput(e.primary);
          resultDist = shape.fixedDistance ?? null;
          if (resultTime && resultDist) resultSplit = computeSplit(resultTime, resultDist);
        } else if (shape.type === 'fixed_time') {
          resultDist = e.primary ? parseFloat(e.primary) || null : null;
          resultTime = shape.fixedTime ?? null;
          if (resultTime && resultDist) resultSplit = computeSplit(resultTime, resultDist);
        } else if (shape.type === 'freeform') {
          resultTime = parseTimeInput(e.primary);
          // For freeform, distance would need a separate field — skip for now
        }

        // Build interval results
        let resultIntervals: IntervalResult[] | null = null;
        if (isInterval) {
          resultIntervals = e.reps.map((val, i) => {
            let ivTime: number | null = null;
            let ivDist: number | null = null;
            let ivSplit: number | null = null;
            const ivSpm = (e.repSpm[i] ? parseInt(e.repSpm[i], 10) : null) || resultSpm;

            if (shape.type === 'distance_interval' && shape.fixedDistance) {
              ivTime = parseTimeInput(val);
              ivDist = shape.fixedDistance;
              if (ivTime) ivSplit = computeSplit(ivTime, ivDist);
            } else if (shape.type === 'time_interval' && shape.fixedTime) {
              ivDist = val ? parseFloat(val) || null : null;
              ivTime = shape.fixedTime;
              if (ivDist) ivSplit = computeSplit(shape.fixedTime, ivDist);
            } else if (shape.type === 'variable_interval' && shape.variableReps) {
              const vr = shape.variableReps[i];
              if (vr?.fixedType === 'distance') {
                ivTime = parseTimeInput(val);
                ivDist = vr.fixedValue;
                if (ivTime) ivSplit = computeSplit(ivTime, ivDist);
              } else if (vr?.fixedType === 'time') {
                ivDist = val ? parseFloat(val) || null : null;
                ivTime = vr.fixedValue;
                if (ivDist) ivSplit = computeSplit(vr.fixedValue, ivDist);
              }
            }

            return {
              rep: i + 1,
              time_seconds: ivTime,
              distance_meters: ivDist,
              split_seconds: ivSplit,
              stroke_rate: ivSpm,
            };
          });

          // Also compute totals from interval data
          const totalTime = resultIntervals.reduce((sum, iv) => sum + (iv.time_seconds ?? 0), 0);
          const totalDist = resultIntervals.reduce((sum, iv) => sum + (iv.distance_meters ?? 0), 0);
          if (totalTime > 0) resultTime = totalTime;
          if (totalDist > 0) resultDist = totalDist;
          if (totalTime > 0 && totalDist > 0) resultSplit = computeSplit(totalTime, totalDist);
        }

        return {
          athlete_id: e.athlete_id,
          completed: e.completed || e.wasCompleted,
          result_time_seconds: resultTime,
          result_distance_meters: resultDist,
          result_split_seconds: resultSplit,
          result_stroke_rate: resultSpm,
          result_intervals: resultIntervals,
          _isTest: e.isTest,
        };
      });

    if (results.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await saveAssignmentResults(groupAssignmentId, results);

      // Mark tests and create erg scores for any entries flagged as test
      const testEntries = results.filter(r => r._isTest && r.completed && r.result_time_seconds && r.result_distance_meters);

      if (testEntries.length > 0) {
        // Fetch individual daily_workout_assignment rows to get per-athlete IDs
        const rows = await getAthleteAssignmentRows(groupAssignmentId);
        for (const r of testEntries) {
          const row = rows.find(row => row.athlete_id === r.athlete_id);
          if (!row) continue;
          await markAssignmentAsTest(
            row.id,
            true,
            {
              teamId,
              coachUserId: userId,
              athleteId: r.athlete_id,
              date: assignment.scheduled_date,
              distance: r.result_distance_meters!,
              time_seconds: r.result_time_seconds!,
              split_500m: r.result_split_seconds ?? undefined,
              watts: r.result_split_seconds
                ? calculateWattsFromSplit(r.result_split_seconds)
                : undefined,
              stroke_rate: r.result_stroke_rate ?? undefined,
            }
          );
        }
      }

      const completed = results.filter((r) => r.completed).length;
      const testCount = testEntries.length;
      const msg = testCount > 0
        ? `Saved results for ${completed} athlete${completed !== 1 ? 's' : ''} (${testCount} marked as test)`
        : `Saved results for ${completed} athlete${completed !== 1 ? 's' : ''}`;
      toast.success(msg);
      onComplete();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Column labels ──
  const primaryLabel =
    shape.type === 'fixed_distance' ? 'Time' :
    shape.type === 'fixed_time' ? 'Distance' :
    'Time';
  const primaryPlaceholder =
    shape.type === 'fixed_time' ? 'meters' : 'm:ss.s';
  const getRepInputKind = (repIdx: number): 'time' | 'distance' => {
    if (shape.type === 'distance_interval') return 'time';
    if (shape.type === 'time_interval') return 'distance';
    if (shape.type === 'variable_interval' && shape.variableReps) {
      return shape.variableReps[repIdx]?.fixedType === 'time' ? 'distance' : 'time';
    }
    return 'time';
  };

  const getRepInputLabel = (repIdx: number): string => {
    const kind = getRepInputKind(repIdx);
    return kind === 'distance' ? 'Dist' : 'Time';
  };

  const getRepInputPlaceholder = (repIdx: number): string => {
    const kind = getRepInputKind(repIdx);
    return kind === 'distance' ? 'm' : 'm:ss.s';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">Enter Results</h2>
            <p className="text-sm text-neutral-400 mt-0.5">
              {assignment.title || assignment.template_name || 'Workout'}
              {assignment.training_zone && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  {assignment.training_zone}
                </span>
              )}
              {assignment.is_test_template && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-400 font-medium">
                  TEST
                </span>
              )}
              <span className="ml-2 text-xs text-neutral-500">{shape.label}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">No athletes assigned.</p>
          ) : (
            <div className="space-y-0">
              {/* Column headers — desktop only */}
              <div className="hidden md:flex items-end gap-2 pb-2 border-b border-neutral-800 text-xs font-medium text-neutral-500 uppercase">
                <div className="w-6" />
                <div className="w-36">Athlete</div>
                {!isInterval && (
                  <>
                    <div className="w-24">{primaryLabel}</div>
                    <div className="w-16">SPM</div>
                    <div className="w-20">Split</div>
                  </>
                )}
                {isInterval && (
                  <>
                    {Array.from({ length: shape.reps }, (_, i) => {
                      const repHeaderLabel = shape.type === 'variable_interval' && shape.variableReps
                        ? shape.variableReps[i]?.label ?? `R${i + 1}`
                        : `R${i + 1}`;
                      return (
                        <div key={i} className="w-20 text-center">
                          <div>{repHeaderLabel}</div>
                          <div className="text-[9px] text-neutral-600 normal-case">{getRepInputLabel(i)}</div>
                        </div>
                      );
                    })}
                    <div className="w-16 text-center">SPM</div>
                    <div className="w-20 text-center">Avg Split</div>
                  </>
                )}
                <div className="w-10 text-center" title="Mark as test/baseline — creates an erg score">Test</div>
              </div>

              {/* Mark all */}
              <div className="py-1.5">
                <button
                  onClick={markAllComplete}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Mark all complete
                </button>
              </div>

              {entries.map((entry, idx) => {
                const athlete = athleteMap.get(entry.athlete_id);
                return (
                  <div
                    key={entry.athlete_id}
                    className={`py-3 md:py-2 ${idx > 0 ? 'border-t border-neutral-800/50' : ''}`}
                  >
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={entry.completed}
                        onChange={(e) => updateEntry(idx, 'completed', e.target.checked)}
                        disabled={entry.wasCompleted}
                        className="accent-emerald-500 w-4 h-4"
                        aria-label={`Mark ${athlete?.name ?? 'athlete'} complete`}
                      />

                      {/* Name */}
                      <div className="w-full md:w-36 truncate">
                        <span className={`text-sm font-medium md:font-normal ${entry.wasCompleted ? 'text-emerald-400/60' : 'text-neutral-200'}`}>
                          {athlete?.name ?? 'Unknown'}
                        </span>
                        {athlete?.squad && (
                          <span className="ml-2 md:ml-0 md:block text-[10px] text-neutral-500">{athlete.squad}</span>
                        )}
                      </div>

                      {/* Single-piece entry */}
                      {!isInterval && (
                        <div className="flex items-center gap-2 w-full md:w-auto mt-1 md:mt-0 pl-6 md:pl-0">
                          <div className="md:hidden text-[10px] text-neutral-500 uppercase w-10 shrink-0">{primaryLabel}</div>
                          <input
                            type="text"
                            value={entry.primary}
                            onChange={(e) => updateEntry(idx, 'primary', e.target.value)}
                            placeholder={primaryPlaceholder}
                            className="w-24 px-2 py-1.5 text-sm rounded bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                          />
                          <div className="md:hidden text-[10px] text-neutral-500 uppercase w-8 shrink-0">SPM</div>
                          <input
                            type="text"
                            value={entry.spm}
                            onChange={(e) => updateEntry(idx, 'spm', e.target.value)}
                            placeholder="spm"
                            className="w-16 px-2 py-1.5 text-sm rounded bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                          />
                          <span className="w-20 text-sm text-neutral-500 italic">
                            {getOverallSplit(entry)}
                          </span>
                        </div>
                      )}

                      {/* Interval entry */}
                      {isInterval && (
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto mt-1 md:mt-0 pl-6 md:pl-0">
                          {entry.reps.map((repVal, repIdx) => {
                            const repHeaderLabel = shape.type === 'variable_interval' && shape.variableReps
                              ? shape.variableReps[repIdx]?.label ?? `R${repIdx + 1}`
                              : `R${repIdx + 1}`;
                            return (
                              <div key={repIdx} className="w-20">
                                <div className="md:hidden text-[10px] text-neutral-500 uppercase mb-0.5">{repHeaderLabel}</div>
                                <input
                                  type="text"
                                  value={repVal}
                                  onChange={(e) => updateRep(idx, repIdx, e.target.value)}
                                  placeholder={getRepInputPlaceholder(repIdx)}
                                  className="w-full px-1.5 py-1.5 text-xs rounded bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                                />
                                {getRepSplit(entry, repIdx) && (
                                  <div className="text-[10px] text-neutral-500 italic text-center mt-0.5">
                                    {getRepSplit(entry, repIdx)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div>
                            <div className="md:hidden text-[10px] text-neutral-500 uppercase mb-0.5">SPM</div>
                            <input
                              type="text"
                              value={entry.spm}
                              onChange={(e) => updateEntry(idx, 'spm', e.target.value)}
                              placeholder="spm"
                              className="w-16 px-1.5 py-1.5 text-xs rounded bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <span className="w-20 text-sm text-neutral-500 italic text-center">
                            {getAvgSplit(entry)}
                          </span>
                        </div>
                      )}

                      {/* Test toggle */}
                      <button
                        type="button"
                        title={entry.isTest ? 'Unmark as test' : 'Mark as test / baseline'}
                        onClick={() => {
                          setEntries(prev => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], isTest: !next[idx].isTest };
                            return next;
                          });
                        }}
                        className={`w-10 flex items-center justify-center p-1.5 rounded-md transition-colors ${
                          entry.isTest
                            ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                            : 'text-neutral-600 hover:text-neutral-400 hover:bg-neutral-700/50'
                        }`}
                      >
                        <Timer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-5 border-t border-neutral-800 gap-3">
          <div className="text-xs text-neutral-600 text-center sm:text-left">
            {shape.type !== 'freeform' && (
              <>Split auto-calculated</>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Results
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compliance Grid ────────────────────────────────────────────────────────

function ComplianceGrid({
  assignments,
  athletes,
  cells,
  onOpenResults,
}: {
  assignments: GroupAssignment[];
  athletes: CoachingAthlete[];
  cells: ComplianceCell[];
  onOpenResults: (groupAssignmentId: string) => void;
}) {
  // Build lookup: `${athlete_id}:${group_assignment_id}` → cell
  const cellMap = new Map<string, ComplianceCell>();
  for (const c of cells) {
    cellMap.set(`${c.athlete_id}:${c.group_assignment_id}`, c);
  }

  // Sort athletes by squad then name
  const sortedAthletes = [...athletes].sort((a, b) => {
    const sq = (a.squad ?? '').localeCompare(b.squad ?? '');
    if (sq !== 0) return sq;
    return a.name.localeCompare(b.name);
  });

  // Sort assignments by date
  const sortedAssignments = [...assignments].sort(
    (a, b) => a.scheduled_date.localeCompare(b.scheduled_date)
  );

  // Group athletes by squad
  const squads = new Map<string, CoachingAthlete[]>();
  for (const a of sortedAthletes) {
    const sq = a.squad ?? 'Unassigned';
    if (!squads.has(sq)) squads.set(sq, []);
    squads.get(sq)!.push(a);
  }

  if (sortedAssignments.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 text-sm">
        No assignments this week.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-neutral-900 z-10 text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase border-b border-neutral-800">
              Athlete
            </th>
            {sortedAssignments.map((a) => (
              <th
                key={a.id}
                className="px-2 py-2 text-center border-b border-neutral-800 min-w-[80px]"
              >
                <button
                  onClick={() => onOpenResults(a.id)}
                  className="text-xs font-medium text-neutral-400 hover:text-indigo-400 transition-colors"
                  title={`${a.title || a.template_name || 'Workout'} — ${format(parseISO(a.scheduled_date), 'EEE d')}`}
                >
                  <div className="truncate max-w-[80px]">{a.title || a.template_name || '—'}</div>
                  <div className="text-[10px] text-neutral-600 font-normal">
                    {format(parseISO(a.scheduled_date), 'EEE d')}
                  </div>
                </button>
              </th>
            ))}
            <th className="px-3 py-2 text-center border-b border-neutral-800 text-xs font-medium text-neutral-500">
              Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {[...squads.entries()].map(([squadName, squadAthletes]) => (
            <React.Fragment key={squadName}>
              {/* Squad header row */}
              {squads.size > 1 && (
                <tr>
                  <td
                    colSpan={sortedAssignments.length + 2}
                    className="px-3 py-1.5 text-[10px] font-semibold text-neutral-500 uppercase bg-neutral-800/30 border-b border-neutral-800/50"
                  >
                    {squadName}
                  </td>
                </tr>
              )}
              {squadAthletes.map((athlete) => {
                let completedCount = 0;
                const totalForAthlete = sortedAssignments.length;

                return (
                  <tr key={athlete.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="sticky left-0 bg-neutral-900 z-10 px-3 py-2 text-neutral-200 border-b border-neutral-800/30 whitespace-nowrap">
                      {athlete.name}
                    </td>
                    {sortedAssignments.map((a) => {
                      const cell = cellMap.get(`${athlete.id}:${a.id}`);
                      if (cell?.completed) completedCount++;

                      return (
                        <td
                          key={a.id}
                          className="px-2 py-2 text-center border-b border-neutral-800/30"
                        >
                          {!cell ? (
                            <span className="text-neutral-700">—</span>
                          ) : cell.completed ? (
                            <div className="flex flex-col items-center">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              {cell.result_split_seconds && (
                                <span className="text-[10px] text-emerald-400/70 mt-0.5">
                                  {fmtTime(cell.result_split_seconds)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Circle className="w-4 h-4 text-neutral-600 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center border-b border-neutral-800/30">
                      {totalForAthlete > 0 ? (
                        <span
                          className={`text-xs font-medium ${
                            completedCount === totalForAthlete
                              ? 'text-emerald-400'
                              : completedCount > 0
                                ? 'text-yellow-400'
                                : 'text-neutral-600'
                          }`}
                        >
                          {Math.round((completedCount / totalForAthlete) * 100)}%
                        </span>
                      ) : (
                        <span className="text-neutral-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Edit Assignment Modal ──────────────────────────────────────────────────

function EditAssignmentModal({
  assignment,
  onSave,
  onClose,
}: {
  assignment: GroupAssignment;
  onSave: (updates: { title?: string | null; instructions?: string | null; scheduled_date?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(assignment.title ?? '');
  const [instructions, setInstructions] = useState(assignment.instructions ?? '');
  const [date, setDate] = useState(assignment.scheduled_date);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        title: title || null,
        instructions: instructions || null,
        scheduled_date: date,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-100">Edit Assignment</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Template (read-only) */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Template</label>
            <div className="text-sm text-neutral-300">
              {assignment.template_name ?? 'N/A'}
              {assignment.training_zone && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  {assignment.training_zone}
                </span>
              )}
            </div>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="edit-assignment-date" className="block text-sm font-medium text-neutral-300 mb-1">Date</label>
            <input
              id="edit-assignment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="edit-assignment-title" className="block text-sm font-medium text-neutral-300 mb-1">
              Title <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              id="edit-assignment-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={assignment.template_name ?? ''}
              className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Instructions */}
          <div>
            <label htmlFor="edit-assignment-instructions" className="block text-sm font-medium text-neutral-300 mb-1">
              Instructions <span className="text-neutral-500">(optional)</span>
            </label>
            <textarea
              id="edit-assignment-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. Target rate 18-20"
              className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
