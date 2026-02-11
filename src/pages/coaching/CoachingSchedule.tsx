import { useState, useEffect } from 'react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { parseLocalDate } from '../../utils/dateUtils';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import {
  getSessionsByDateRange,
  getAthletes,
  getNotesForSession,
  createSession,
  updateSession,
  deleteSession,
  createNote,
  updateNote,
  deleteNote,
  type CoachingSession,
  type CoachingAthlete,
  type CoachingAthleteNote,
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
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2, Loader2, ChevronDown, ChevronUp, MessageSquare, Calendar, CalendarDays } from 'lucide-react';

type ViewMode = 'week' | 'month';

export function CoachingSchedule() {
  const { userId, teamId, isLoadingTeam } = useCoachingContext();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSession, setEditingSession] = useState<CoachingSession | null>(null);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);
  const [notesVersion, setNotesVersion] = useState(0);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;
    let start: string, end: string;
    if (viewMode === 'week') {
      const ws = startOfWeek(currentWeek, { weekStartsOn: 0 });
      const we = endOfWeek(currentWeek, { weekStartsOn: 0 });
      start = format(ws, 'yyyy-MM-dd');
      end = format(we, 'yyyy-MM-dd');
    } else {
      start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    }
    Promise.all([
      getSessionsByDateRange(teamId, start, end),
      getAthletes(teamId),
    ])
      .then(([s, a]) => { setSessions(s); setAthletes(a); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions'))
      .finally(() => setIsLoading(false));
  }, [teamId, isLoadingTeam, viewMode, currentWeek, currentMonth]);

  const refreshSessions = async () => {
    if (!teamId) return;
    try {
      let start: string, end: string;
      if (viewMode === 'week') {
        const ws = startOfWeek(currentWeek, { weekStartsOn: 0 });
        const we = endOfWeek(currentWeek, { weekStartsOn: 0 });
        start = format(ws, 'yyyy-MM-dd');
        end = format(we, 'yyyy-MM-dd');
      } else {
        start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      }
      setSessions(await getSessionsByDateRange(teamId, start, end));
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

  const handleAddSession = async (data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'>) => {
    if (!selectedDate) return;
    await createSession(teamId, userId, {
      ...data,
      date: format(selectedDate, 'yyyy-MM-dd'),
    });
    setIsAdding(false);
    await refreshSessions();
  };

  const handleEditSession = async (data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'>) => {
    if (!editingSession) return;
    await updateSession(editingSession.id, data);
    setEditingSession(null);
    await refreshSessions();
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    await refreshSessions();
  };

  const handleAddNote = async (sessionId: string, athleteId: string, note: string) => {
    await createNote(teamId, userId, { session_id: sessionId, athlete_id: athleteId, note });
    setAddingNoteFor(null);
    setNotesVersion((v) => v + 1);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote(noteId);
    setNotesVersion((v) => v + 1);
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
            <div className="flex items-center gap-2">
              <button onClick={() => {
                setIsLoading(true);
                if (viewMode === 'week') setCurrentWeek(subWeeks(currentWeek, 1));
                else setCurrentMonth(subMonths(currentMonth, 1));
              }}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title={viewMode === 'week' ? 'Previous week' : 'Previous month'}>
                <ChevronLeft className="w-5 h-5 text-neutral-400" />
              </button>
              <span className="text-lg font-semibold min-w-[200px] text-center px-4 py-2 bg-neutral-800 rounded-lg text-white">
                {viewMode === 'week'
                  ? `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
                  : format(currentMonth, 'MMMM yyyy')
                }
              </span>
              <button onClick={() => {
                setIsLoading(true);
                if (viewMode === 'week') setCurrentWeek(addWeeks(currentWeek, 1));
                else setCurrentMonth(addMonths(currentMonth, 1));
              }}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title={viewMode === 'week' ? 'Next week' : 'Next month'}>
                <ChevronRight className="w-5 h-5 text-neutral-400" />
              </button>
              <button onClick={() => {
                setIsLoading(true);
                setCurrentWeek(new Date());
                setCurrentMonth(new Date());
              }}
                className="px-3 py-2 text-sm text-indigo-400 hover:bg-neutral-800 rounded-lg transition-colors font-medium">
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
          {weekDays.map((day) => {
            const daySessions = getSessionsForDay(day);
            const today = isDateToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayName = format(day, 'EEE');
            const dayDate = format(day, 'MMM d');

            return (
              <div
                key={day.toISOString()}
                className={`bg-neutral-900 border rounded-xl overflow-hidden transition-all ${
                  today ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' :
                  isSelected ? 'border-indigo-500/30' :
                  'border-neutral-800'
                }`}
              >
                {/* Day header row */}
                <div
                  className={`flex items-center justify-between px-5 py-3 cursor-pointer ${
                    today ? 'bg-indigo-500/5' : 'hover:bg-neutral-800/50'
                  }`}
                  onClick={() => setSelectedDate(isSameDay(selectedDate ?? new Date(0), day) ? null : day)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-bold w-10 ${today ? 'text-indigo-400' : 'text-neutral-500'}`}>
                      {dayName}
                    </div>
                    <div className={`text-base font-semibold ${today ? 'text-white' : 'text-neutral-300'}`}>
                      {dayDate}
                    </div>
                    {today && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-600 text-white rounded-full">Today</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {daySessions.length > 0 && (
                      <span className="text-xs text-neutral-500 font-medium">
                        {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedDate(day); setIsAdding(true); }}
                      className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
                      title="Add session"
                    >
                      <Plus className="w-4 h-4 text-neutral-500 hover:text-indigo-400" />
                    </button>
                  </div>
                </div>

                {/* Sessions for this day */}
                {daySessions.length > 0 && (
                  <div className="border-t border-neutral-800 px-5 py-3 space-y-2">
                    {daySessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        athletes={athletes}
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
                {daySessions.length === 0 && (
                  <div className="border-t border-neutral-800/50 px-5 py-2">
                    <p className="text-xs text-neutral-600 italic">No sessions</p>
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
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-semibold text-white">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for padding */}
          {Array.from({ length: days[0].getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2 min-h-[90px] bg-neutral-800/50" />
          ))}

          {days.map((day) => {
            const daySessions = getSessionsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <div
                key={day.toISOString()}
                className={`p-2 min-h-[90px] border-r border-b border-neutral-800 cursor-pointer hover:bg-indigo-500/5 transition-all ${
                  isSelected ? 'bg-indigo-500/10 ring-2 ring-indigo-500 ring-inset' : ''
                } ${!isSameMonth(day, currentMonth) ? 'bg-neutral-800/50' : ''}`}
                onClick={() => setSelectedDate(day)}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    isToday
                      ? 'w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center'
                      : 'text-neutral-400'
                  }`}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {daySessions.slice(0, 2).map((session) => (
                    <div
                      key={session.id}
                      className={`text-xs px-1.5 py-0.5 rounded-md truncate font-medium ${
                        session.type === 'water' ? 'bg-blue-900/30 text-blue-400' :
                        session.type === 'erg' ? 'bg-amber-900/30 text-amber-400' :
                        session.type === 'land' ? 'bg-green-900/30 text-green-400' :
                        'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {session.focus || session.type}
                    </div>
                  ))}
                  {daySessions.length > 2 && (
                    <div className="text-xs text-neutral-500 font-medium">
                      +{daySessions.length - 2} more
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
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            <button onClick={() => { setSelectedDate(selectedDate); setIsAdding(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm">
              <Plus className="w-4 h-4" />
              Add Session
            </button>
          </div>

          {selectedDaySessions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-800 flex items-center justify-center">
                <Plus className="w-6 h-6 text-neutral-500" />
              </div>
              <p className="text-neutral-500">No sessions scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDaySessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  athletes={athletes}
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
        </div>
      )}
        </>
      )}
      {/* end viewMode === 'month' */}

      {/* Add Session Modal */}
      {isAdding && selectedDate && (
        <SessionForm
          title={`Add Session — ${format(selectedDate, 'EEE, MMM d')}`}
          onSave={handleAddSession}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <SessionForm
          title="Edit Session"
          session={editingSession}
          onSave={handleEditSession}
          onCancel={() => setEditingSession(null)}
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
  onSave,
  onCancel,
}: {
  title: string;
  session?: CoachingSession;
  onSave: (data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'>) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<CoachingSession['type']>(session?.type ?? 'water');
  const [focus, setFocus] = useState(session?.focus ?? '');
  const [generalNotes, setGeneralNotes] = useState(session?.general_notes ?? '');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ type, focus: focus || undefined, general_notes: generalNotes || undefined });
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
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" title="Edit session">
            <Edit2 className="w-4 h-4 text-neutral-500 hover:text-indigo-400" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" title="Delete session">
            <Trash2 className="w-4 h-4 text-neutral-500 hover:text-red-400" />
          </button>
          <button onClick={onToggle}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" title="Toggle notes">
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
                          className="p-1 hover:bg-neutral-700 rounded-lg transition-colors" title="Edit note">
                          <Edit2 className="w-3.5 h-3.5 text-neutral-500 hover:text-indigo-400" />
                        </button>
                        <button onClick={() => onDeleteNote(note.id)}
                          className="p-1 hover:bg-neutral-700 rounded-lg transition-colors" title="Delete note">
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
        <button onClick={onCancel} className="p-2 hover:bg-neutral-700 rounded-lg transition-colors" title="Cancel">
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