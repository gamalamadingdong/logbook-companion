import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { parseLocalDate } from '../../utils/dateUtils';
import {
  getSessions,
  getAthletes,
  getNotesForSession,
  createNote,
  updateNote,
  deleteNote,
  type CoachingSession,
  type CoachingAthlete,
  type CoachingAthleteNote,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { Plus, ChevronDown, ChevronUp, X, MessageSquare, Edit2, Trash2, Loader2 } from 'lucide-react';

export function CoachingLog() {
  const { user } = useAuth();
  const coachId = user?.id ?? '';
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesVersion, setNotesVersion] = useState(0);

  useEffect(() => {
    if (!coachId) return;
    Promise.all([getSessions(coachId), getAthletes(coachId)])
      .then(([s, a]) => {
        setSessions(s);
        setAthletes(a);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [coachId]);

  const handleAddNote = async (sessionId: string, athleteId: string, note: string) => {
    await createNote(coachId, { session_id: sessionId, athlete_id: athleteId, note });
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Training Log</h1>
          <p className="text-neutral-400 mt-1">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-neutral-400 mb-4">No training sessions recorded</p>
          <p className="text-sm text-neutral-500">
            Add sessions from the{' '}
            <a href="/coaching/schedule" className="text-indigo-400 hover:underline font-medium">Schedule</a> page
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
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
              notesVersion={notesVersion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Session Card ─────────────────────────────────────────────────────────── */

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
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-xl flex flex-col items-center justify-center text-white shadow-md">
            <div className="text-xl font-bold leading-none">{format(parseLocalDate(session.date), 'd')}</div>
            <div className="text-xs opacity-80">{format(parseLocalDate(session.date), 'MMM')}</div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                session.type === 'water' ? 'bg-blue-900/30 text-blue-400' :
                session.type === 'erg' ? 'bg-amber-900/30 text-amber-400' :
                session.type === 'land' ? 'bg-green-900/30 text-green-400' :
                'bg-neutral-700 text-neutral-300'
              }`}>
                {session.type.toUpperCase()}
              </span>
              {session.focus && <span className="font-semibold text-indigo-400">{session.focus}</span>}
            </div>
            {session.general_notes && (
              <p className="text-sm text-neutral-500 mt-1 line-clamp-1">{session.general_notes}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {notes.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 rounded-full text-sm text-indigo-400 font-medium">
              <MessageSquare className="w-4 h-4" />
              {notes.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-indigo-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-neutral-500" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-neutral-800 p-4 space-y-4 bg-neutral-800/30">
          {/* General Notes */}
          {session.general_notes && (
            <div>
              <h4 className="text-sm font-medium text-neutral-500 mb-2 uppercase tracking-wide">Session Notes</h4>
              <p className="text-sm bg-neutral-800 p-4 rounded-xl border border-neutral-700 text-neutral-300">
                {session.general_notes}
              </p>
            </div>
          )}

          {/* Athlete Notes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">Athlete Notes</h4>
            </div>

            {notes.length > 0 && (
              <div className="space-y-2 mb-4">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-3 p-4 bg-neutral-800 rounded-xl border border-neutral-700">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
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

            {/* Add Note Button/Form */}
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
    <div className="p-4 bg-neutral-800 rounded-xl border border-neutral-700 space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={selectedAthleteId}
          onChange={(e) => setSelectedAthleteId(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
        className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
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
