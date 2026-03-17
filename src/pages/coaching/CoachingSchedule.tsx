import { useState, useEffect } from 'react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { parseLocalDate } from '../../utils/dateUtils';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import {
  getSessionsByDateRange,
  getAthletes,
  getNotesForSession,
  getGroupAssignments,
  createSession,
  updateSession,
  deleteSession,
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
  addMonths,
  subMonths,
  isToday as isDateToday,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2, Loader2, ChevronDown, ChevronUp, MessageSquare, Calendar, CalendarDays, ClipboardList, MapPin, Flag } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { WeeklyFocusBanner } from '../../components/coaching/WeeklyFocusBanner';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type ViewMode = 'week' | 'month';

export function CoachingSchedule() {
  const { userId, teamId, orgId, isLoadingTeam, filterTeamId } = useCoachingContext();
  const navigate = useNavigate();
  const effectiveTeamId = filterTeamId ?? teamId;
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSession, setEditingSession] = useState<CoachingSession | null>(null);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);
  const [notesVersion, setNotesVersion] = useState(0);
  const [events, setEvents] = useState<CoachingScheduleEvent[]>([]);
  const [orgTeams, setOrgTeams] = useState<Team[]>([]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CoachingScheduleEvent | null>(null);

  const [adjacentHasData, setAdjacentHasData] = useState<{ prev: boolean; next: boolean }>({ prev: false, next: false });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;
    let start: string, end: string;
    if (viewMode === 'week') {
      const ws = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const we = endOfWeek(currentWeek, { weekStartsOn: 1 });
      start = format(ws, 'yyyy-MM-dd');
      end = format(we, 'yyyy-MM-dd');
    } else {
      start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    }
    Promise.all([
      getSessionsByDateRange(effectiveTeamId, start, end),
      getAthletes(effectiveTeamId),
      getGroupAssignments(effectiveTeamId, { from: start, to: end, orgId: orgId ?? undefined }),
      orgId ? getScheduleEvents(orgId, start, end, filterTeamId ?? undefined) : Promise.resolve([]),
      orgId ? getTeamsForOrg(orgId) : Promise.resolve([]),
    ])
      .then(([s, a, ga, ev, teams]) => { setSessions(s); setAthletes(a); setAssignments(ga); setEvents(ev); if (teams.length) setOrgTeams(teams); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions'))
      .finally(() => setIsLoading(false));

    // Lightweight lookahead for adjacent period indicators (non-blocking)
    const checkAdjacent = async () => {
      try {
        let prevStart: string, prevEnd: string, nextStart: string, nextEnd: string;
        if (viewMode === 'week') {
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
  }, [teamId, effectiveTeamId, isLoadingTeam, viewMode, currentWeek, currentMonth]);

  const refreshSessions = async () => {
    if (!effectiveTeamId) return;
    try {
      let start: string, end: string;
      if (viewMode === 'week') {
        const ws = startOfWeek(currentWeek, { weekStartsOn: 1 });
        const we = endOfWeek(currentWeek, { weekStartsOn: 1 });
        start = format(ws, 'yyyy-MM-dd');
        end = format(we, 'yyyy-MM-dd');
      } else {
        start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      }
      const [s, ev] = await Promise.all([
        getSessionsByDateRange(effectiveTeamId, start, end),
        orgId ? getScheduleEvents(orgId, start, end, filterTeamId ?? undefined) : Promise.resolve([]),
      ]);
      setSessions(s);
      setEvents(ev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
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

  const handleAddSession = async (data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'> & { group_assignment_id?: string | null }) => {
    if (!selectedDate || !effectiveTeamId) return;
    try {
      await createSession(effectiveTeamId, userId, {
        ...data,
        date: format(selectedDate, 'yyyy-MM-dd'),
      });
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

  const selectedDaySessions = selectedDate
    ? sessions.filter((s) => isSameDay(parseLocalDate(s.date), selectedDate))
    : [];

  return (
    <>
    <CoachingNav />
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center bg-neutral-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`flex items-center justify-center gap-1.5 flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`flex items-center justify-center gap-1.5 flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'month'
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Month
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button type="button" onClick={() => {
                setIsLoading(true);
                if (viewMode === 'week') setCurrentWeek(subWeeks(currentWeek, 1));
                else setCurrentMonth(subMonths(currentMonth, 1));
              }}
                className="relative p-2 hover:bg-neutral-800 rounded-lg transition-colors shrink-0" aria-label={viewMode === 'week' ? 'Previous week' : 'Previous month'} title={viewMode === 'week' ? 'Previous week' : 'Previous month'}>
                <ChevronLeft className="w-5 h-5 text-neutral-400" />
                {adjacentHasData.prev && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />}
              </button>
              <span className="text-sm sm:text-lg font-semibold text-center flex-1 sm:flex-initial sm:min-w-[200px] px-2 sm:px-4 py-2 bg-neutral-800 rounded-lg text-white truncate">
                {viewMode === 'week'
                  ? `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
                  : format(currentMonth, 'MMMM yyyy')
                }
              </span>
              <button type="button" onClick={() => {
                setIsLoading(true);
                if (viewMode === 'week') setCurrentWeek(addWeeks(currentWeek, 1));
                else setCurrentMonth(addMonths(currentMonth, 1));
              }}
                className="relative p-2 hover:bg-neutral-800 rounded-lg transition-colors shrink-0" aria-label={viewMode === 'week' ? 'Next week' : 'Next month'} title={viewMode === 'week' ? 'Next week' : 'Next month'}>
                <ChevronRight className="w-5 h-5 text-neutral-400" />
                {adjacentHasData.next && <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />}
              </button>
              <button type="button" onClick={() => {
                setIsLoading(true);
                setCurrentWeek(new Date());
                setCurrentMonth(new Date());
              }}
                className="px-3 py-2 text-sm text-indigo-400 hover:bg-neutral-800 rounded-lg transition-colors font-medium shrink-0">
                Today
              </button>
            </div>
          </div>
        </div>
      </div>

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
                  onClick={() => setSelectedDate(isSameDay(selectedDate ?? new Date(0), day) ? null : day)}
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
                    {/* Add session button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedDate(day); setIsAdding(true); }}
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
                onClick={() => setSelectedDate(day)}
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
            <button onClick={() => { setSelectedDate(selectedDate); setIsAdding(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-accent-coaching text-white rounded-lg hover:bg-accent-coaching-hover transition-colors text-sm">
              <Plus className="w-4 h-4" />
              Add Session
            </button>
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
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
        </>
      )}
      {/* end viewMode === 'month' */}

      {/* Add Session Modal */}
      {isAdding && selectedDate && (
        <SessionForm
          title={`Add Session — ${format(selectedDate, 'EEE, MMM d')}`}
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
          assignments={assignments}
          onSave={handleEditSession}
          onCancel={() => setEditingSession(null)}
        />
      )}

      {/* Add Event Modal */}
      {isAddingEvent && selectedDate && (
        <EventForm
          title={`Add Event — ${format(selectedDate, 'EEE, MMM d')}`}
          defaultDate={format(selectedDate, 'yyyy-MM-dd')}
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

/* ─── Session Form ─────────────────────────────────────────────────────────── */

function SessionForm({
  title,
  session,
  assignments,
  onSave,
  onCancel,
}: {
  title: string;
  session?: CoachingSession;
  assignments?: GroupAssignment[];
  onSave: (data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'> & { group_assignment_id?: string | null }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<CoachingSession['type']>(session?.type ?? 'water');
  const [focus, setFocus] = useState(session?.focus ?? '');
  const [generalNotes, setGeneralNotes] = useState(session?.general_notes ?? '');
  const [assignmentId, setAssignmentId] = useState(session?.group_assignment_id ?? '');

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
            });
          }}
          className="space-y-4"
        >
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

  return (
    <div className={`flex items-center justify-between gap-2 px-5 py-2.5 ${style.bg} border-b border-border/50`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">{style.icon}</span>
        <span className={`text-sm font-semibold truncate ${style.text}`}>{event.title}</span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${style.bg} ${style.text} border border-current/20`}>
          {style.label}
        </span>
        {event.location && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-content-muted">
            <MapPin className="w-3 h-3" />
            {event.location}
          </span>
        )}
        {teamNames.length > 0 && (
          <span className="hidden sm:inline text-xs text-content-muted">
            · {teamNames.join(', ')}
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