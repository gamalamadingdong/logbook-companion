import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { parseLocalDate } from '../../utils/dateUtils';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import {
  getSessionsByDateRange,
  getBoats,
  getBoatings,
  getOrgBoats,
  getOrgBoatings,
  getAthletes,
  getNotesForSession,
  getGroupAssignments,
  createSession,
  updateSession,
  deleteSession,
  createBoat,
  getSessionCrewsForSessions,
  createSessionCrew,
  updateSessionCrew,
  deleteSessionCrew,
  createNote,
  updateNote,
  deleteNote,
  getWeekStart,
  getScheduleEvents,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  getTeamsForOrg,
  type CoachingSession,
  type CoachingAthlete,
  type CoachingAthleteNote,
  type CoachingBoating,
  type CoachingBoat,
  type CoachingSessionCrew,
  type CoachingSessionCrewPosition,
  type GroupAssignment,
  type CoachingScheduleEvent,
  type ScheduleEventType,
  type Team,
} from '../../services/coaching/coachingService';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addWeeks,
  subWeeks,
  addDays,
  addMonths,
  subMonths,
  subDays,
  isToday as isDateToday,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2, Loader2, ChevronDown, ChevronUp, MessageSquare, Calendar, CalendarDays, ClipboardList, MapPin, Flag, Link2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../../components/ui';
import { WeeklyFocusBanner } from '../../components/coaching/WeeklyFocusBanner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LineupsWorkspace } from './CoachingBoatings';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type ViewMode = 'day' | 'week' | 'month';
type ScheduleTab = 'schedule' | 'lineups';

type SessionCrewFormPosition = Pick<CoachingSessionCrewPosition, 'seat' | 'athlete_name'> & {
  athlete_id?: string | null;
};

type SessionCrewFormData = Pick<CoachingSessionCrew, 'boat_name' | 'boat_type'> & {
  boat_id?: string | null;
  source_boating_id?: string | null;
  notes?: string;
  positions: SessionCrewFormPosition[];
};

