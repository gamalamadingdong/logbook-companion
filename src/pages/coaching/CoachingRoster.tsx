import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAthletes,
  createAthlete,
  updateAthlete,
  deleteAthlete,
  getErgScoresForAthlete,
  getNotesForAthlete,
  type CoachingAthlete,
  type CoachingErgScore,
  type CoachingAthleteNote,
  type CoachingSession,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, X, ChevronRight, Loader2, AlertTriangle, MessageSquare } from 'lucide-react';
import { CoachingNav } from '../../components/coaching/CoachingNav';

export function CoachingRoster() {
  const { user } = useAuth();
  const coachId = user?.id ?? '';

  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<CoachingAthlete | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<CoachingAthlete | null>(null);
  const [deletingAthlete, setDeletingAthlete] = useState<CoachingAthlete | null>(null);

  useEffect(() => {
    if (!coachId) return;
    getAthletes(coachId)
      .then(setAthletes)
      .catch((err) => setError(err.message ?? 'Failed to load athletes'))
      .finally(() => setIsLoading(false));
  }, [coachId]);

  const refreshAthletes = async () => {
    if (coachId) {
      try {
        setAthletes(await getAthletes(coachId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh');
      }
    }
  };

  const handleSave = async (data: Partial<CoachingAthlete>) => {
    if (isEditing?.id) {
      await updateAthlete(isEditing.id, data);
    } else {
      await createAthlete(coachId, data as Pick<CoachingAthlete, 'name' | 'grade' | 'experience_level' | 'side' | 'notes'>);
    }
    setIsEditing(null);
    setIsAdding(false);
    await refreshAthletes();
  };

  const handleDelete = async (id: string) => {
    await deleteAthlete(id);
    setSelectedAthlete(null);
    setDeletingAthlete(null);
    await refreshAthletes();
  };

  return (
    <>
    <CoachingNav />
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Roster</h1>
            <p className="text-neutral-400 mt-1">
              {athletes.length} athlete{athletes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Athlete
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => { setError(null); refreshAthletes(); }} className="ml-3 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {/* Athlete Grid */}
      {!isLoading && !error && (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {athletes.map((athlete) => (
          <div
            key={athlete.id}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 cursor-pointer hover:border-indigo-500/50 transition-all group"
            onClick={() => setSelectedAthlete(athlete)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                  {athlete.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                    {athlete.name}
                  </h3>
                  <p className="text-sm text-neutral-500">
                    {athlete.grade && `Grade ${athlete.grade}`}
                    {athlete.grade && athlete.side && ' · '}
                    {athlete.side &&
                      `${athlete.side.charAt(0).toUpperCase() + athlete.side.slice(1)}`}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
            {athlete.experience_level && (
              <span
                className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-medium ${
                  athlete.experience_level === 'novice'
                    ? 'bg-green-900/30 text-green-400'
                    : athlete.experience_level === 'freshman'
                    ? 'bg-amber-900/30 text-amber-400'
                    : athlete.experience_level === 'jv'
                    ? 'bg-purple-900/30 text-purple-400'
                    : 'bg-blue-900/30 text-blue-400'
                }`}
              >
                {athlete.experience_level.toUpperCase()}
              </span>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && athletes.length === 0 && !isAdding && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Plus className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-neutral-400 mb-4">No athletes added yet</p>
          <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
            Add your first athlete
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAdding || isEditing) && (
        <AthleteForm
          athlete={isEditing}
          onSave={handleSave}
          onCancel={() => { setIsAdding(false); setIsEditing(null); }}
        />
      )}

      {/* Detail Sidebar */}
      {selectedAthlete && (
        <AthleteDetail
          athlete={selectedAthlete}
          onClose={() => setSelectedAthlete(null)}
          onEdit={() => { setIsEditing(selectedAthlete); setSelectedAthlete(null); }}
          onDelete={() => setDeletingAthlete(selectedAthlete)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingAthlete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Delete Athlete</h2>
            </div>
            <p className="text-neutral-300 mb-1">
              Are you sure you want to delete <span className="font-semibold text-white">{deletingAthlete.name}</span>?
            </p>
            <p className="text-neutral-500 text-sm mb-6">
              This will also delete their notes and erg scores. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingAthlete(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingAthlete.id)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

/* ─── Athlete Form ─────────────────────────────────────────────────────────── */

function AthleteForm({
  athlete,
  onSave,
  onCancel,
}: {
  athlete: CoachingAthlete | null;
  onSave: (data: Partial<CoachingAthlete>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(athlete?.name ?? '');
  const [grade, setGrade] = useState(athlete?.grade ?? '');
  const [experienceLevel, setExperienceLevel] = useState<CoachingAthlete['experience_level']>(
    athlete?.experience_level ?? 'novice'
  );
  const [side, setSide] = useState<CoachingAthlete['side']>(athlete?.side ?? 'both');
  const [notes, setNotes] = useState(athlete?.notes ?? '');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{athlete ? 'Edit' : 'Add'} Athlete</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ name, grade: grade || undefined, experience_level: experienceLevel, side, notes: notes || undefined });
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="athlete-name" className="block text-sm font-medium text-neutral-300 mb-1">Name *</label>
            <input id="athlete-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="athlete-grade" className="block text-sm font-medium text-neutral-300 mb-1">Grade</label>
              <input id="athlete-grade" type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="8"
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label htmlFor="athlete-side" className="block text-sm font-medium text-neutral-300 mb-1">Side</label>
              <select id="athlete-side" value={side} onChange={(e) => setSide(e.target.value as CoachingAthlete['side'])}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                <option value="both">Both</option>
                <option value="port">Port</option>
                <option value="starboard">Starboard</option>
                <option value="coxswain">Coxswain</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="athlete-experience" className="block text-sm font-medium text-neutral-300 mb-1">Experience Level</label>
            <select id="athlete-experience" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as CoachingAthlete['experience_level'])}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
              <option value="novice">Novice</option>
              <option value="freshman">Freshman</option>
              <option value="jv">JV</option>
              <option value="varsity">Varsity</option>
            </select>
          </div>

          <div>
            <label htmlFor="athlete-notes" className="block text-sm font-medium text-neutral-300 mb-1">Notes</label>
            <textarea id="athlete-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              placeholder="Any notes about this athlete..." />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Athlete Detail ───────────────────────────────────────────────────────── */

function AthleteDetail({
  athlete,
  onClose,
  onEdit,
  onDelete,
}: {
  athlete: CoachingAthlete;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [ergScores, setErgScores] = useState<CoachingErgScore[]>([]);
  const [athleteNotes, setAthleteNotes] = useState<(CoachingAthleteNote & { session?: CoachingSession })[]>([]);

  useEffect(() => {
    getErgScoresForAthlete(athlete.id, 5).then(setErgScores).catch(console.error);
    getNotesForAthlete(athlete.id, 20).then(setAthleteNotes).catch(console.error);
  }, [athlete.id]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-t-2xl md:rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
              {athlete.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-bold text-white">{athlete.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {athlete.grade && (
              <span className="px-3 py-1.5 bg-neutral-800 rounded-full text-sm font-medium text-neutral-300">Grade {athlete.grade}</span>
            )}
            {athlete.side && (
              <span className="px-3 py-1.5 bg-neutral-800 rounded-full text-sm font-medium text-neutral-300 capitalize">{athlete.side}</span>
            )}
            {athlete.experience_level && (
              <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                athlete.experience_level === 'novice' ? 'bg-green-900/30 text-green-400' :
                athlete.experience_level === 'freshman' ? 'bg-amber-900/30 text-amber-400' :
                athlete.experience_level === 'jv' ? 'bg-purple-900/30 text-purple-400' :
                'bg-blue-900/30 text-blue-400'
              }`}>
                {athlete.experience_level.toUpperCase()}
              </span>
            )}
          </div>

          {athlete.notes && (
            <div className="p-4 bg-neutral-800/50 rounded-xl">
              <h3 className="font-medium mb-2 text-sm text-neutral-500 uppercase tracking-wide">Notes</h3>
              <p className="text-neutral-300">{athlete.notes}</p>
            </div>
          )}

          {ergScores.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 text-sm text-neutral-500 uppercase tracking-wide">Recent Erg Scores</h3>
              <div className="space-y-2">
                {ergScores.map((score) => (
                  <div key={score.id} className="flex items-center justify-between p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
                    <span className="font-semibold text-neutral-300">{score.distance}m</span>
                    <span className="text-indigo-400 font-mono">{formatTime(score.time_seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {athleteNotes.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 text-sm text-neutral-500 uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Session Notes ({athleteNotes.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {athleteNotes.map((n) => (
                  <div key={n.id} className="p-3 bg-neutral-800/60 border border-neutral-700/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      {n.session && (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          n.session.type === 'water' ? 'bg-blue-900/30 text-blue-400' :
                          n.session.type === 'erg' ? 'bg-amber-900/30 text-amber-400' :
                          n.session.type === 'land' ? 'bg-green-900/30 text-green-400' :
                          'bg-neutral-700 text-neutral-300'
                        }`}>
                          {n.session.type.toUpperCase()}
                        </span>
                      )}
                      <span className="text-xs text-neutral-500">
                        {format(new Date(n.created_at), 'MMM d, yyyy')}
                      </span>
                      {n.session?.focus && (
                        <span className="text-xs text-indigo-400">· {n.session.focus}</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-300">{n.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-neutral-800">
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-colors font-medium">
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors font-medium">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
