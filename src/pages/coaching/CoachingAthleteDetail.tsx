import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import {
  getAthletes,
  getErgScoresForAthlete,
  getNotesForAthlete,
  updateAthlete,
  deleteAthlete,
  type CoachingAthlete,
  type CoachingErgScore,
  type CoachingAthleteNote,
  type CoachingSession,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { ChevronLeft, Edit2, Trash2, Loader2, AlertTriangle, MessageSquare, X } from 'lucide-react';

export function CoachingAthleteDetail() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const navigate = useNavigate();
  const { teamId, isLoadingTeam } = useCoachingContext();

  const [athlete, setAthlete] = useState<CoachingAthlete | null>(null);
  const [ergScores, setErgScores] = useState<CoachingErgScore[]>([]);
  const [athleteNotes, setAthleteNotes] = useState<(CoachingAthleteNote & { session?: CoachingSession })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!teamId || !athleteId || isLoadingTeam) return;
    getAthletes(teamId)
      .then((athletes) => {
        const found = athletes.find((a) => a.id === athleteId);
        if (found) {
          setAthlete(found);
          return Promise.all([
            getErgScoresForAthlete(athleteId, 10),
            getNotesForAthlete(athleteId, 30),
          ]);
        }
        setError('Athlete not found');
        return null;
      })
      .then((results) => {
        if (results) {
          setErgScores(results[0]);
          setAthleteNotes(results[1]);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load athlete'))
      .finally(() => setIsLoading(false));
  }, [teamId, athleteId, isLoadingTeam]);

  const handleSave = async (data: Partial<CoachingAthlete>) => {
    if (!athleteId) return;
    await updateAthlete(athleteId, {
      first_name: data.first_name,
      last_name: data.last_name,
      grade: data.grade,
      experience_level: data.experience_level,
      side: data.side,
      notes: data.notes,
    });
    setIsEditing(false);
    // Refresh
    const athletes = await getAthletes(teamId);
    const updated = athletes.find((a) => a.id === athleteId);
    if (updated) setAthlete(updated);
  };

  const handleDelete = async () => {
    if (!athleteId) return;
    await deleteAthlete(athleteId);
    navigate('/coaching/roster');
  };

  if (isLoading) {
    return (
      <>
        <CoachingNav />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      </>
    );
  }

  if (error || !athlete) {
    return (
      <>
        <CoachingNav />
        <div className="p-6 max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-6 text-center">
            <p className="text-red-400">{error ?? 'Athlete not found'}</p>
            <button onClick={() => navigate('/coaching/roster')}
              className="mt-4 px-4 py-2 bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors">
              Back to Roster
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CoachingNav />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Back link */}
        <button
          onClick={() => navigate('/coaching/roster')}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-indigo-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Roster
        </button>

        {/* Header */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                {athlete.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{athlete.name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {athlete.grade && (
                    <span className="px-3 py-1 bg-neutral-800 rounded-full text-sm font-medium text-neutral-300">Grade {athlete.grade}</span>
                  )}
                  {athlete.side && (
                    <span className="px-3 py-1 bg-neutral-800 rounded-full text-sm font-medium text-neutral-300 capitalize">{athlete.side}</span>
                  )}
                  {athlete.experience_level && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      athlete.experience_level === 'novice' ? 'bg-green-900/30 text-green-400' :
                      athlete.experience_level === 'freshman' ? 'bg-amber-900/30 text-amber-400' :
                      athlete.experience_level === 'jv' ? 'bg-purple-900/30 text-purple-400' :
                      'bg-blue-900/30 text-blue-400'
                    }`}>
                      {athlete.experience_level.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-colors font-medium">
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors font-medium">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>

          {athlete.notes && (
            <div className="mt-4 p-4 bg-neutral-800/50 rounded-xl">
              <h3 className="font-medium mb-2 text-sm text-neutral-500 uppercase tracking-wide">Notes</h3>
              <p className="text-neutral-300">{athlete.notes}</p>
            </div>
          )}
        </div>

        {/* Erg Scores */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            Recent Erg Scores
            {ergScores.length > 0 && (
              <span className="text-sm text-neutral-500 font-normal">({ergScores.length})</span>
            )}
          </h2>
          {ergScores.length === 0 ? (
            <p className="text-neutral-500 text-sm">No erg scores recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {ergScores.map((score) => (
                <div key={score.id} className="flex items-center justify-between p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-neutral-300">{score.distance}m</span>
                    <span className="text-xs text-neutral-500">
                      {format(new Date(score.date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <span className="text-indigo-400 font-mono">{formatTime(score.time_seconds)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Notes */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Session Notes
            {athleteNotes.length > 0 && (
              <span className="text-sm text-neutral-500 font-normal">({athleteNotes.length})</span>
            )}
          </h2>
          {athleteNotes.length === 0 ? (
            <p className="text-neutral-500 text-sm">No session notes yet.</p>
          ) : (
            <div className="space-y-2">
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
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <AthleteEditForm
          athlete={athlete}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Delete Athlete</h2>
            </div>
            <p className="text-neutral-300 mb-1">
              Are you sure you want to delete <span className="font-semibold text-white">{athlete.name}</span>?
            </p>
            <p className="text-neutral-500 text-sm mb-6">
              This will also delete their notes and erg scores. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Athlete Edit Form ────────────────────────────────────────────────────── */

function AthleteEditForm({
  athlete,
  onSave,
  onCancel,
}: {
  athlete: CoachingAthlete;
  onSave: (data: Partial<CoachingAthlete>) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(athlete.first_name);
  const [lastName, setLastName] = useState(athlete.last_name);
  const [grade, setGrade] = useState(athlete.grade ?? '');
  const [experienceLevel, setExperienceLevel] = useState<CoachingAthlete['experience_level']>(
    athlete.experience_level ?? 'novice'
  );
  const [side, setSide] = useState<CoachingAthlete['side']>(athlete.side ?? 'both');
  const [notes, setNotes] = useState(athlete.notes ?? '');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Edit Athlete</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ first_name: firstName, last_name: lastName, grade: grade || undefined, experience_level: experienceLevel, side, notes: notes || undefined } as Partial<CoachingAthlete>);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="athlete-first-name" className="block text-sm font-medium text-neutral-300 mb-1">First Name *</label>
              <input id="athlete-first-name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label htmlFor="athlete-last-name" className="block text-sm font-medium text-neutral-300 mb-1">Last Name</label>
              <input id="athlete-last-name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
