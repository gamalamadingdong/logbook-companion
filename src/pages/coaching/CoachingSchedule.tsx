import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getSessionsByDateRange,
  createSession,
  updateSession,
  deleteSession,
  type CoachingSession,
} from '../../services/coaching/coachingService';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2, Loader2 } from 'lucide-react';

export function CoachingSchedule() {
  const { user } = useAuth();
  const coachId = user?.id ?? '';
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSession, setEditingSession] = useState<CoachingSession | null>(null);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coachId) return;
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    getSessionsByDateRange(coachId, start, end)
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions'))
      .finally(() => setIsLoading(false));
  }, [coachId, currentMonth]);

  const refreshSessions = async () => {
    if (!coachId) return;
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      setSessions(await getSessionsByDateRange(coachId, start, end));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    }
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getSessionsForDay = (date: Date) =>
    sessions.filter((s) => isSameDay(new Date(s.date), date));

  const handleAddSession = async (data: Pick<CoachingSession, 'type' | 'focus' | 'general_notes'>) => {
    if (!selectedDate) return;
    await createSession(coachId, {
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

  const selectedDaySessions = selectedDate
    ? sessions.filter((s) => isSameDay(new Date(s.date), selectedDate))
    : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => { setIsLoading(true); setCurrentMonth(subMonths(currentMonth, 1)); }}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Previous month">
              <ChevronLeft className="w-5 h-5 text-neutral-400" />
            </button>
            <span className="text-lg font-semibold min-w-[160px] text-center px-4 py-2 bg-neutral-800 rounded-lg text-white">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button onClick={() => { setIsLoading(true); setCurrentMonth(addMonths(currentMonth, 1)); }}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Next month">
              <ChevronRight className="w-5 h-5 text-neutral-400" />
            </button>
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
      {/* Calendar Grid */}
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
            <button onClick={() => setIsAdding(true)}
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
                <div key={session.id} className="p-4 bg-neutral-800/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        session.type === 'water' ? 'bg-blue-900/30 text-blue-400' :
                        session.type === 'erg' ? 'bg-amber-900/30 text-amber-400' :
                        session.type === 'land' ? 'bg-green-900/30 text-green-400' :
                        'bg-neutral-700 text-neutral-300'
                      }`}>
                        {session.type.toUpperCase()}
                      </span>
                      {session.focus && (
                        <span className="text-sm font-semibold text-indigo-400">{session.focus}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingSession(session)}
                        className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" title="Edit session">
                        <Edit2 className="w-4 h-4 text-neutral-500 hover:text-indigo-400" />
                      </button>
                      <button onClick={() => handleDeleteSession(session.id)}
                        className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" title="Delete session">
                        <Trash2 className="w-4 h-4 text-neutral-500 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  {session.general_notes && (
                    <p className="text-sm text-neutral-400">{session.general_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Session Modal */}
      {isAdding && selectedDate && (
        <SessionForm
          title={`Add Session — ${format(selectedDate, 'MMM d')}`}
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