function CoachingSchedule() {
  const { userId, teamId, orgId, isLoadingTeam, filterTeamId, setFilterTeamId } = useCoachingContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('sessionId');
  const requestedDate = searchParams.get('date');
  const initialFocusDate = requestedDate ? parseLocalDate(requestedDate) : new Date();
  const effectiveTeamId = filterTeamId ?? teamId;
  const activeTab: ScheduleTab = searchParams.get('tab') === 'lineups' ? 'lineups' : 'schedule';
  const showLegacyLineupsPointer = searchParams.get('from') === 'boatings';
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentWeek, setCurrentWeek] = useState(initialFocusDate);
  const [currentMonth, setCurrentMonth] = useState(initialFocusDate);
  const [currentDay, setCurrentDay] = useState(initialFocusDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(requestedDate ? initialFocusDate : null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSession, setEditingSession] = useState<CoachingSession | null>(null);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [sessionCrews, setSessionCrews] = useState<CoachingSessionCrew[]>([]);
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(requestedSessionId);
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);
  const [notesVersion, setNotesVersion] = useState(0);
  const [events, setEvents] = useState<CoachingScheduleEvent[]>([]);
  const [crewFormBoats, setCrewFormBoats] = useState<CoachingBoat[]>([]);
  const [crewFormTemplates, setCrewFormTemplates] = useState<CoachingBoating[]>([]);
  const [crewFormSession, setCrewFormSession] = useState<CoachingSession | null>(null);
  const [editingCrew, setEditingCrew] = useState<CoachingSessionCrew | null>(null);
  const [isLoadingCrewForm, setIsLoadingCrewForm] = useState(false);
  const [orgTeams, setOrgTeams] = useState<Team[]>([]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CoachingScheduleEvent | null>(null);

  const [adjacentHasData, setAdjacentHasData] = useState<{ prev: boolean; next: boolean }>({ prev: false, next: false });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const activeDay = viewMode === 'day' ? currentDay : selectedDate;

  const updateScheduleQuery = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const focusDay = useCallback((date: Date) => {
    setCurrentDay(date);
    setSelectedDate(date);
    setCurrentWeek(date);
    setCurrentMonth(date);
  }, []);

  const openAddSessionForDate = useCallback((date: Date) => {
    focusDay(date);
    setIsAdding(true);
  }, [focusDay]);

  const openAddEventForDate = useCallback((date: Date) => {
    focusDay(date);
    setIsAddingEvent(true);
  }, [focusDay]);

  const getVisibleRange = useCallback(() => {
    if (viewMode === 'day') {
      return {
        start: format(currentDay, 'yyyy-MM-dd'),
        end: format(currentDay, 'yyyy-MM-dd'),
      };
    }

    if (viewMode === 'week') {
      const ws = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const we = endOfWeek(currentWeek, { weekStartsOn: 1 });
      return {
        start: format(ws, 'yyyy-MM-dd'),
        end: format(we, 'yyyy-MM-dd'),
      };
    }

    return {
      start: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
      end: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
    };
  }, [viewMode, currentDay, currentWeek, currentMonth]);

  const loadVisibleData = useCallback(async () => {
    if (!effectiveTeamId) return;

    const { start, end } = getVisibleRange();
    const [s, a, ga, ev, teams] = await Promise.all([
      getSessionsByDateRange(effectiveTeamId, start, end),
      getAthletes(effectiveTeamId),
      getGroupAssignments(effectiveTeamId, { from: start, to: end, orgId: orgId ?? undefined }),
      orgId ? getScheduleEvents(orgId, start, end, filterTeamId ?? undefined) : Promise.resolve([]),
      orgId ? getTeamsForOrg(orgId) : Promise.resolve([]),
    ]);
    const crews = await getSessionCrewsForSessions(effectiveTeamId, s.map((session) => session.id));

    setSessions(s);
    setSessionCrews(crews);
    setAthletes(a);
    setAssignments(ga);
    setEvents(ev);
    if (teams.length) {
      setOrgTeams(teams);
    }
  }, [effectiveTeamId, filterTeamId, getVisibleRange, orgId]);

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;
    loadVisibleData()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions'))
      .finally(() => setIsLoading(false));

    // Lightweight lookahead for adjacent period indicators (non-blocking)
    const checkAdjacent = async () => {
      try {
        let prevStart: string, prevEnd: string, nextStart: string, nextEnd: string;
        if (viewMode === 'day') {
          const prevDay = subDays(currentDay, 1);
          prevStart = format(prevDay, 'yyyy-MM-dd');
          prevEnd = format(prevDay, 'yyyy-MM-dd');
          const nextDay = addDays(currentDay, 1);
          nextStart = format(nextDay, 'yyyy-MM-dd');
          nextEnd = format(nextDay, 'yyyy-MM-dd');
        } else if (viewMode === 'week') {
          const pw = subWeeks(currentWeek, 1);
          prevStart = format(startOfWeek(pw, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          prevEnd = format(endOfWeek(pw, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          const nw = addWeeks(currentWeek, 1);
          nextStart = format(startOfWeek(nw, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          nextEnd = format(endOfWeek(nw, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        } else {
          const pm = subMonths(currentMonth, 1);
          prevStart = format(startOfMonth(pm), 'yyyy-MM-dd');
          prevEnd = format(endOfMonth(pm), 'yyyy-MM-dd');
          const nm = addMonths(currentMonth, 1);
          nextStart = format(startOfMonth(nm), 'yyyy-MM-dd');
          nextEnd = format(endOfMonth(nm), 'yyyy-MM-dd');
        }
        const [prevSessions, nextSessions] = await Promise.all([
          getSessionsByDateRange(effectiveTeamId, prevStart, prevEnd),
          getSessionsByDateRange(effectiveTeamId, nextStart, nextEnd),
        ]);
        setAdjacentHasData({ prev: prevSessions.length > 0, next: nextSessions.length > 0 });
      } catch {
        // Non-critical — keep previous indicator state
      }
    };
    checkAdjacent();
  }, [teamId, isLoadingTeam, currentDay, currentWeek, currentMonth, effectiveTeamId, filterTeamId, loadVisibleData, orgId, viewMode]);

  const refreshSessions = async () => {
    if (!effectiveTeamId) return;
    try {
      await loadVisibleData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    }
  };

  const openCrewForm = async (session: CoachingSession, crew?: CoachingSessionCrew) => {
    if (!effectiveTeamId) return;
    setIsLoadingCrewForm(true);
    try {
      const targetTeamId = session.team_id ?? effectiveTeamId;
      const fetchBoats = orgId
        ? () => getOrgBoats(orgId)
        : () => getBoats(targetTeamId);
      const fetchBoatings = orgId
        ? () => getOrgBoatings(orgId)
        : () => getBoatings(targetTeamId);

      const [boats, templateBoatings] = await Promise.all([
        fetchBoats(),
        fetchBoatings(),
      ]);

      setCrewFormBoats(boats.filter((boat) => boat.team_id === targetTeamId));
      setCrewFormTemplates(
        templateBoatings.filter((entry) =>
          entry.is_active !== false && (!orgId ? entry.team_id === targetTeamId : true)
        )
      );
      setCrewFormSession(session);
      setEditingCrew(crew ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load crew form');
    } finally {
      setIsLoadingCrewForm(false);
    }
  };

  const handleSaveCrewForSession = async (session: CoachingSession, data: SessionCrewFormData) => {
    if (!effectiveTeamId) return;
    try {
      let boatId = data.boat_id ?? null;

      if (!boatId && data.boat_name.trim()) {
        const normalizedName = data.boat_name.trim().toLowerCase();
        const existingBoat = crewFormBoats.find((boat) =>
          boat.team_id === effectiveTeamId &&
          boat.boat_type === data.boat_type &&
          boat.boat_name.trim().toLowerCase() === normalizedName
        );

        if (existingBoat) {
          boatId = existingBoat.id;
        } else {
          const createdBoat = await createBoat(effectiveTeamId, userId, {
            boat_name: data.boat_name.trim(),
            boat_type: data.boat_type,
            sort_order: crewFormBoats.length,
          });
          boatId = createdBoat.id;
          setCrewFormBoats((current) => [...current, createdBoat]);
        }
      }

      const payload = {
        boat_id: boatId,
        source_boating_id: data.source_boating_id ?? null,
        boat_name: data.boat_name.trim(),
        boat_type: data.boat_type,
        notes: data.notes?.trim() || undefined,
        positions: data.positions,
      };

      if (editingCrew) {
        await updateSessionCrew(editingCrew.id, payload);
        toast.success('Crew snapshot updated.');
      } else {
        const existingCrews = sessionCrews.filter((crew) => crew.session_id === session.id);
        await createSessionCrew(effectiveTeamId, userId, {
          session_id: session.id,
          sort_order: existingCrews.length,
          ...payload,
        });
        toast.success('Crew snapshot added to session.');
      }

      setCrewFormSession(null);
      setEditingCrew(null);
      setSelectedDate(parseLocalDate(session.date));
      setExpandedSession(session.id);
      await refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save crew snapshot');
    }
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getSessionsForDay = (date: Date) =>
    sessions.filter((s) => isSameDay(parseLocalDate(s.date), date));

  const getEventsForDay = (date: Date) =>
    events.filter((ev) => {
      const evStart = parseISO(ev.date);
      const evEnd = ev.end_date ? parseISO(ev.end_date) : evStart;
        return isWithinInterval(date, { start: evStart, end: evEnd }) || isSameDay(date, evStart) || isSameDay(date, evEnd);
      });
  const crewCountsBySession = useMemo(() => {
    const counts = new Map<string, number>();
    for (const crew of sessionCrews) {
      counts.set(crew.session_id, (counts.get(crew.session_id) ?? 0) + 1);
    }
    return counts;
  }, [sessionCrews]);

  const handleAddEvent = async (data: Pick<CoachingScheduleEvent, 'date' | 'title' | 'event_type'> & Partial<Pick<CoachingScheduleEvent, 'end_date' | 'location' | 'team_ids' | 'notes'>>) => {
    if (!orgId) return;
    try {
      await createScheduleEvent(orgId, userId, data);
      setIsAddingEvent(false);
      await refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event');
    }
  };

  const handleEditEvent = async (data: Partial<Pick<CoachingScheduleEvent, 'date' | 'end_date' | 'title' | 'event_type' | 'location' | 'team_ids' | 'notes'>>) => {
    if (!editingEvent) return;
    try {
      await updateScheduleEvent(editingEvent.id, data);
      setEditingEvent(null);
      await refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteScheduleEvent(id);
      await refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  const handleAddSession = async (
    data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'> & {
      group_assignment_id?: string | null;
      team_id?: string;
    }
  ) => {
    if (!activeDay || !effectiveTeamId) return;
    try {
      const targetTeamId = data.team_id ?? effectiveTeamId;
      await createSession(targetTeamId, userId, {
        date: format(activeDay, 'yyyy-MM-dd'),
        type: data.type,
        focus: data.focus,
        general_notes: data.general_notes,
        group_assignment_id: data.group_assignment_id ?? null,
      });
      if (targetTeamId !== effectiveTeamId) {
        setFilterTeamId(targetTeamId);
      }
      setIsAdding(false);
      await refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  const handleEditSession = async (data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'> & { group_assignment_id?: string | null }) => {
    if (!editingSession) return;
    try {
      await updateSession(editingSession.id, data);
      setEditingSession(null);
      await refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update session');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      await refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const handleAddNote = async (sessionId: string, athleteId: string, note: string) => {
    if (!effectiveTeamId) return;
    try {
      await createNote(effectiveTeamId, userId, { session_id: sessionId, athlete_id: athleteId, note });
      setAddingNoteFor(null);
      setNotesVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      setNotesVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  const handleEditNote = async (noteId: string, newText: string) => {
    await updateNote(noteId, { note: newText });
    setNotesVersion((v) => v + 1);
  };

  const selectedDaySessions = activeDay
    ? sessions.filter((s) => isSameDay(parseLocalDate(s.date), activeDay))
    : [];
  const currentRangeLabel = viewMode === 'day'
    ? format(currentDay, 'EEEE, MMM d, yyyy')
    : viewMode === 'week'
      ? `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
      : format(currentMonth, 'MMMM yyyy');
  const currentRangeContextLabel = viewMode === 'day'
    ? 'Focused day'
    : viewMode === 'week'
      ? 'Current week'
      : 'Current month';
  const previousRangeLabel = viewMode === 'day' ? 'Previous day' : viewMode === 'week' ? 'Previous week' : 'Previous month';
  const nextRangeLabel = viewMode === 'day' ? 'Next day' : viewMode === 'week' ? 'Next week' : 'Next month';
  const scheduleTabs: Array<{ id: ScheduleTab; label: string; description: string; icon: typeof CalendarDays }> = [
    { id: 'schedule', label: 'Schedule', description: 'Plan sessions and events', icon: CalendarDays },
    { id: 'lineups', label: 'Lineups', description: 'Browse saved crews', icon: Link2 },
  ];
  const activeWorkspaceBadgeLabel = activeTab === 'schedule' ? 'Daily planning' : 'Standing lineups';
  const scheduleTabButtonClass = (isActive: boolean) => twMerge(clsx(
    'h-11 justify-center rounded-xl px-4',
    isActive
      ? 'shadow-sm'
      : 'bg-transparent text-content-secondary hover:bg-surface-card hover:text-content-primary'
  ));
  const calendarModeTabClass = (isActive: boolean) => twMerge(clsx(
    'h-10 justify-center rounded-lg border px-3',
    isActive
      ? 'border-accent-coaching/30 bg-accent-coaching-surface text-accent-coaching shadow-sm'
      : 'border-transparent bg-transparent text-content-muted hover:bg-surface-card hover:text-content-primary'
  ));
  const navIconButtonClass = 'relative h-11 w-11 shrink-0 rounded-xl px-0';

  return (
    <>
    <CoachingNav />
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2 xl:max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-content-primary">Schedule</h1>
                <Badge variant="coaching">{activeWorkspaceBadgeLabel}</Badge>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-content-secondary">
                Plan sessions and events by date, then switch over to Lineups whenever you need to review or edit standing crews.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Schedule workspace sections"
              className="inline-flex w-full items-center gap-1 rounded-2xl border border-border bg-surface-well p-1 sm:w-auto"
            >
              {scheduleTabs.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;

                return (
                  <Button
                    key={id}
                    type="button"
                    variant={isActive ? 'coaching' : 'ghost'}
                    size="md"
                    onClick={() => updateScheduleQuery({ tab: id, from: null })}
                    className={twMerge(scheduleTabButtonClass(isActive), 'flex-1 sm:flex-initial')}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          {activeTab === 'schedule' && (
            <div className="rounded-2xl border border-border bg-surface-secondary/70 p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsLoading(true);
                        if (viewMode === 'day') setCurrentDay(subDays(currentDay, 1));
                        else if (viewMode === 'week') setCurrentWeek(subWeeks(currentWeek, 1));
                        else setCurrentMonth(subMonths(currentMonth, 1));
                      }}
                      className={navIconButtonClass}
                      aria-label={previousRangeLabel}
                      title={previousRangeLabel}
                    >
                      <span className="relative inline-flex">
                        <ChevronLeft className="h-5 w-5" />
                        {adjacentHasData.prev && (
                          <>
                            <span className="sr-only">{`Data available in ${previousRangeLabel.toLowerCase()}`}</span>
                            <span aria-hidden="true" className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent-coaching" />
                          </>
                        )}
                      </span>
                    </Button>

                    <div className="min-w-[220px] rounded-xl border border-border bg-surface-card px-4 py-2 text-center sm:min-w-[260px]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">
                        {currentRangeContextLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-content-primary sm:text-base">
                        {currentRangeLabel}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsLoading(true);
                        if (viewMode === 'day') setCurrentDay(addDays(currentDay, 1));
                        else if (viewMode === 'week') setCurrentWeek(addWeeks(currentWeek, 1));
                        else setCurrentMonth(addMonths(currentMonth, 1));
                      }}
                      className={navIconButtonClass}
                      aria-label={nextRangeLabel}
                      title={nextRangeLabel}
                    >
                      <span className="relative inline-flex">
                        <ChevronRight className="h-5 w-5" />
                        {adjacentHasData.next && (
                          <>
                            <span className="sr-only">{`Data available in ${nextRangeLabel.toLowerCase()}`}</span>
                            <span aria-hidden="true" className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-accent-coaching" />
                          </>
                        )}
                      </span>
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => {
                        setIsLoading(true);
                        focusDay(new Date());
                      }}
                      className="bg-surface-elevated text-content-primary hover:bg-surface-card"
                    >
                      Today
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={() => openAddEventForDate(activeDay ?? currentDay)}
                      className={twMerge(clsx(
                        'border-border bg-surface-elevated text-content-primary hover:bg-surface-card',
                        !orgId && 'hidden'
                      ))}
                    >
                      <Flag className="h-4 w-4" />
                      Add Event
                    </Button>
                    <Button
                      type="button"
                      variant="coaching"
                      size="lg"
                      onClick={() => openAddSessionForDate(activeDay ?? currentDay)}
                    >
                      <Plus className="h-4 w-4" />
                      Add Session
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div
                    role="tablist"
                    aria-label="Schedule calendar view"
                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-card p-1"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('day')}
                      className={calendarModeTabClass(viewMode === 'day')}
                      aria-pressed={viewMode === 'day'}
                    >
                      <Calendar className="h-4 w-4" />
                      Day
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('week')}
                      className={calendarModeTabClass(viewMode === 'week')}
                      aria-pressed={viewMode === 'week'}
                    >
                      <CalendarDays className="h-4 w-4" />
                      Week
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('month')}
                      className={calendarModeTabClass(viewMode === 'month')}
                      aria-pressed={viewMode === 'month'}
                    >
                      <Calendar className="h-4 w-4" />
                      Month
                    </Button>
                  </div>

                  <p className="text-sm text-content-muted">
                    Browse the calendar here, then switch to <span className="font-medium text-content-primary">Lineups</span> to update standing crews.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {showLegacyLineupsPointer && (
          <div className="rounded-xl border border-accent-coaching/25 bg-accent-coaching-surface px-4 py-3 text-sm text-content-primary">
            Lineups now live inside Schedule. You can switch between `Schedule` and `Lineups` here without leaving the page.
          </div>
        )}
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => { setError(null); refreshSessions(); }} className="ml-3 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <>
      {activeTab === 'lineups' ? (
        <LineupsWorkspace embedded />
      ) : (
        <>
      {viewMode === 'day' && (
        <div className="space-y-4">
          {effectiveTeamId && (
            <WeeklyFocusBanner
              teamId={effectiveTeamId}
              weekStart={getWeekStart(startOfWeek(currentDay, { weekStartsOn: 1 }))}
              onEdit={() => navigate('/team-management')}
            />
          )}

          <div className="bg-surface-card border border-border rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-content-primary">
                  {format(currentDay, 'EEEE, MMMM d, yyyy')}
                </h2>
                <p className="mt-1 text-sm text-content-muted">
                  Review the full day plan, crews, and event coverage in one place.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAddSessionForDate(currentDay)}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-coaching px-4 py-2 text-sm font-medium text-white hover:bg-accent-coaching-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Session
                </button>
                {orgId && (
                  <button
                    type="button"
                    onClick={() => openAddEventForDate(currentDay)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-content-secondary hover:bg-surface-secondary transition-colors"
                  >
                    <Flag className="w-4 h-4" />
                    Add Event
                  </button>
                )}
              </div>
            </div>

            {getEventsForDay(currentDay).length > 0 && (
              <div className="space-y-2 mb-4">
                {getEventsForDay(currentDay).map((ev) => (
                  <EventBanner key={ev.id} event={ev} orgTeams={orgTeams} onEdit={() => setEditingEvent(ev)} onDelete={() => handleDeleteEvent(ev.id)} />
                ))}
              </div>
            )}

            {selectedDaySessions.length === 0 && getEventsForDay(currentDay).length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="w-8 h-8" />}
                title="No sessions or events"
                description="Add a session or event for this day, or switch to Lineups to reuse saved crews."
              />
            ) : selectedDaySessions.length > 0 ? (
              <div className="space-y-3">
                {selectedDaySessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    athletes={athletes}
                    assignments={assignments}
                    isExpanded={expandedSession === session.id}
                    onToggle={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                    addingNoteFor={addingNoteFor}
                    onStartAddNote={(athleteId) => setAddingNoteFor(athleteId)}
                    onAddNote={(athleteId, note) => handleAddNote(session.id, athleteId, note)}
                    onCancelNote={() => setAddingNoteFor(null)}
                    onDeleteNote={handleDeleteNote}
                    onEditNote={handleEditNote}
                    onEdit={() => setEditingSession(session)}
                    onDelete={() => handleDeleteSession(session.id)}
                    notesVersion={notesVersion}
                    crewCount={crewCountsBySession.get(session.id) ?? 0}
                    crews={sessionCrews.filter((crew) => crew.session_id === session.id)}
                    onAddCrew={session.type === 'water' ? () => openCrewForm(session) : undefined}
                    isAddingCrew={isLoadingCrewForm && crewFormSession?.id === session.id && !editingCrew}
                    onEditCrew={session.type === 'water' ? (crew) => openCrewForm(session, crew) : undefined}
                    onDeleteCrew={session.type === 'water' ? async (crewId) => {
                      try {
                        await deleteSessionCrew(crewId);
                        await refreshSessions();
                        toast.success('Crew snapshot removed.');
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to delete crew snapshot');
                      }
                    } : undefined}
                    onManageTemplates={session.type === 'water' ? () => {
                      focusDay(parseLocalDate(session.date));
                      updateScheduleQuery({ tab: 'lineups', from: null, date: session.date });
                    } : undefined}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Weekly View ──────────────────────────────────────────────── */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          {/* Weekly Focus Banner */}
          {effectiveTeamId && (
            <WeeklyFocusBanner
              teamId={effectiveTeamId}
              weekStart={getWeekStart(weekStart)}
              onEdit={() => navigate('/team-management')}
            />
          )}
          {weekDays.map((day) => {
            const daySessions = getSessionsForDay(day);
            const dayEvents = getEventsForDay(day);
            const today = isDateToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayName = format(day, 'EEE');
            const dayDate = format(day, 'MMM d');

            return (
              <div
                key={day.toISOString()}
                className={`bg-surface-card border rounded-xl overflow-hidden transition-all ${
                  today ? 'border-accent-coaching/50 ring-1 ring-accent-coaching/20' :
                  isSelected ? 'border-accent-coaching/30' :
                  'border-border'
                }`}
              >
                {/* Event banners at top of day */}
                {dayEvents.length > 0 && (
                  <div className="space-y-0">
                    {dayEvents.map((ev) => (
                      <EventBanner key={ev.id} event={ev} orgTeams={orgTeams} onEdit={() => setEditingEvent(ev)} onDelete={() => handleDeleteEvent(ev.id)} />
                    ))}
                  </div>
                )}

                {/* Day header row */}
                <div
                  className={`flex items-center justify-between px-5 py-3 cursor-pointer ${
                    today ? 'bg-accent-coaching/5' : 'hover:bg-surface-secondary/50'
                  }`}
                  onClick={() => {
                    setCurrentDay(day);
                    setSelectedDate(isSameDay(selectedDate ?? new Date(0), day) ? null : day);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-bold w-10 ${today ? 'text-accent-coaching' : 'text-content-muted'}`}>
                      {dayName}
                    </div>
                    <div className={`text-base font-semibold ${today ? 'text-content-primary' : 'text-content-secondary'}`}>
                      {dayDate}
                    </div>
                    {today && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-accent-coaching text-white rounded-full">Today</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {daySessions.length > 0 && (
                      <span className="text-xs text-content-muted font-medium">
                        {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {dayEvents.length > 0 && (
                      <span className="text-xs text-content-muted font-medium">
                        {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {orgId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openAddEventForDate(day); }}
                        className="p-1.5 hover:bg-surface-secondary rounded-lg transition-colors"
                        aria-label="Add event"
                        title="Add event"
                      >
                        <Flag className="w-4 h-4 text-content-muted hover:text-accent-coaching" />
                      </button>
                    )}
                    {/* Add session button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddSessionForDate(day); }}
                      className="p-1.5 hover:bg-surface-secondary rounded-lg transition-colors"
                      aria-label="Add session"
                      title="Add session"
                    >
                      <Plus className="w-4 h-4 text-content-muted hover:text-accent-coaching" />
                    </button>
                  </div>
                </div>

                {/* Sessions for this day */}
                {daySessions.length > 0 && (
                  <div className="border-t border-border px-5 py-3 space-y-2">
                    {daySessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        athletes={athletes}
                        assignments={assignments}
                        isExpanded={expandedSession === session.id}
                        onToggle={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                        addingNoteFor={addingNoteFor}
                        onStartAddNote={(athleteId) => setAddingNoteFor(athleteId)}
                        onAddNote={(athleteId, note) => handleAddNote(session.id, athleteId, note)}
                        onCancelNote={() => setAddingNoteFor(null)}
                        onDeleteNote={handleDeleteNote}
                        onEditNote={handleEditNote}
                         onEdit={() => setEditingSession(session)}
                         onDelete={() => handleDeleteSession(session.id)}
                         notesVersion={notesVersion}
                         crewCount={crewCountsBySession.get(session.id) ?? 0}
                         crews={sessionCrews.filter((crew) => crew.session_id === session.id)}
                         onAddCrew={session.type === 'water' ? () => openCrewForm(session) : undefined}
                         isAddingCrew={isLoadingCrewForm && crewFormSession?.id === session.id && !editingCrew}
                         onEditCrew={session.type === 'water' ? (crew) => openCrewForm(session, crew) : undefined}
                         onDeleteCrew={session.type === 'water' ? async (crewId) => {
                           try {
                             await deleteSessionCrew(crewId);
                             await refreshSessions();
                             toast.success('Crew snapshot removed.');
                           } catch (err) {
                             toast.error(err instanceof Error ? err.message : 'Failed to delete crew snapshot');
                           }
                         } : undefined}
                          onManageTemplates={session.type === 'water' ? () => {
                            focusDay(parseLocalDate(session.date));
                            updateScheduleQuery({ tab: 'lineups', from: null, date: session.date });
                          } : undefined}
                        />
                     ))}
                   </div>
                )}

                {/* Empty day — show subtle prompt */}
                {daySessions.length === 0 && dayEvents.length === 0 && (
                  <div className="border-t border-border/50 px-5 py-2">
                    <p className="text-xs text-content-faint italic">No sessions</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Monthly View (existing calendar grid) ────────────────────── */}
      {viewMode === 'month' && (
        <>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-indigo-600">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-semibold text-white">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for padding */}
          {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2 min-h-[90px] bg-neutral-800/50" />
          ))}

          {days.map((day) => {
            const daySessions = getSessionsForDay(day);
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <div
                key={day.toISOString()}
                className={`p-2 min-h-[90px] border-r border-b border-border cursor-pointer hover:bg-accent-coaching/5 transition-all ${
                  isSelected ? 'bg-accent-coaching/10 ring-2 ring-accent-coaching ring-inset' : ''
                } ${!isSameMonth(day, currentMonth) ? 'bg-surface-secondary/50' : ''}`}
                onClick={() => {
                  setCurrentDay(day);
                  setSelectedDate(day);
                }}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    isToday
                      ? 'w-7 h-7 bg-accent-coaching text-white rounded-full flex items-center justify-center'
                      : 'text-content-muted'
                  }`}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {/* Event indicators first */}
                  {dayEvents.slice(0, 1).map((ev) => (
                    <div key={ev.id} className={`text-xs px-1.5 py-0.5 rounded-md truncate font-medium ${eventTypeStyles[ev.event_type]?.bg ?? 'bg-surface-secondary'} ${eventTypeStyles[ev.event_type]?.text ?? 'text-content-secondary'}`}>
                      {eventTypeStyles[ev.event_type]?.icon ?? '📅'} {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 1 && (
                    <div className="text-xs text-content-muted font-medium">+{dayEvents.length - 1} event{dayEvents.length - 1 !== 1 ? 's' : ''}</div>
                  )}
                  {/* Session indicators */}
                  {daySessions.slice(0, dayEvents.length > 0 ? 1 : 2).map((session) => (
                    <div
                      key={session.id}
                      className={`text-xs px-1.5 py-0.5 rounded-md truncate font-medium ${
                        session.type === 'water' ? 'bg-blue-900/30 text-blue-400' :
                        session.type === 'erg' ? 'bg-amber-900/30 text-amber-400' :
                        session.type === 'land' ? 'bg-green-900/30 text-green-400' :
                        'bg-surface-secondary text-content-muted'
                      }`}
                    >
                      {session.focus || session.type}
                    </div>
                  ))}
                  {(daySessions.length + dayEvents.length) > 2 && dayEvents.length <= 1 && daySessions.length > (dayEvents.length > 0 ? 1 : 2) && (
                    <div className="text-xs text-content-muted font-medium">
                      +{daySessions.length - (dayEvents.length > 0 ? 1 : 2)} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Panel */}
      {selectedDate && (
        <div className="bg-surface-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-content-primary">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              {orgId && (
                <button onClick={() => openAddEventForDate(selectedDate)}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-content-secondary hover:bg-surface-secondary transition-colors text-sm">
                  <Flag className="w-4 h-4" />
                  Add Event
                </button>
              )}
              <button onClick={() => openAddSessionForDate(selectedDate)}
                className="flex items-center gap-2 px-4 py-2 bg-accent-coaching text-white rounded-lg hover:bg-accent-coaching-hover transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Add Session
              </button>
            </div>
          </div>

          {/* Events for selected day */}
          {getEventsForDay(selectedDate).length > 0 && (
            <div className="space-y-2 mb-4">
              {getEventsForDay(selectedDate).map((ev) => (
                <EventBanner key={ev.id} event={ev} orgTeams={orgTeams} onEdit={() => setEditingEvent(ev)} onDelete={() => handleDeleteEvent(ev.id)} />
              ))}
            </div>
          )}

          {selectedDaySessions.length === 0 && getEventsForDay(selectedDate).length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-8 h-8" />}
              title="No sessions or events"
              description="Add a session or schedule an event for this day."
            />
          ) : selectedDaySessions.length > 0 ? (
            <div className="space-y-3">
              {selectedDaySessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  athletes={athletes}
                  assignments={assignments}
                  isExpanded={expandedSession === session.id}
                  onToggle={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                  addingNoteFor={addingNoteFor}
                  onStartAddNote={(athleteId) => setAddingNoteFor(athleteId)}
                  onAddNote={(athleteId, note) => handleAddNote(session.id, athleteId, note)}
                  onCancelNote={() => setAddingNoteFor(null)}
                  onDeleteNote={handleDeleteNote}
                  onEditNote={handleEditNote}
                   onEdit={() => setEditingSession(session)}
                   onDelete={() => handleDeleteSession(session.id)}
                   notesVersion={notesVersion}
                   crewCount={crewCountsBySession.get(session.id) ?? 0}
                   crews={sessionCrews.filter((crew) => crew.session_id === session.id)}
                   onAddCrew={session.type === 'water' ? () => openCrewForm(session) : undefined}
                   isAddingCrew={isLoadingCrewForm && crewFormSession?.id === session.id && !editingCrew}
                   onEditCrew={session.type === 'water' ? (crew) => openCrewForm(session, crew) : undefined}
                   onDeleteCrew={session.type === 'water' ? async (crewId) => {
                     try {
                       await deleteSessionCrew(crewId);
                       await refreshSessions();
                       toast.success('Crew snapshot removed.');
                     } catch (err) {
                       toast.error(err instanceof Error ? err.message : 'Failed to delete crew snapshot');
                     }
                   } : undefined}
                    onManageTemplates={session.type === 'water' ? () => {
                      focusDay(parseLocalDate(session.date));
                      updateScheduleQuery({ tab: 'lineups', from: null, date: session.date });
                    } : undefined}
                  />
               ))}
             </div>
           ) : null}
        </div>
      )}
        </>
      )}
        </>
      )}
      {/* end viewMode === 'month' */}

      {/* Add Session Modal */}
      {isAdding && activeDay && (
        <SessionForm
          title={`Add Session — ${format(activeDay, 'EEE, MMM d')}`}
          teamId={effectiveTeamId}
          teamName={orgTeams.find((team) => team.id === effectiveTeamId)?.name ?? null}
          orgTeams={orgTeams}
          assignments={assignments}
          onSave={handleAddSession}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <SessionForm
          title="Edit Session"
          session={editingSession}
          teamId={editingSession.team_id}
          teamName={orgTeams.find((team) => team.id === editingSession.team_id)?.name ?? null}
          orgTeams={orgTeams}
          assignments={assignments}
          onSave={handleEditSession}
          onCancel={() => setEditingSession(null)}
        />
      )}

      {crewFormSession && (
        <SessionCrewForm
          session={crewFormSession}
          crew={editingCrew ?? undefined}
          athletes={athletes}
          boats={crewFormBoats}
          orgTeams={orgTeams}
          existingCrews={sessionCrews.filter((crew) => crew.session_id === crewFormSession.id)}
          templateBoatings={crewFormTemplates}
          onSave={(data) => handleSaveCrewForSession(crewFormSession, data)}
          onCancel={() => {
            setCrewFormSession(null);
            setEditingCrew(null);
          }}
        />
      )}

      {/* Add Event Modal */}
      {isAddingEvent && activeDay && (
        <EventForm
          title={`Add Event — ${format(activeDay, 'EEE, MMM d')}`}
          defaultDate={format(activeDay, 'yyyy-MM-dd')}
          orgTeams={orgTeams}
          onSave={handleAddEvent}
          onCancel={() => setIsAddingEvent(false)}
        />
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <EventForm
          title="Edit Event"
          event={editingEvent}
          defaultDate={editingEvent.date}
          orgTeams={orgTeams}
          onSave={(data) => handleEditEvent(data)}
          onCancel={() => setEditingEvent(null)}
        />
      )}
        </>
      )}
    </div>
    </>
  );
}

export { CoachingSchedule };
export default CoachingSchedule;

/* ─── Session Form ─────────────────────────────────────────────────────────── */

function SessionForm({
  title,
  session,
  teamId,
  teamName,
  orgTeams,
  assignments,
  onSave,
  onCancel,
}: {
  title: string;
  session?: CoachingSession;
  teamId?: string | null;
  teamName?: string | null;
  orgTeams?: Team[];
  assignments?: GroupAssignment[];
  onSave: (data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'> & {
    group_assignment_id?: string | null;
    team_id?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<CoachingSession['type']>(session?.type ?? 'water');
  const [focus, setFocus] = useState(session?.focus ?? '');
  const [generalNotes, setGeneralNotes] = useState(session?.general_notes ?? '');
  const [assignmentId, setAssignmentId] = useState(session?.group_assignment_id ?? '');
  const [selectedTeamId, setSelectedTeamId] = useState(session?.team_id ?? teamId ?? '');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" aria-label="Close" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              type,
              focus: focus || undefined,
              general_notes: generalNotes || undefined,
              group_assignment_id: assignmentId || null,
              team_id: !session && selectedTeamId ? selectedTeamId : undefined,
            });
          }}
          className="space-y-4"
        >
          {session ? (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Team</label>
              <div className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300">
                {teamName ?? 'Current team'}
              </div>
            </div>
          ) : (orgTeams && orgTeams.length > 0) ? (
            <div>
              <label htmlFor="session-team" className="block text-sm font-medium text-neutral-300 mb-2">Team</label>
              <select
                id="session-team"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                required
              >
                {orgTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="session-type" className="block text-sm font-medium text-neutral-300 mb-2">Type</label>
            <select id="session-type" value={type} onChange={(e) => setType(e.target.value as CoachingSession['type'])}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
              <option value="water">Water</option>
              <option value="erg">Erg</option>
              <option value="land">Land</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>

          <div>
            <label htmlFor="session-focus" className="block text-sm font-medium text-neutral-300 mb-2">Focus</label>
            <input id="session-focus" type="text" value={focus} onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g., Body Sequence, Timing, Blade Work"
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>

          {assignments && assignments.length > 0 && (
            <div>
              <label htmlFor="session-assignment" className="block text-sm font-medium text-neutral-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-indigo-400" />
                  Linked Assignment
                </span>
              </label>
              <select id="session-assignment" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                <option value="">None</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="session-notes" className="block text-sm font-medium text-neutral-300 mb-2">Notes</label>
            <textarea id="session-notes" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} rows={3}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              placeholder="Session plan, goals, etc." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-3 border border-neutral-700 rounded-xl text-neutral-300 hover:bg-neutral-800 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-medium">
              {session ? 'Save Changes' : 'Add Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Session Card (with expandable notes) ─────────────────────────────────── */

function SessionCard({
  session,
  athletes,
  assignments,
  isExpanded,
  onToggle,
  addingNoteFor,
  onStartAddNote,
  onAddNote,
  onCancelNote,
  onDeleteNote,
  onEditNote,
  onEdit,
  onDelete,
  notesVersion,
  crewCount,
  crews,
  onAddCrew,
  isAddingCrew = false,
  onEditCrew,
  onDeleteCrew,
  onManageTemplates,
}: {
  session: CoachingSession;
  athletes: CoachingAthlete[];
  assignments?: GroupAssignment[];
  isExpanded: boolean;
  onToggle: () => void;
  addingNoteFor: string | null;
  onStartAddNote: (athleteId: string) => void;
  onAddNote: (athleteId: string, note: string) => void;
  onCancelNote: () => void;
  onDeleteNote: (noteId: string) => void;
  onEditNote: (noteId: string, newText: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  notesVersion: number;
  crewCount: number;
  crews: CoachingSessionCrew[];
  onAddCrew?: () => void;
  isAddingCrew?: boolean;
  onEditCrew?: (crew: CoachingSessionCrew) => void;
  onDeleteCrew?: (crewId: string) => void;
  onManageTemplates?: () => void;
}) {
  const [notes, setNotes] = useState<CoachingAthleteNote[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    if (isExpanded) {
      getNotesForSession(session.id).then(setNotes).catch(console.error);
    }
  }, [isExpanded, session.id, notesVersion]);

  const getAthleteName = (athleteId: string) =>
    athletes.find((a) => a.id === athleteId)?.name ?? 'Unknown';

  return (
    <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={onToggle}
        >
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            session.type === 'water' ? 'bg-blue-900/30 text-blue-400' :
            session.type === 'erg' ? 'bg-amber-900/30 text-amber-400' :
            session.type === 'land' ? 'bg-green-900/30 text-green-400' :
            'bg-neutral-700 text-neutral-300'
          }`}>
            {session.type.toUpperCase()}
          </span>
          {session.focus && <span className="text-sm font-semibold text-indigo-400">{session.focus}</span>}
          {session.group_assignment_id && (() => {
            const linked = assignments?.find((a) => a.id === session.group_assignment_id);
            return linked ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-400 font-medium">
                <ClipboardList className="w-3 h-3" />
                {linked.title}
              </span>
            ) : null;
          })()}
          {crewCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-secondary border border-border/50 rounded-full text-xs text-content-secondary font-medium">
              <Link2 className="w-3 h-3" />
              {crewCount} crew snapshot{crewCount !== 1 ? 's' : ''}
            </span>
          )}
          {!isExpanded && session.general_notes && (
            <span className="text-sm text-neutral-500 truncate max-w-[200px]">{session.general_notes}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {notes.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-indigo-500/10 rounded-full text-xs text-indigo-400 font-medium mr-1">
              <MessageSquare className="w-3 h-3" />
              {notes.length}
            </span>
          )}
          <button onClick={onEdit}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" aria-label="Edit session" title="Edit session">
            <Edit2 className="w-4 h-4 text-neutral-500 hover:text-indigo-400" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" aria-label="Delete session" title="Delete session">
            <Trash2 className="w-4 h-4 text-neutral-500 hover:text-red-400" />
          </button>
          <button onClick={onToggle}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" aria-label="Toggle notes" title="Toggle notes">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-indigo-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-neutral-700/50 p-4 space-y-4 bg-neutral-800/30">
          {/* General Notes */}
          {session.general_notes && (
            <div>
              <h4 className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">Session Notes</h4>
              <p className="text-sm bg-neutral-800 p-3 rounded-xl border border-neutral-700 text-neutral-300">
                {session.general_notes}
              </p>
            </div>
          )}

          {onManageTemplates && (
            <div className="space-y-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Crew snapshots for this session</p>
                  <p className="text-xs text-neutral-400">
                    {crewCount > 0
                      ? `${crewCount} crew snapshot${crewCount !== 1 ? 's' : ''} saved in this session report`
                      : 'No crew snapshots saved yet'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {onAddCrew && (
                    <button
                      onClick={onAddCrew}
                      disabled={isAddingCrew}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-60"
                    >
                      {isAddingCrew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Add crew snapshot
                    </button>
                  )}
                  <button
                    onClick={onManageTemplates}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/30 bg-neutral-900/40 px-3 py-2 text-sm font-medium text-indigo-100 hover:bg-neutral-800 transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    Lineups
                  </button>
                </div>
              </div>

              {crews.length > 0 ? (
                <div className="space-y-3">
                  {crews.map((crew) => (
                    <SessionCrewSummary
                      key={crew.id}
                      crew={crew}
                      getAthleteName={getAthleteName}
                      onEdit={onEditCrew ? () => onEditCrew(crew) : undefined}
                      onDelete={onDeleteCrew ? () => onDeleteCrew(crew.id) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">
                  Add the crews that went out today, or open lineups to start from a saved lineup.
                </p>
              )}
            </div>
          )}

          {/* Athlete Notes */}
          <div>
            <h4 className="text-xs font-medium text-neutral-500 mb-3 uppercase tracking-wide">Athlete Notes</h4>

            {notes.length > 0 && (
              <div className="space-y-2 mb-4">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-3 p-3 bg-neutral-800 rounded-xl border border-neutral-700">
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {getAthleteName(note.athlete_id).charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{getAthleteName(note.athlete_id)}</p>
                      {editingNoteId === note.id ? (
                        <div className="mt-1 space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                            aria-label="Edit note"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => { onEditNote(note.id, editingText); setEditingNoteId(null); }}
                              disabled={!editingText.trim()}
                              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50"
                            >Save</button>
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="px-3 py-1 text-xs border border-neutral-700 text-neutral-400 rounded-lg hover:bg-neutral-800"
                            >Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-400 mt-0.5">{note.note}</p>
                      )}
                    </div>
                    {editingNoteId !== note.id && (
                      <div className="flex items-start gap-1 shrink-0">
                        <button onClick={() => { setEditingNoteId(note.id); setEditingText(note.note); }}
                          className="p-1 hover:bg-neutral-700 rounded-lg transition-colors" aria-label="Edit note" title="Edit note">
                          <Edit2 className="w-3.5 h-3.5 text-neutral-500 hover:text-indigo-400" />
                        </button>
                        <button onClick={() => onDeleteNote(note.id)}
                          className="p-1 hover:bg-neutral-700 rounded-lg transition-colors" aria-label="Delete note" title="Delete note">
                          <Trash2 className="w-3.5 h-3.5 text-neutral-500 hover:text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Note */}
            {addingNoteFor === null ? (
              <button
                onClick={() => athletes.length > 0 && onStartAddNote(athletes[0].id)}
                disabled={athletes.length === 0}
                className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add athlete note
              </button>
            ) : (
              <AddNoteForm athletes={athletes} onSave={onAddNote} onCancel={onCancelNote} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCrewForm({
  session,
  crew,
  athletes,
  boats,
  orgTeams,
  existingCrews,
  templateBoatings,
  onSave,
  onCancel,
}: {
  session: CoachingSession;
  crew?: CoachingSessionCrew;
  athletes: CoachingAthlete[];
  boats: CoachingBoat[];
  orgTeams: Team[];
  existingCrews: CoachingSessionCrew[];
  templateBoatings: CoachingBoating[];
  onSave: (data: SessionCrewFormData) => void;
  onCancel: () => void;
}) {
  const [selectedBoatId, setSelectedBoatId] = useState(crew?.boat_id ?? '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(crew?.source_boating_id ?? '');
  const [boatName, setBoatName] = useState(crew?.boat_name ?? '');
  const [boatType, setBoatType] = useState<CoachingSessionCrew['boat_type']>(crew?.boat_type ?? '8+');
  const [positions, setPositions] = useState<SessionCrewFormPosition[]>(
    crew?.positions.map((position) => ({
      seat: position.seat,
      athlete_id: position.athlete_id ?? null,
      athlete_name: position.athlete_name,
    })) ?? []
  );
  const [notes, setNotes] = useState(crew?.notes ?? '');
  const sessionTeamId = session.team_id ?? null;
  const teamNamesById = useMemo(
    () => new Map(orgTeams.map((team) => [team.id, team.name])),
    [orgTeams]
  );

  const takenAthleteIds = new Set(
    existingCrews
      .filter((existingCrew) => existingCrew.id !== crew?.id)
      .flatMap((existingCrew) => existingCrew.positions.map((position) => position.athlete_id))
      .filter((athleteId): athleteId is string => Boolean(athleteId))
  );

  const seatCount =
    boatType === '8+' ? 8 :
    ['4+', '4x', '4-'].includes(boatType) ? 4 :
    ['2x', '2-'].includes(boatType) ? 2 : 1;
  const hasCox = boatType.includes('+');
  const isSweep = !boatType.includes('x') && boatType !== '1x';

  const getAthleteForSeat = (seat: number) =>
    positions.find((position) => position.seat === seat)?.athlete_id ?? '';

  const getPositionForSeat = (seat: number) =>
    positions.find((position) => position.seat === seat);

  const getSeatValue = (seat: number) => {
    const position = getPositionForSeat(seat);
    if (!position) return '';
    return position.athlete_id ?? `snapshot:${seat}`;
  };

  const isAthleteVisibleForSeat = (seat: number) => {
    const athleteId = getPositionForSeat(seat)?.athlete_id;
    if (!athleteId) return false;
    return athletes.some((athlete) => athlete.id === athleteId);
  };

  const getAvailableAthletes = (seat: number) => {
    const currentId = getAthleteForSeat(seat);
    const otherSeatIds = new Set(positions.filter((position) => position.seat !== seat).map((position) => position.athlete_id));
    return athletes.filter(
      (athlete) => athlete.id === currentId || (!takenAthleteIds.has(athlete.id) && !otherSeatIds.has(athlete.id))
    );
  };

  const sortedAvailable = (seat: number) => {
    const available = getAvailableAthletes(seat);
    if (!isSweep || seat === 0) return available;
    const preferredSide = seat % 2 === 0 ? 'port' : 'starboard';
    return [...available].sort((a, b) => {
      const aMatch = a.side === preferredSide || a.side === 'both' ? 0 : 1;
      const bMatch = b.side === preferredSide || b.side === 'both' ? 0 : 1;
      return aMatch - bMatch;
    });
  };

  const getSeatLabel = (seat: number) => {
    if (seat === 0) return 'Coxswain';
    if (seat === seatCount) return `${seat} (Stroke)`;
    if (seat === 1) return '1 (Bow)';
    return seat.toString();
  };

  const setPosition = (seat: number, athleteId: string) => {
    if (!athleteId) {
      setPositions(positions.filter((position) => position.seat !== seat));
      return;
    }

      const athleteName = athletes.find((athlete) => athlete.id === athleteId)?.name ?? 'Unknown athlete';
      const existing = positions.find((position) => position.seat === seat);
      if (existing) {
        setPositions(positions.map((position) => (
          position.seat === seat ? { ...position, athlete_id: athleteId, athlete_name: athleteName } : position
        )));
      return;
    }

    setPositions([...positions, { seat, athlete_id: athleteId, athlete_name: athleteName }]);
  };

  const findLatestBoatTemplate = (boatId: string) => {
    return [...templateBoatings]
      .filter((entry) => entry.boat_id === boatId && entry.positions.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  };

  const applyTemplate = (template?: CoachingBoating) => {
    if (!template) return;
    const matchingBoat = template.boat_id ? boats.find((boat) => boat.id === template.boat_id) : undefined;
    setSelectedTemplateId(template.id);
    setSelectedBoatId(template.team_id === sessionTeamId ? matchingBoat?.id ?? '' : '');
    setBoatName(template.boat_name);
    setBoatType(template.boat_type);
    setPositions(template.positions.map((position) => ({
      seat: position.seat,
      athlete_id: position.athlete_id,
      athlete_name: position.athlete_name ?? athletes.find((athlete) => athlete.id === position.athlete_id)?.name ?? 'Unknown athlete',
    })));
  };

  const handleBoatSelection = (boatId: string) => {
    setSelectedBoatId(boatId);
    if (!boatId) {
      setSelectedTemplateId('');
      return;
    }

    const selectedBoat = boats.find((boat) => boat.id === boatId);
    if (!selectedBoat) return;

    setBoatName(selectedBoat.boat_name);
    setBoatType(selectedBoat.boat_type);
    const latestTemplate = findLatestBoatTemplate(boatId);
    if (latestTemplate) {
      applyTemplate(latestTemplate);
    } else {
      setSelectedTemplateId('');
      setPositions([]);
    }
  };

  const availableTemplates = [...templateBoatings]
    .filter((template) => template.positions.length > 0)
    .sort((a, b) => {
      const aPriority = a.team_id === sessionTeamId ? 0 : 1;
      const bPriority = b.team_id === sessionTeamId ? 0 : 1;
      return aPriority - bPriority || b.date.localeCompare(a.date) || a.boat_name.localeCompare(b.boat_name);
    });

  const getTemplateLabel = (template: CoachingBoating) => {
    const teamLabel =
      template.team_id && template.team_id !== sessionTeamId
        ? `${teamNamesById.get(template.team_id) ?? 'Other team'} · `
        : '';
    return `${teamLabel}${template.boat_name} · ${template.boat_type} · ${format(parseLocalDate(template.date), 'MMM d')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:max-h-[calc(100vh-4rem)] max-h-[calc(100vh-2rem)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{crew ? 'Edit crew snapshot' : 'Add crew snapshot'}</h2>
            <p className="mt-1 text-sm text-neutral-400">
              {format(parseLocalDate(session.date), 'EEE, MMM d')} · {session.focus || session.type.toUpperCase()}
            </p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-2 transition-colors hover:bg-neutral-800" title="Close">
            <X className="h-5 w-5 text-neutral-400" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              boat_id: selectedBoatId || null,
              source_boating_id: selectedTemplateId || null,
              boat_name: boatName,
              boat_type: boatType,
              positions,
              notes: notes || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="session-existing-boat" className="mb-2 block text-sm font-medium text-neutral-300">Persistent Boat</label>
              <select
                id="session-existing-boat"
                value={selectedBoatId}
                onChange={(e) => handleBoatSelection(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Create a new boat record from this log</option>
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.boat_name} · {boat.boat_type}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Choose an existing shell to start from its latest crew, or leave blank to enter a fresh session snapshot.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="session-template" className="mb-2 block text-sm font-medium text-neutral-300">Start from saved lineup</label>
              <select
                id="session-template"
                value={selectedTemplateId}
                disabled={availableTemplates.length === 0}
                onChange={(e) => {
                  const templateId = e.target.value;
                  setSelectedTemplateId(templateId);
                  if (!templateId) return;
                  applyTemplate(availableTemplates.find((template) => template.id === templateId));
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availableTemplates.length === 0 ? (
                  <option value="">No saved lineups available yet</option>
                ) : (
                  <>
                    <option value="">None</option>
                    {availableTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {getTemplateLabel(template)}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Saved lineups come from active lineup history in this org and are copied into this session snapshot.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Team labels appear for lineups saved by another team. If a saved crew includes someone no longer on the current roster, their saved name stays visible until you reassign that seat.
              </p>
            </div>
            <div>
              <label htmlFor="session-boat-name" className="mb-2 block text-sm font-medium text-neutral-300">Boat Name</label>
              <input
                id="session-boat-name"
                type="text"
                value={boatName}
                onChange={(e) => setBoatName(e.target.value)}
                disabled={!!selectedBoatId}
                placeholder="e.g. Varsity 8+"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="session-boat-type" className="mb-2 block text-sm font-medium text-neutral-300">Boat Type</label>
              <select
                id="session-boat-type"
                value={boatType}
                disabled={!!selectedBoatId}
                onChange={(e) => { setBoatType(e.target.value as CoachingBoating['boat_type']); setPositions([]); }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              >
                <option value="8+">8+ (Eight with Cox)</option>
                <option value="4+">4+ (Four with Cox)</option>
                <option value="4-">4- (Coxless Four)</option>
                <option value="4x">4x (Quad)</option>
                <option value="2x">2x (Double)</option>
                <option value="2-">2- (Pair)</option>
                <option value="1x">1x (Single)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="mb-2 block text-sm font-medium text-neutral-300">Seats</label>

            {hasCox && (
              <div className="flex items-center gap-3 rounded-xl bg-amber-900/20 p-2">
                <label htmlFor="session-seat-cox" className="w-20 shrink-0 text-sm font-medium text-amber-400">Coxswain</label>
                <select
                  id="session-seat-cox"
                  value={getSeatValue(0)}
                  onChange={(e) => setPosition(0, e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select —</option>
                  {getPositionForSeat(0)?.athlete_name && !isAthleteVisibleForSeat(0) && (
                    <option value={getSeatValue(0)} disabled>
                      {getPositionForSeat(0)?.athlete_name} (saved snapshot)
                    </option>
                  )}
                  {sortedAvailable(0).map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>{athlete.name}{athlete.side === 'coxswain' ? ' ⚓' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: seatCount }, (_, i) => seatCount - i).map((seat) => (
                <div
                  key={seat}
                  className={`flex items-center gap-3 rounded-xl p-2 ${
                    seat === seatCount ? 'bg-indigo-500/5' : seat === 1 ? 'bg-teal-900/20' : ''
                  }`}
                >
                  <label
                    htmlFor={`session-seat-${seat}`}
                    className={`w-20 shrink-0 text-sm font-medium ${
                      seat === seatCount ? 'text-indigo-400' : seat === 1 ? 'text-teal-400' : 'text-neutral-400'
                    }`}
                  >
                    {getSeatLabel(seat)}
                  </label>
                   <select
                     id={`session-seat-${seat}`}
                     value={getSeatValue(seat)}
                     onChange={(e) => setPosition(seat, e.target.value)}
                     className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                   >
                     <option value="">— Select —</option>
                     {getPositionForSeat(seat)?.athlete_name && !isAthleteVisibleForSeat(seat) && (
                       <option value={getSeatValue(seat)} disabled>
                         {getPositionForSeat(seat)?.athlete_name} (saved snapshot)
                       </option>
                     )}
                     {sortedAvailable(seat).map((athlete) => (
                       <option key={athlete.id} value={athlete.id}>
                         {athlete.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="session-boating-notes" className="mb-2 block text-sm font-medium text-neutral-300">Crew Note</label>
            <textarea
              id="session-boating-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What happened with this crew today?"
              className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-500"
            >
              {crew ? 'Save crew snapshot' : 'Add crew snapshot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SessionCrewSummary({
  crew,
  getAthleteName,
  onEdit,
  onDelete,
}: {
  crew: CoachingSessionCrew;
  getAthleteName: (athleteId: string) => string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const seatCount =
    crew.boat_type === '8+' ? 8 :
    ['4+', '4x', '4-'].includes(crew.boat_type) ? 4 :
    ['2x', '2-'].includes(crew.boat_type) ? 2 : 1;
  const hasCox = crew.boat_type.includes('+');
  const seatOrder = [...(hasCox ? [0] : []), ...Array.from({ length: seatCount }, (_, i) => seatCount - i)];

  const getSeatLabel = (seat: number) => {
    if (seat === 0) return 'Cox';
    if (seat === seatCount) return 'Stroke';
    if (seat === 1) return 'Bow';
    return seat.toString();
  };

  return (
    <div className="rounded-xl border border-neutral-700/60 bg-neutral-900/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{crew.boat_name}</p>
          <p className="text-xs text-neutral-500">{crew.boat_type} · saved in session report</p>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors" aria-label="Edit crew snapshot" title="Edit crew snapshot">
              <Edit2 className="w-3.5 h-3.5 text-neutral-500 hover:text-indigo-400" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors" aria-label="Delete crew snapshot" title="Delete crew snapshot">
              <Trash2 className="w-3.5 h-3.5 text-neutral-500 hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {seatOrder.map((seat) => {
          const position = crew.positions.find((entry) => entry.seat === seat);
          return (
            <div key={`${crew.id}-${seat}`} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-800/60 px-3 py-2">
              <span className="text-xs font-medium text-neutral-400">{getSeatLabel(seat)}</span>
              <span className="truncate text-sm text-neutral-200">
                {position ? (position.athlete_name || (position.athlete_id ? getAthleteName(position.athlete_id) : 'Unknown athlete')) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {crew.notes && (
        <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-800/40 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Crew note</p>
          <p className="mt-1 text-sm text-neutral-300">{crew.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Add Note Form ────────────────────────────────────────────────────────── */

function AddNoteForm({
  athletes,
  onSave,
  onCancel,
}: {
  athletes: CoachingAthlete[];
  onSave: (athleteId: string, note: string) => void;
  onCancel: () => void;
}) {
  const [selectedAthleteId, setSelectedAthleteId] = useState(athletes[0]?.id ?? '');
  const [note, setNote] = useState('');

  return (
    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={selectedAthleteId}
          onChange={(e) => setSelectedAthleteId(e.target.value)}
          className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          aria-label="Select athlete"
        >
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button onClick={onCancel} className="p-2 hover:bg-neutral-700 rounded-lg transition-colors" aria-label="Cancel" title="Cancel">
          <X className="w-4 h-4 text-neutral-400" />
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note about this athlete's performance..."
        rows={2}
        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
        aria-label="Athlete note"
        autoFocus
      />
      <button
        onClick={() => note.trim() && onSave(selectedAthleteId, note.trim())}
        disabled={!note.trim()}
        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save Note
      </button>
    </div>
  );
}

/* ─── Event Type Styles ────────────────────────────────────────────────────── */

const eventTypeStyles: Record<ScheduleEventType, { bg: string; text: string; icon: string; label: string }> = {
  regatta:    { bg: 'bg-amber-900/30',  text: 'text-amber-400',  icon: '🏆', label: 'Regatta' },
  scrimmage:  { bg: 'bg-purple-900/30', text: 'text-purple-400', icon: '⚔️', label: 'Scrimmage' },
  head_race:  { bg: 'bg-blue-900/30',   text: 'text-blue-400',   icon: '🏁', label: 'Head Race' },
  team_event: { bg: 'bg-surface-secondary', text: 'text-content-secondary', icon: '📅', label: 'Team Event' },
  off_day:    { bg: 'bg-red-900/30',    text: 'text-red-400',    icon: '🔴', label: 'Off Day' },
};

/* ─── Event Banner (shown at top of day blocks) ────────────────────────────── */

function EventBanner({
  event,
  orgTeams,
  onEdit,
  onDelete,
}: {
  event: CoachingScheduleEvent;
  orgTeams: Team[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const style = eventTypeStyles[event.event_type] ?? eventTypeStyles.team_event;
  const teamNames = event.team_ids
    ?.map((tid) => orgTeams.find((t) => t.id === tid)?.name)
    .filter(Boolean) ?? [];
  const scopeLabel = teamNames.length > 0 ? teamNames.join(', ') : 'All teams';

  return (
    <div className={`flex items-center justify-between gap-2 px-5 py-2.5 ${style.bg} border-b border-border/50`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">{style.icon}</span>
        <span className={`text-sm font-semibold truncate ${style.text}`}>{event.title}</span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${style.bg} ${style.text} border border-current/20`}>
          {style.label}
        </span>
        <span className="inline-flex items-center rounded-full border border-current/15 bg-black/10 px-2 py-0.5 text-xs font-medium text-content-secondary">
          {scopeLabel}
        </span>
        {event.location && (
          <span className="hidden lg:flex items-center gap-1 text-xs text-content-muted">
            <MapPin className="w-3 h-3" />
            {event.location}
          </span>
        )}
        {event.end_date && event.end_date !== event.date && (
          <span className="hidden sm:inline text-xs text-content-faint">
            {format(parseISO(event.date), 'MMM d')}–{format(parseISO(event.end_date), 'MMM d')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="p-1 hover:bg-surface-secondary rounded transition-colors" aria-label="Edit event" title="Edit event">
          <Edit2 className="w-3.5 h-3.5 text-content-muted hover:text-accent-coaching" />
        </button>
        <button onClick={onDelete} className="p-1 hover:bg-surface-secondary rounded transition-colors" aria-label="Delete event" title="Delete event">
          <Trash2 className="w-3.5 h-3.5 text-content-muted hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}

/* ─── Event Form (Modal) ───────────────────────────────────────────────────── */

function EventForm({
  title,
  event,
  defaultDate,
  orgTeams,
  onSave,
  onCancel,
}: {
  title: string;
  event?: CoachingScheduleEvent;
  defaultDate: string;
  orgTeams: Team[];
  onSave: (data: Pick<CoachingScheduleEvent, 'date' | 'title' | 'event_type'> & Partial<Pick<CoachingScheduleEvent, 'end_date' | 'location' | 'team_ids' | 'notes'>>) => void;
  onCancel: () => void;
}) {
  const [eventTitle, setEventTitle] = useState(event?.title ?? '');
  const [eventType, setEventType] = useState<ScheduleEventType>(event?.event_type ?? 'regatta');
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [endDate, setEndDate] = useState(event?.end_date ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(event?.team_ids ?? []);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((t) => t !== teamId) : [...prev, teamId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface-card border border-border rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-content-primary">{title}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-surface-secondary rounded-lg transition-colors" aria-label="Close" title="Close">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!eventTitle.trim()) return;
            onSave({
              date,
              title: eventTitle.trim(),
              event_type: eventType,
              end_date: endDate || undefined,
              location: location || undefined,
              team_ids: selectedTeamIds.length > 0 ? selectedTeamIds : undefined,
              notes: notes || undefined,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="event-title" className="block text-sm font-medium text-content-secondary mb-2">Title</label>
            <input id="event-title" type="text" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)}
              placeholder="e.g., Head of the Charles"
              className="w-full px-4 py-3 bg-surface-well border border-border rounded-xl text-content-primary focus:ring-2 focus:ring-accent-coaching focus:border-transparent outline-none"
              required autoFocus />
          </div>

          <div>
            <label htmlFor="event-type" className="block text-sm font-medium text-content-secondary mb-2">Type</label>
            <select id="event-type" value={eventType} onChange={(e) => setEventType(e.target.value as ScheduleEventType)}
              className="w-full px-4 py-3 bg-surface-well border border-border rounded-xl text-content-primary focus:ring-2 focus:ring-accent-coaching focus:border-transparent outline-none">
              <option value="regatta">🏆 Regatta</option>
              <option value="scrimmage">⚔️ Scrimmage</option>
              <option value="head_race">🏁 Head Race</option>
              <option value="team_event">📅 Team Event</option>
              <option value="off_day">🔴 Off Day</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="event-date" className="block text-sm font-medium text-content-secondary mb-2">Start Date</label>
              <input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-surface-well border border-border rounded-xl text-content-primary focus:ring-2 focus:ring-accent-coaching focus:border-transparent outline-none"
                required />
            </div>
            <div>
              <label htmlFor="event-end-date" className="block text-sm font-medium text-content-secondary mb-2">End Date</label>
              <input id="event-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                min={date}
                className="w-full px-4 py-3 bg-surface-well border border-border rounded-xl text-content-primary focus:ring-2 focus:ring-accent-coaching focus:border-transparent outline-none" />
            </div>
          </div>

          <div>
            <label htmlFor="event-location" className="block text-sm font-medium text-content-secondary mb-2">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-accent-coaching" /> Location</span>
            </label>
            <input id="event-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Cooper River, NJ"
              className="w-full px-4 py-3 bg-surface-well border border-border rounded-xl text-content-primary focus:ring-2 focus:ring-accent-coaching focus:border-transparent outline-none" />
          </div>

          {orgTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                <span className="flex items-center gap-1.5"><Flag className="w-4 h-4 text-accent-coaching" /> Teams Attending</span>
              </label>
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeamIds([])}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedTeamIds.length === 0
                      ? 'bg-accent-coaching/20 border-accent-coaching text-accent-coaching font-medium'
                      : 'bg-surface-well border-border text-content-muted hover:border-content-muted'
                  }`}
                >
                  All teams
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {orgTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      selectedTeamIds.includes(team.id)
                        ? 'bg-accent-coaching/20 border-accent-coaching text-accent-coaching font-medium'
                        : 'bg-surface-well border-border text-content-muted hover:border-content-muted'
                    }`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="event-notes" className="block text-sm font-medium text-content-secondary mb-2">Notes</label>
            <textarea id="event-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full px-4 py-3 bg-surface-well border border-border rounded-xl text-content-primary focus:ring-2 focus:ring-accent-coaching focus:border-transparent outline-none resize-none"
              placeholder="Travel details, schedule, etc." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-3 border border-border rounded-xl text-content-secondary hover:bg-surface-secondary transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={!eventTitle.trim()}
              className="flex-1 px-4 py-3 bg-accent-coaching text-white rounded-xl hover:bg-accent-coaching-hover transition-colors font-medium disabled:opacity-50">
              {event ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
