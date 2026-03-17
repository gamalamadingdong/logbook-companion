import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { useMeasurementUnits } from '../../hooks/useMeasurementUnits';
import {
  getGroupAssignments,
  createGroupAssignment,
  deleteGroupAssignment,
  updateGroupAssignment,
  syncAssignmentAthletes,
  getAssignmentAthleteIds,
  getAthleteAssignmentRows,
  saveAssignmentResults,
  markAssignmentAsTest,
  addAthleteToAssignment,
  getResultWeightColumnAvailability,
  getComplianceData,
  getAthletes,
  getOrgAthletes,
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
import { format, addDays, addWeeks, subWeeks, startOfWeek, endOfWeek, isToday, eachDayOfInterval, parseISO } from 'date-fns';
import {
  Plus, Trash2, Loader2, ChevronLeft, ChevronRight,
  Calendar, Search, CheckSquare, X, Edit2, Repeat,
  BarChart3, CheckCircle2, Circle, Timer, UserPlus,
  ClipboardList,
} from 'lucide-react';
import { EmptyState } from '../../components/ui';
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
import { kgToLbs, lbsToKg } from '../../utils/unitConversion';
import {
  type AnalyticsRangePreset,
  RANGE_PRESET_OPTIONS,
  getRangeForPreset,
} from '../../services/coaching/analyticsView';
import { ComplianceTrendChart } from '../../components/coaching/ComplianceTrendChart';

// ─── Main Page ──────────────────────────────────────────────────────────────

export function CoachingAssignments() {
  const { userId, teamId, teamName, orgId, activeTeam, isLoadingTeam, filterTeamId, filterTeamName } = useCoachingContext();
  const effectiveTeamId = filterTeamId ?? teamId;

  // Data
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [orgAthletes, setOrgAthletes] = useState<CoachingAthlete[]>([]);
  const [squads, setSquads] = useState<string[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplateListItem[]>([]);

  // UI
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [bulkCompleteAssignmentId, setBulkCompleteAssignmentId] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<GroupAssignment | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'compliance' | 'list'>('list');
  const [allAssignments, setAllAssignments] = useState<GroupAssignment[]>([]);
  const [allComplianceCells, setAllComplianceCells] = useState<ComplianceCell[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [adjacentWeekHasData, setAdjacentWeekHasData] = useState<{ prev: boolean; next: boolean }>({ prev: false, next: false });
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [complianceRangePreset, setComplianceRangePreset] = useState<AnalyticsRangePreset>('4w');
  const [complianceAssignments, setComplianceAssignments] = useState<GroupAssignment[]>([]);
  const [complianceCellsForRange, setComplianceCellsForRange] = useState<ComplianceCell[]>([]);
  const [isLoadingCompliance, setIsLoadingCompliance] = useState(false);
  const [complianceReferenceDate] = useState(() => new Date());

  // Computed dates
  const today = new Date();
  const refDate = addDays(today, weekOffset * 7);
  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const complianceRange = useMemo(() => getRangeForPreset(complianceRangePreset, complianceReferenceDate), [complianceRangePreset, complianceReferenceDate]);

  const loadData = useCallback(async () => {
    if (!effectiveTeamId) return;
    try {
      const fromStr = format(weekStart, 'yyyy-MM-dd');
      const toStr = format(weekEnd, 'yyyy-MM-dd');
      const [asgn, ath, sq, tmpl] = await Promise.all([
        getGroupAssignments(effectiveTeamId, { from: fromStr, to: toStr, orgId: orgId ?? undefined }),
        getAthletes(effectiveTeamId),
        getTeamSquads(effectiveTeamId),
        fetchTemplates({ sortBy: 'popular' }),
      ]);
      setAssignments(asgn);
      setAthletes(ath);
      setSquads(sq);
      setTemplates(tmpl);

      // Fetch org-wide athletes when in an org (for org assignments)
      if (orgId) {
        getOrgAthletes(orgId).then(setOrgAthletes).catch(() => {});
      } else {
        setOrgAthletes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveTeamId, orgId, weekStart.toISOString(), weekEnd.toISOString()]);

  useEffect(() => {
    if (!isLoadingTeam && effectiveTeamId) {
      setIsLoading(true);
      loadData();
    }
  }, [isLoadingTeam, effectiveTeamId, loadData]);

  // Lightweight lookahead for adjacent week indicators (non-blocking)
  useEffect(() => {
    if (!effectiveTeamId || isLoadingTeam) return;
    const prevWeek = subWeeks(weekStart, 1);
    const nextWeek = addWeeks(weekStart, 1);
    const prevFrom = format(prevWeek, 'yyyy-MM-dd');
    const prevTo = format(endOfWeek(prevWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const nextFrom = format(nextWeek, 'yyyy-MM-dd');
    const nextTo = format(endOfWeek(nextWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    Promise.all([
      getGroupAssignments(effectiveTeamId, { from: prevFrom, to: prevTo, orgId: orgId ?? undefined }),
      getGroupAssignments(effectiveTeamId, { from: nextFrom, to: nextTo, orgId: orgId ?? undefined }),
    ])
      .then(([prev, next]) => setAdjacentWeekHasData({ prev: prev.length > 0, next: next.length > 0 }))
      .catch(() => { /* non-critical */ });
  }, [effectiveTeamId, isLoadingTeam, orgId, weekStart.toISOString()]);

  // Load ALL assignments for list view (no date filter)
  const loadAllAssignments = useCallback(async () => {
    if (!effectiveTeamId) return;
    setIsLoadingList(true);
    try {
      const [asgn, cells] = await Promise.all([
        getGroupAssignments(effectiveTeamId, { orgId: orgId ?? undefined }),
        getComplianceData(effectiveTeamId, '2000-01-01', '2099-12-31', orgId ?? undefined),
      ]);
      setAllAssignments(asgn);
      setAllComplianceCells(cells);
    } catch {
      // Fall back to empty — list will show without completion stats
    } finally {
      setIsLoadingList(false);
    }
  }, [effectiveTeamId, orgId]);

  // Fetch list data when switching to list view
  useEffect(() => {
    if (viewMode === 'list' && allAssignments.length === 0 && !isLoadingList) {
      loadAllAssignments();
    }
  }, [viewMode, allAssignments.length, isLoadingList, loadAllAssignments]);

  // Fetch compliance data for the selected range
  const loadComplianceData = useCallback(async () => {
    if (!effectiveTeamId) return;
    setIsLoadingCompliance(true);
    try {
      const fromStr = complianceRange.from ?? '2000-01-01';
      const toStr = complianceRange.to ?? '2099-12-31';
      const [asgn, cells] = await Promise.all([
        getGroupAssignments(effectiveTeamId, { from: fromStr, to: toStr, orgId: orgId ?? undefined }),
        getComplianceData(effectiveTeamId, fromStr, toStr, orgId ?? undefined),
      ]);
      setComplianceAssignments(asgn);
      setComplianceCellsForRange(cells);
    } catch {
      // Fall back to empty
    } finally {
      setIsLoadingCompliance(false);
    }
  }, [effectiveTeamId, orgId, complianceRange.from, complianceRange.to]);

  useEffect(() => {
    if (viewMode === 'compliance' && effectiveTeamId && !isLoadingTeam) {
      loadComplianceData();
    }
  }, [viewMode, effectiveTeamId, isLoadingTeam, loadComplianceData]);

  const handleCreate = async (input: GroupAssignmentInput, athleteIds: string[]) => {
    try {
      await createGroupAssignment(input, athleteIds);
      toast.success('Workout assigned');
      setShowCreateForm(false);
      await loadData();
      if (viewMode === 'compliance') await loadComplianceData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create assignment');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGroupAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setComplianceAssignments((prev) => prev.filter((a) => a.id !== id));
      toast.success('Assignment removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleEdit = async (
    id: string,
    updates: { title?: string | null; instructions?: string | null; scheduled_date?: string },
    newAthleteIds?: string[]
  ) => {
    try {
      await updateGroupAssignment(id, updates);
      if (newAthleteIds !== undefined && editingAssignment) {
        await syncAssignmentAthletes(id, newAthleteIds, {
          team_id: editingAssignment.team_id ?? null,
          org_id: editingAssignment.org_id ?? null,
          template_id: editingAssignment.template_id,
          scheduled_date: updates.scheduled_date ?? editingAssignment.scheduled_date,
          title: updates.title ?? editingAssignment.title,
        });
      }
      toast.success('Assignment updated');
      setEditingAssignment(null);
      await loadData();
      if (viewMode === 'compliance') await loadComplianceData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  // Exclude coxswain-sided athletes from assignment compliance (they don't erg)
  const ergAthletes = useMemo(() => athletes.filter((a) => a.side !== 'coxswain'), [athletes]);
  const ergOrgAthletes = useMemo(() => orgAthletes.filter((a) => a.side !== 'coxswain'), [orgAthletes]);

  // Filter assignments by team filter (shared logic for calendar + compliance)
  const visibleAssignments = filterTeamId
    ? assignments.filter((a) => a.team_id === filterTeamId || a.org_id)
    : assignments;

  const visibleComplianceAssignments = filterTeamId
    ? complianceAssignments.filter((a) => a.team_id === filterTeamId || a.org_id)
    : complianceAssignments;

  // For org coaches viewing all teams, use org-wide athletes; otherwise team athletes
  const complianceAthletes = orgId && !filterTeamId ? ergOrgAthletes : ergAthletes;

  // Group assignments by date
  const assignmentsByDate = new Map<string, GroupAssignment[]>();
  for (const a of visibleAssignments) {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* ── Header Row: Title + View Toggle + Action ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + scope indicator */}
          <div className="shrink-0">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-100">
              Team Workouts
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {orgId && activeTeam?.org_name
                ? `${activeTeam.org_name} · ${filterTeamName}`
                : teamName}
            </p>
          </div>

          {/* Right: View Toggle + Create */}
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <div className="flex gap-0.5 bg-neutral-800/50 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Calendar</span>
              </button>
              <button
                onClick={() => setViewMode('compliance')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'compliance'
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compliance</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Assign Workout</span>
              <span className="sm:hidden">Assign</span>
            </button>
          </div>
        </div>

        {viewMode === 'compliance' ? (
          <>
            {/* Compliance range selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 shrink-0 rounded-lg border border-neutral-300 bg-neutral-100 p-1 dark:border-neutral-700/60 dark:bg-neutral-900/70">
                {RANGE_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setComplianceRangePreset(option.value)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                      complianceRangePreset === option.value
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-transparent text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-neutral-500">{complianceRange.label}</span>
            </div>
            {isLoadingCompliance ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : (
              <>
                {visibleComplianceAssignments.length > 0 && (
                  <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:shadow-none">
                    <ComplianceTrendChart
                      assignments={visibleComplianceAssignments}
                      cells={complianceCellsForRange}
                      athleteCount={complianceAthletes.length}
                    />
                  </div>
                )}
                <ComplianceGrid
                  assignments={visibleComplianceAssignments}
                  athletes={complianceAthletes}
                  cells={complianceCellsForRange}
                />
              </>
            )}
          </>
        ) : viewMode === 'list' ? (
          <AssignmentListView
            assignments={allAssignments}
            complianceCells={allComplianceCells}
            ergAthletes={ergAthletes}
            ergOrgAthletes={ergOrgAthletes}
            isLoading={isLoadingList}
            teamName={teamName}
            orgId={orgId}
            filterTeamId={filterTeamId}
          />
        ) : (
        <>
        {/* ── Calendar: Week Navigator ── */}
        <div className="flex items-center gap-2 sm:gap-3 justify-center">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="relative p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
            {adjacentWeekHasData.prev && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />}
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={`text-sm font-medium transition-colors px-2 py-1 rounded-md ${
              weekOffset === 0
                ? 'text-neutral-300'
                : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20'
            }`}
          >
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="relative p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
            {adjacentWeekHasData.next && <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />}
          </button>
        </div>

        {/* ── Date Strip ── */}
        <div className="flex gap-1 sm:gap-1.5">
          {weekDates.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayAssignments = assignmentsByDate.get(dateStr) ?? [];
            const isSelected = selectedDate === dateStr;
            const isToday_ = isToday(date);
            const count = dayAssignments.length;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex-1 flex flex-col items-center py-2 sm:py-2.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-900/30 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10'
                    : isToday_
                      ? 'border-indigo-500/30 bg-indigo-900/10 hover:bg-indigo-900/20'
                      : 'border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800/60 hover:border-neutral-700'
                }`}
              >
                <span className={`text-[11px] sm:text-xs font-medium uppercase tracking-wide ${
                  isSelected ? 'text-indigo-400' : 'text-neutral-500'
                }`}>
                  {format(date, 'EEE')}
                </span>
                <span className={`text-base sm:text-lg font-semibold leading-tight ${
                  isSelected ? 'text-white' : isToday_ ? 'text-indigo-400' : 'text-neutral-300'
                }`}>
                  {format(date, 'd')}
                </span>
                {/* Dot indicator */}
                <div className="flex gap-0.5 mt-1 h-1.5">
                  {count > 0 ? (
                    Array.from({ length: Math.min(count, 4) }, (_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-indigo-400' : 'bg-neutral-500'
                        }`}
                      />
                    ))
                  ) : (
                    <div className="w-1.5 h-1.5" /> /* spacer for alignment */
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Selected Day Content ── */}
        {(() => {
          const dayAssignments = assignmentsByDate.get(selectedDate) ?? [];
          const parsedDate = parseISO(selectedDate);
          const isSelectedToday = isToday(parsedDate);

          return (
            <div className="space-y-3">
              {/* Day heading */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-neutral-400">
                  {isSelectedToday
                    ? "Today"
                    : format(parsedDate, 'EEEE, MMM d')}
                  {dayAssignments.length > 0 && (
                    <span className="ml-2 text-neutral-600">
                      · {dayAssignments.length} workout{dayAssignments.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </h2>
              </div>

              {dayAssignments.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="w-8 h-8" />}
                  title="No workouts"
                  description="No workouts assigned for this date."
                  action={
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      + Assign a workout
                    </button>
                  }
                />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {dayAssignments.map((a) => (
                    <AssignmentDetailCard
                      key={a.id}
                      assignment={a}
                      onEdit={() => setEditingAssignment(a)}
                      onDelete={handleDelete}
                      onEnterResults={() => setBulkCompleteAssignmentId(a.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        </>
        )}

        {/* Create Form Modal */}
        {showCreateForm && (
          <CreateAssignmentForm
            teamId={effectiveTeamId}
            userId={userId}
            orgId={orgId}
            athletes={ergAthletes}
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
            athletes={assignments.find((a) => a.id === bulkCompleteAssignmentId)?.org_id && ergOrgAthletes.length > 0 ? ergOrgAthletes : ergAthletes}
            teamId={effectiveTeamId!}
            orgId={orgId}
            userId={userId}
            onClose={() => setBulkCompleteAssignmentId(null)}
            onComplete={loadData}
          />
        )}

        {/* Edit Assignment Modal */}
        {editingAssignment && (
          <EditAssignmentModal
            assignment={editingAssignment}
            athletes={ergAthletes}
            orgAthletes={ergOrgAthletes}
            squads={squads}
            orgId={orgId}
            onSave={(updates, newAthleteIds) => handleEdit(editingAssignment.id, updates, newAthleteIds)}
            onClose={() => setEditingAssignment(null)}
          />
        )}
      </div>
    </>
  );
}

// ─── Assignment Detail Card (full-width, in day list) ───────────────────────

function AssignmentDetailCard({
  assignment,
  onEdit,
  onDelete,
  onEnterResults,
}: {
  assignment: GroupAssignment;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onEnterResults: () => void;
}) {
  const zoneBg: Record<string, string> = {
    UT2: 'bg-green-900/30 text-green-400 border-green-800/40',
    UT1: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    AT: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40',
    TR: 'bg-orange-900/30 text-orange-400 border-orange-800/40',
    AN: 'bg-red-900/30 text-red-400 border-red-800/40',
  };

  return (
    <div className="group bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
      {/* Top row: title + badges */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-neutral-200 text-sm sm:text-base">
              {assignment.title || assignment.template_name || 'Workout'}
            </span>
            {assignment.org_id && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-indigo-900/40 text-indigo-400 border border-indigo-800/40 font-medium" title="Org-wide assignment">
                ORG
              </span>
            )}
            {assignment.training_zone && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-md border font-medium ${
                  zoneBg[assignment.training_zone] ?? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                {assignment.training_zone}
              </span>
            )}
            {assignment.is_test_template && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-indigo-900/30 text-indigo-400 border border-indigo-800/40 font-medium" title="Test / baseline piece">
                TEST
              </span>
            )}
          </div>
          {assignment.canonical_name && (
            <span className="text-xs text-neutral-500 font-mono mt-0.5 block">
              {assignment.canonical_name}
            </span>
          )}
          {assignment.instructions && (
            <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 line-clamp-2">
              {assignment.instructions}
            </p>
          )}
        </div>

        {/* Desktop action icons */}
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-neutral-500 hover:text-indigo-400 hover:bg-neutral-800 transition-colors"
            aria-label="Edit assignment"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(assignment.id)}
            className="p-1.5 rounded-md text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
            aria-label="Delete assignment"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-800/60">
        <button
          onClick={onEnterResults}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 border border-emerald-700/30 transition-colors"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          Enter Results
        </button>
        <Link
          to={`/team-management/assignments/${assignment.id}/results`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/15 text-indigo-300 hover:bg-indigo-600/25 border border-indigo-700/30 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          View Results
        </Link>
        {/* Mobile edit/delete buttons */}
        <div className="flex items-center gap-1 sm:hidden ml-auto">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-neutral-500 hover:text-indigo-400 transition-colors"
            aria-label="Edit assignment"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(assignment.id)}
            className="p-1.5 rounded-md text-neutral-500 hover:text-red-400 transition-colors"
            aria-label="Delete assignment"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Assignment Form (overlay) ───────────────────────────────────────

function CreateAssignmentForm({
  teamId,
  userId,
  orgId,
  athletes,
  squads,
  templates,
  onCreate,
  onCancel,
}: {
  teamId: string;
  userId: string;
  orgId: string | null;
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
  const [assignTo, setAssignTo] = useState<'all' | 'squad' | 'org'>(orgId ? 'org' : 'all');
  const [selectedSquad, setSelectedSquad] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'daily' | 'weekdays' | 'weekly'>('none');
  const [repeatUntil, setRepeatUntil] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [orgAthletes, setOrgAthletes] = useState<CoachingAthlete[]>([]);
  const [isLoadingOrgAthletes, setIsLoadingOrgAthletes] = useState(false);

  // Load org athletes when "All Teams" is selected (exclude coxswains)
  useEffect(() => {
    if (assignTo === 'org' && orgId && orgAthletes.length === 0) {
      setIsLoadingOrgAthletes(true);
      getOrgAthletes(orgId)
        .then((all) => setOrgAthletes(all.filter((a) => a.side !== 'coxswain')))
        .catch(() => {})
        .finally(() => setIsLoadingOrgAthletes(false));
    }
  }, [assignTo, orgId, orgAthletes.length]);

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
    assignTo === 'org'
      ? orgAthletes.map((a) => a.id)
      : assignTo === 'all'
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
        const isOrgLevel = assignTo === 'org' && orgId;
        await onCreate(
          {
            team_id: isOrgLevel ? null : teamId,
            org_id: isOrgLevel ? orgId : null,
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
                {orgId && (
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="radio"
                      name="assignTo"
                      checked={assignTo === 'org'}
                      onChange={() => setAssignTo('org')}
                      className="accent-indigo-500"
                    />
                    All Teams (Org)
                  </label>
                )}
              </div>
              {assignTo === 'org' && isLoadingOrgAthletes && (
                <div className="mt-1 text-xs text-indigo-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading org athletes…
                </div>
              )}
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
                title={!templateId ? 'Select a workout template first' : undefined}
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
  /** Bodyweight input in selected display units; persisted as kg */
  weightInput: string;
  /** The measured value — time for fixed_distance, distance for fixed_time */
  primary: string;
  /** True when the whole single-piece workout was DNF */
  primaryDnf: boolean;
  /** Stroke rate (spm) */
  spm: string;
  /** Per-rep measured values for interval workouts */
  reps: string[];
  /** Per-rep DNF flags */
  repDnf: boolean[];
  /** Per-rep spm for interval workouts */
  repSpm: string[];
  /** Mark this result as a test/baseline — auto-creates erg score */
  isTest: boolean;
}

export function ResultsEntryModal({
  groupAssignmentId,
  assignment,
  athletes,
  teamId,
  orgId,
  userId,
  onClose,
  onComplete,
}: {
  groupAssignmentId: string;
  assignment: GroupAssignment;
  athletes: CoachingAthlete[];
  teamId: string;
  orgId?: string | null;
  userId: string;
  onClose: () => void;
  onComplete: () => void;
}): React.JSX.Element {
  const units = useMeasurementUnits();
  const isImperial = units === 'imperial';

  const formatWeightInputFromKg = useCallback((value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value) || value <= 0) return '';
    return isImperial ? kgToLbs(value).toString() : value.toString();
  }, [isImperial]);

  const parseWeightInputToKg = useCallback((value: string): number | null => {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return isImperial ? lbsToKg(parsed) : parsed;
  }, [isImperial]);

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
  const [isAddingAthlete, setIsAddingAthlete] = useState(false);
  const resultWeightColumnAvailability = getResultWeightColumnAvailability();
  const [showAddAthlete, setShowAddAthlete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const rows = await getAthleteAssignmentRows(groupAssignmentId);
        if (cancelled) return;
        const mapped: AthleteResultEntry[] = rows.map((r) => {
          const athleteDefaultWeight = athletes.find((a) => a.id === r.athlete_id)?.weight_kg;
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

          // Restore per-rep DNF flags from existing interval data
          const repDnf: boolean[] = Array.from({ length: shape.reps }, (_, i) =>
            !!(existingIntervals[i]?.dnf)
          );

          // Detect whole-piece DNF: completed, no primary value, no split, no interval data
          const primaryDnf =
            r.completed &&
            !primary &&
            r.result_split_seconds == null &&
            r.result_time_seconds == null &&
            r.result_distance_meters == null &&
            existingIntervals.length === 0;

          return {
            athlete_id: r.athlete_id,
            completed: r.completed,
            wasCompleted: r.completed,
            weightInput: r.result_weight_kg != null
              ? formatWeightInputFromKg(r.result_weight_kg)
              : athleteDefaultWeight != null
              ? formatWeightInputFromKg(athleteDefaultWeight)
              : '',
            primary,
            primaryDnf,
            spm: r.result_stroke_rate ? String(r.result_stroke_rate) : '',
            reps,
            repDnf,
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
  }, [assignment.is_test_template, groupAssignmentId, shape, athletes, formatWeightInputFromKg]);

  // For org-wide assignments, load all org athletes so names resolve correctly
  const [orgAthletesList, setOrgAthletesList] = useState<CoachingAthlete[]>([]);
  useEffect(() => {
    if (orgId && assignment.org_id) {
      getOrgAthletes(orgId)
        .then(setOrgAthletesList)
        .catch(() => {});
    }
  }, [orgId, assignment.org_id]);

  // Merge team athletes with org athletes (org athletes fill in gaps for cross-team visibility)
  const athleteMap = useMemo(() => {
    const map = new Map(athletes.map((a) => [a.id, a]));
    for (const a of orgAthletesList) {
      if (!map.has(a.id)) map.set(a.id, a);
    }
    return map;
  }, [athletes, orgAthletesList]);

  // Athletes available to add (on roster but not yet assigned, excluding coxswains)
  const unassignedAthletes = useMemo(() => {
    const assignedIds = new Set(entries.map((e) => e.athlete_id));
    return [...athleteMap.values()]
      .filter((a) => !assignedIds.has(a.id) && a.side !== 'coxswain')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [athleteMap, entries]);

  // Handler: add an athlete to this assignment and create a blank entry row
  const handleAddAthlete = async (athleteId: string) => {
    setIsAddingAthlete(true);
    try {
      await addAthleteToAssignment(groupAssignmentId, athleteId, {
        team_id: assignment.team_id,
        org_id: assignment.org_id,
        template_id: assignment.template_id,
        scheduled_date: assignment.scheduled_date,
        title: assignment.title,
      });
      // Append a blank entry for the newly added athlete
      const newEntry: AthleteResultEntry = {
        athlete_id: athleteId,
        completed: false,
        wasCompleted: false,
        weightInput: formatWeightInputFromKg(athleteMap.get(athleteId)?.weight_kg ?? null),
        primary: '',
        primaryDnf: false,
        spm: '',
        reps: Array.from({ length: shape.reps }, () => ''),
        repDnf: Array.from({ length: shape.reps }, () => false),
        repSpm: Array.from({ length: shape.reps }, () => ''),
        isTest: assignment.is_test_template ?? false,
      };
      setEntries((prev) => [...prev, newEntry]);
      setShowAddAthlete(false);
      const athlete = athleteMap.get(athleteId);
      toast.success(`Added ${athlete?.name ?? 'athlete'} to assignment`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add athlete');
    } finally {
      setIsAddingAthlete(false);
    }
  };

  const updateEntry = (idx: number, field: keyof AthleteResultEntry, value: string | boolean) => {
    // Typing "dnf" in the primary field toggles primaryDnf
    if (field === 'primary' && typeof value === 'string' && value.trim().toLowerCase() === 'dnf') {
      setEntries((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], primaryDnf: true, primary: '' };
        return next;
      });
      return;
    }
    if (field === 'primary' && typeof value === 'string' && value.trim()) {
      // Typing a real value clears primaryDnf
      setEntries((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: value, primaryDnf: false };
        return next;
      });
      return;
    }
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const updateRep = (entryIdx: number, repIdx: number, value: string) => {
    // Typing "dnf" (case-insensitive) sets the DNF flag and clears the value
    if (value.trim().toLowerCase() === 'dnf') {
      setEntries((prev) => {
        const next = [...prev];
        const reps = [...next[entryIdx].reps];
        const repDnf = [...next[entryIdx].repDnf];
        reps[repIdx] = '';
        repDnf[repIdx] = true;
        next[entryIdx] = { ...next[entryIdx], reps, repDnf };
        return next;
      });
      return;
    }
    setEntries((prev) => {
      const next = [...prev];
      const reps = [...next[entryIdx].reps];
      const repDnf = [...next[entryIdx].repDnf];
      reps[repIdx] = value;
      // Typing a real value clears DNF for that rep
      if (value.trim()) repDnf[repIdx] = false;
      next[entryIdx] = { ...next[entryIdx], reps, repDnf };
      return next;
    });
  };

  const toggleRepDnf = (entryIdx: number, repIdx: number) => {
    setEntries((prev) => {
      const next = [...prev];
      const repDnf = [...next[entryIdx].repDnf];
      const reps = [...next[entryIdx].reps];
      repDnf[repIdx] = !repDnf[repIdx];
      if (repDnf[repIdx]) reps[repIdx] = ''; // clear value when marking DNF
      next[entryIdx] = { ...next[entryIdx], reps, repDnf };
      return next;
    });
  };

  const togglePrimaryDnf = (entryIdx: number) => {
    setEntries((prev) => {
      const next = [...prev];
      const dnf = !next[entryIdx].primaryDnf;
      next[entryIdx] = { ...next[entryIdx], primaryDnf: dnf, primary: dnf ? '' : next[entryIdx].primary };
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
        // Always save if they were previously completed
        if (e.wasCompleted) return true;
        // Save if marked complete (including DNF — they attempted)
        if (e.completed) return true;
        return false;
      })
      .map((e) => {
        let resultTime: number | null = null;
        let resultDist: number | null = null;
        let resultSplit: number | null = null;
        const resultWeightKg = parseWeightInputToKg(e.weightInput);
        const resultSpm = e.spm ? parseInt(e.spm, 10) || null : null;

        // Whole-piece DNF: save completed=true but all stats null
        if (!isInterval && e.primaryDnf) {
          return {
            athlete_id: e.athlete_id,
            completed: true,
            result_weight_kg: resultWeightKg,
            result_time_seconds: null,
            result_distance_meters: null,
            result_split_seconds: null,
            result_stroke_rate: null,
            result_intervals: null,
            _isTest: false,
          };
        }

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
        }

        // Build interval results
        let resultIntervals: IntervalResult[] | null = null;
        if (isInterval) {
          resultIntervals = e.reps.map((val, i) => {
            // DNF rep: persist dnf flag, null stats
            if (e.repDnf[i]) {
              return { rep: i + 1, dnf: true, time_seconds: null, distance_meters: null, split_seconds: null, stroke_rate: null };
            }

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

          // Totals only from non-DNF reps
          const completedReps = resultIntervals.filter((iv) => !iv.dnf);
          const totalTime = completedReps.reduce((sum, iv) => sum + (iv.time_seconds ?? 0), 0);
          const totalDist = completedReps.reduce((sum, iv) => sum + (iv.distance_meters ?? 0), 0);
          if (totalTime > 0) resultTime = totalTime;
          if (totalDist > 0) resultDist = totalDist;
          if (totalTime > 0 && totalDist > 0) resultSplit = computeSplit(totalTime, totalDist);
        }

        return {
          athlete_id: e.athlete_id,
          completed: e.completed,
          result_weight_kg: resultWeightKg,
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
          {resultWeightColumnAvailability === false && (
            <div className="mb-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
              Assignment result weight column is not present in this database yet. Weight inputs are visible but will not persist until the migration adding
              <span className="font-mono"> result_weight_kg</span>
              {' '}is applied.
            </div>
          )}
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
                <div className="w-16">Wt {isImperial ? 'lbs' : 'kg'}</div>
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
                          <div className="text-[11px] text-neutral-600 normal-case">{getRepInputLabel(i)}</div>
                        </div>
                      );
                    })}
                    <div className="w-16 text-center">SPM</div>
                    <div className="w-20 text-center">Avg Split</div>
                  </>
                )}
                <div className="w-10 text-center" title="Mark as test/baseline — creates an erg score">Test</div>
              </div>

              {/* Mark all + Add athlete */}
              <div className="py-1.5 flex items-center gap-3">
                <button
                  onClick={markAllComplete}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Mark all complete
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowAddAthlete(!showAddAthlete)}
                    disabled={unassignedAthletes.length === 0 || isAddingAthlete}
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
                    title={unassignedAthletes.length === 0 ? 'All roster athletes are assigned' : 'Add an athlete who showed up late'}
                  >
                    {isAddingAthlete ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    Add athlete
                  </button>
                  {showAddAthlete && unassignedAthletes.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl max-h-48 overflow-auto w-56">
                      {unassignedAthletes.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => handleAddAthlete(a.id)}
                          disabled={isAddingAthlete}
                          className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <span className="truncate">{a.name}</span>
                          {a.squad && <span className="text-[11px] text-neutral-500 ml-auto shrink-0">{a.squad}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                        disabled={false}
                        className="accent-emerald-500 w-4 h-4"
                        aria-label={`Mark ${athlete?.name ?? 'athlete'} complete`}
                      />

                      {/* Name */}
                      <div className="w-full md:w-36 truncate">
                        <span className={`text-sm font-medium md:font-normal ${entry.wasCompleted ? 'text-emerald-400/60' : 'text-neutral-200'}`}>
                          {athlete?.name ?? 'Unknown'}
                        </span>
                        {athlete?.squad && (
                          <span className="ml-2 md:ml-0 md:block text-[11px] text-neutral-500">{athlete.squad}</span>
                        )}
                      </div>

                      {/* Weight */}
                      <div className="flex items-center gap-2 w-full md:w-auto mt-1 md:mt-0 pl-6 md:pl-0">
                        <div className="md:hidden text-[11px] text-neutral-500 uppercase w-10 shrink-0">Wt {isImperial ? 'lbs' : 'kg'}</div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={entry.weightInput}
                          onChange={(e) => updateEntry(idx, 'weightInput', e.target.value)}
                          placeholder={isImperial ? 'lb' : 'kg'}
                          className="w-16 px-2 py-1.5 text-sm rounded bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Single-piece entry */}
                      {!isInterval && (
                        <div className="flex items-center gap-2 w-full md:w-auto mt-1 md:mt-0 pl-6 md:pl-0">
                          <div className="md:hidden text-[11px] text-neutral-500 uppercase w-10 shrink-0">{primaryLabel}</div>
                          {entry.primaryDnf ? (
                            <button
                              type="button"
                              onClick={() => togglePrimaryDnf(idx)}
                              className="w-24 px-2 py-1.5 text-xs font-bold rounded bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-900/60 transition-colors"
                            >
                              DNF
                            </button>
                          ) : (
                            <input
                              type="text"
                              value={entry.primary}
                              onChange={(e) => updateEntry(idx, 'primary', e.target.value)}
                              placeholder={primaryPlaceholder}
                              className="w-24 px-2 py-1.5 text-sm rounded bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => togglePrimaryDnf(idx)}
                            title={entry.primaryDnf ? 'Clear DNF' : 'Mark DNF'}
                            className={`text-[11px] font-bold px-1.5 py-1 rounded border transition-colors ${
                              entry.primaryDnf
                                ? 'bg-red-900/20 border-red-700/40 text-red-500 hover:bg-neutral-800'
                                : 'bg-neutral-800 border-neutral-700 text-neutral-600 hover:text-red-400 hover:border-red-700/40'
                            }`}
                          >
                            DNF
                          </button>
                          <div className="md:hidden text-[11px] text-neutral-500 uppercase w-8 shrink-0">SPM</div>
                          <input
                            type="text"
                            value={entry.spm}
                            onChange={(e) => updateEntry(idx, 'spm', e.target.value)}
                            placeholder="spm"
                            className="w-16 px-2 py-1.5 text-sm rounded bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                          />
                          {!entry.primaryDnf && (
                            <span className="w-20 text-sm text-neutral-500 italic">
                              {getOverallSplit(entry)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Interval entry */}
                      {isInterval && (
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto mt-1 md:mt-0 pl-6 md:pl-0">
                          {entry.reps.map((repVal, repIdx) => {
                            const repHeaderLabel = shape.type === 'variable_interval' && shape.variableReps
                              ? shape.variableReps[repIdx]?.label ?? `R${repIdx + 1}`
                              : `R${repIdx + 1}`;
                            const isDnf = entry.repDnf[repIdx];
                            return (
                              <div key={repIdx} className="w-20">
                                <div className="md:hidden text-[11px] text-neutral-500 uppercase mb-0.5">{repHeaderLabel}</div>
                                {isDnf ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleRepDnf(idx, repIdx)}
                                    title="Clear DNF"
                                    className="w-full px-1.5 py-1.5 text-[11px] font-bold rounded bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-neutral-800 transition-colors"
                                  >
                                    DNF
                                  </button>
                                ) : (
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={repVal}
                                      onChange={(e) => updateRep(idx, repIdx, e.target.value)}
                                      placeholder={getRepInputPlaceholder(repIdx)}
                                      className="w-full px-1.5 py-1.5 text-xs rounded bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                )}
                                {!isDnf && getRepSplit(entry, repIdx) && (
                                  <div className="text-[11px] text-neutral-500 italic text-center mt-0.5">
                                    {getRepSplit(entry, repIdx)}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleRepDnf(idx, repIdx)}
                                  title={isDnf ? 'Clear DNF' : 'Mark this rep DNF'}
                                  className={`mt-0.5 w-full text-[11px] font-bold rounded transition-colors ${
                                    isDnf
                                      ? 'text-red-500/60 hover:text-neutral-500'
                                      : 'text-neutral-700 hover:text-red-400'
                                  }`}
                                >
                                  {isDnf ? '✕ clear' : 'DNF'}
                                </button>
                              </div>
                            );
                          })}
                          <div>
                            <div className="md:hidden text-[11px] text-neutral-500 uppercase mb-0.5">SPM</div>
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

// ─── Assignment List View ────────────────────────────────────────────────────

function AssignmentListView({
  assignments,
  complianceCells,
  ergAthletes,
  ergOrgAthletes,
  isLoading,
  teamName,
  orgId,
  filterTeamId,
}: {
  assignments: GroupAssignment[];
  complianceCells: ComplianceCell[];
  ergAthletes: CoachingAthlete[];
  ergOrgAthletes: CoachingAthlete[];
  isLoading: boolean;
  teamName?: string;
  orgId?: string | null;
  filterTeamId?: string | null;
}) {
  // Build set of non-coxswain athlete IDs for filtering compliance
  const ergAthleteIds = useMemo(() => {
    const allErg = orgId && ergOrgAthletes.length > 0 ? ergOrgAthletes : ergAthletes;
    return new Set(allErg.map((a) => a.id));
  }, [ergAthletes, ergOrgAthletes, orgId]);

  // Build completion stats per assignment (excluding coxswains)
  const completionByAssignment = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    // Filter to non-coxswain athletes only
    const filtered = complianceCells.filter((c) => ergAthleteIds.has(c.athlete_id));
    for (const cell of filtered) {
      const entry = map.get(cell.group_assignment_id) ?? { total: 0, completed: 0 };
      entry.total++;
      if (cell.completed) entry.completed++;
      map.set(cell.group_assignment_id, entry);
    }
    return map;
  }, [complianceCells, ergAthleteIds]);

  // Filter by team if needed
  const visibleAssignments = useMemo(() => {
    let list = assignments;
    if (filterTeamId) {
      list = list.filter((a) => a.team_id === filterTeamId || a.org_id);
    }
    // Already sorted newest first from getGroupAssignments
    return list;
  }, [assignments, filterTeamId]);

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (visibleAssignments.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="w-8 h-8" />}
        title="No workouts yet"
        description="Assign a workout to get started."
      />
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-neutral-500 border-b border-neutral-800 bg-neutral-900/50">
            <th className="text-left py-3 px-4 font-medium">Assignment</th>
            <th className="text-left py-3 px-3 font-medium">Date</th>
            <th className="text-right py-3 px-3 font-medium">Completion</th>
            <th className="text-left py-3 px-3 font-medium">Scope</th>
            <th className="text-right py-3 px-4 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {visibleAssignments.map((a) => {
            const stats = completionByAssignment.get(a.id);
            const pct = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : null;
            const displayName = a.title || a.template_name || 'Workout';
            const isOrg = !!a.org_id;

            return (
              <tr key={a.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{displayName}</span>
                    {a.is_test_template && (
                      <span className="px-1.5 py-0.5 text-[11px] font-semibold uppercase rounded bg-indigo-500/20 text-indigo-400">Test</span>
                    )}
                    {a.training_zone && (
                      <span className="px-1.5 py-0.5 text-[11px] font-semibold uppercase rounded bg-neutral-700 text-neutral-400">{a.training_zone}</span>
                    )}
                  </div>
                  {a.canonical_name && (
                    <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{a.canonical_name}</div>
                  )}
                </td>
                <td className="py-3 px-3 text-neutral-300 whitespace-nowrap">{fmtDate(a.scheduled_date)}</td>
                <td className="py-3 px-3 text-right">
                  {stats ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-neutral-400 text-xs">{stats.completed}/{stats.total}</span>
                      <span className={`font-mono font-medium text-xs min-w-[36px] text-right ${
                        pct === 100 ? 'text-emerald-400' : pct && pct >= 50 ? 'text-yellow-400' : 'text-neutral-500'
                      }`}>
                        {pct}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-neutral-600 text-xs">—</span>
                  )}
                </td>
                <td className="py-3 px-3">
                  {isOrg ? (
                    <span className="px-1.5 py-0.5 text-[11px] font-semibold uppercase rounded bg-purple-500/20 text-purple-400">All Teams</span>
                  ) : (
                    <span className="text-neutral-400 text-xs">{teamName || 'Team'}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <Link
                    to={`/team-management/assignments/${a.id}/results`}
                    className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
                  >
                    View Results →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Compliance Grid ────────────────────────────────────────────────────────

function ComplianceGrid({
  assignments,
  athletes,
  cells,
}: {
  assignments: GroupAssignment[];
  athletes: CoachingAthlete[];
  cells: ComplianceCell[];
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
        No workouts in this range.
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
                <Link
                  to={`/team-management/assignments/${a.id}/results`}
                  className="text-xs font-medium text-neutral-400 hover:text-indigo-400 transition-colors block"
                  title={`${a.title || a.template_name || 'Workout'} — ${format(parseISO(a.scheduled_date), 'EEE d')}`}
                >
                  <div className="truncate max-w-[80px]">{a.title || a.template_name || '—'}</div>
                  <div className="text-[11px] text-neutral-600 font-normal">
                    {format(parseISO(a.scheduled_date), 'EEE d')}
                  </div>
                </Link>
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
                    className="px-3 py-1.5 text-[11px] font-semibold text-neutral-500 uppercase bg-neutral-800/30 border-b border-neutral-800/50"
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
                                <span className="text-[11px] text-emerald-400/70 mt-0.5">
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
  athletes,
  orgAthletes,
  squads,
  orgId,
  onSave,
  onClose,
}: {
  assignment: GroupAssignment;
  athletes: CoachingAthlete[];
  orgAthletes: CoachingAthlete[];
  squads: string[];
  orgId: string | null;
  onSave: (
    updates: { title?: string | null; instructions?: string | null; scheduled_date?: string },
    newAthleteIds: string[]
  ) => Promise<void>;
  onClose: () => void;
}) {
  const isOrgAssignment = !!assignment.org_id;
  // The effective athlete list: org-wide for org assignments, team-scoped otherwise
  const effectiveAthletes = isOrgAssignment && orgAthletes.length > 0 ? orgAthletes : athletes;

  const [title, setTitle] = useState(assignment.title ?? '');
  const [instructions, setInstructions] = useState(assignment.instructions ?? '');
  const [date, setDate] = useState(assignment.scheduled_date);
  const [assignTo, setAssignTo] = useState<'all' | 'org' | 'squad' | 'custom'>(isOrgAssignment ? 'org' : 'all');
  const [selectedSquad, setSelectedSquad] = useState('');
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);

  // Load current assigned athlete IDs to pre-populate the selector
  useEffect(() => {
    getAssignmentAthleteIds(assignment.id).then((idList) => {
        const ids = new Set<string>(idList);
        const allEffectiveIds = new Set(effectiveAthletes.map((a) => a.id));
        const isAll = ids.size === allEffectiveIds.size && [...ids].every((id) => allEffectiveIds.has(id));

        if (isOrgAssignment) {
          // Org assignment: check if it matches all org athletes
          if (isAll) {
            setAssignTo('org');
          } else {
            setAssignTo('custom');
            setCustomIds(ids);
          }
        } else if (isAll) {
          setAssignTo('all');
        } else {
          // Check if it matches a squad exactly
          const matchedSquad = squads.find((s) => {
            const squadIds = athletes.filter((a) => a.squad === s).map((a) => a.id);
            return squadIds.length === ids.size && squadIds.every((id) => ids.has(id));
          });
          if (matchedSquad) {
            setAssignTo('squad');
            setSelectedSquad(matchedSquad);
          } else {
            setAssignTo('custom');
            setCustomIds(ids);
          }
        }
        setIsLoadingCurrent(false);
      });
  }, [assignment.id, effectiveAthletes, athletes, squads, isOrgAssignment]);

  // Derive target IDs from current selector state
  const targetAthleteIds: string[] = (() => {
    if (assignTo === 'org') return effectiveAthletes.map((a) => a.id);
    if (assignTo === 'all') return athletes.map((a) => a.id);
    if (assignTo === 'squad') return athletes.filter((a) => a.squad === selectedSquad).map((a) => a.id);
    return [...customIds];
  })();

  const toggleCustom = (id: string) => {
    setCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetAthleteIds.length === 0) {
      toast.error('No athletes selected');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(
        { title: title || null, instructions: instructions || null, scheduled_date: date },
        targetAthleteIds
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Assigned Athletes */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Assigned To</label>
            {isLoadingCurrent ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading current members…
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 mb-2">
                  {isOrgAssignment && orgId && (
                    <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                      <input
                        type="radio"
                        name="edit-assignTo"
                        checked={assignTo === 'org'}
                        onChange={() => setAssignTo('org')}
                        className="accent-indigo-500"
                      />
                      All Teams (Org) ({effectiveAthletes.length})
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-assignTo"
                      checked={assignTo === 'all'}
                      onChange={() => setAssignTo('all')}
                      className="accent-indigo-500"
                    />
                    All Athletes ({athletes.length})
                  </label>
                  {squads.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                      <input
                        type="radio"
                        name="edit-assignTo"
                        checked={assignTo === 'squad'}
                        onChange={() => setAssignTo('squad')}
                        className="accent-indigo-500"
                      />
                      Squad
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-assignTo"
                      checked={assignTo === 'custom'}
                      onChange={() => { setAssignTo('custom'); setCustomIds(new Set(effectiveAthletes.map((a) => a.id))); }}
                      className="accent-indigo-500"
                    />
                    Custom
                  </label>
                </div>

                {assignTo === 'squad' && (
                  <select
                    value={selectedSquad}
                    onChange={(e) => setSelectedSquad(e.target.value)}
                    aria-label="Squad"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 mb-2"
                  >
                    <option value="">Select squad…</option>
                    {squads.map((s) => (
                      <option key={s} value={s}>
                        {s} ({athletes.filter((a) => a.squad === s).length} athletes)
                      </option>
                    ))}
                  </select>
                )}

                {assignTo === 'custom' && (
                  <div className="border border-neutral-700 rounded-lg divide-y divide-neutral-800 max-h-48 overflow-y-auto mb-2">
                    {effectiveAthletes.map((a) => (
                      <label key={a.id} className="flex items-center gap-3 px-3 py-1.5 hover:bg-neutral-800/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customIds.has(a.id)}
                          onChange={() => toggleCustom(a.id)}
                          className="accent-indigo-500"
                        />
                        <span className="text-sm text-neutral-200">{a.name}</span>
                        {a.squad && <span className="ml-auto text-xs text-neutral-500">{a.squad}</span>}
                      </label>
                    ))}
                  </div>
                )}

                <p className="text-xs text-neutral-500">
                  {targetAthleteIds.length} athlete{targetAthleteIds.length !== 1 ? 's' : ''} will
                  be assigned — athletes added or removed vs. the current list will be synced.
                </p>
              </>
            )}
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
              disabled={isSaving || isLoadingCurrent}
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
