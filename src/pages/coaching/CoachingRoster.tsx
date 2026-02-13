import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import {
  getAthletes,
  createAthlete,
  updateAthlete,
  updateAthleteSquad,
  deleteAthlete,
  type CoachingAthlete,
} from '../../services/coaching/coachingService';
import { Plus, Edit2, Trash2, X, ChevronRight, Loader2, AlertTriangle, Filter } from 'lucide-react';
import { CoachingNav } from '../../components/coaching/CoachingNav';

export function CoachingRoster() {
  const { userId, teamId, isLoadingTeam, teamError } = useCoachingContext();
  const navigate = useNavigate();

  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<CoachingAthlete | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingAthlete, setDeletingAthlete] = useState<CoachingAthlete | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string | 'all'>('all');

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;
    getAthletes(teamId)
      .then(setAthletes)
      .catch((err) => setError(err.message ?? 'Failed to load athletes'))
      .finally(() => setIsLoading(false));
  }, [teamId, isLoadingTeam]);

  const refreshAthletes = async () => {
    if (teamId) {
      try {
        setAthletes(await getAthletes(teamId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh');
      }
    }
  };

  const handleSave = async (data: Partial<CoachingAthlete> & { squad?: string }) => {
    if (isEditing?.id) {
      await updateAthlete(isEditing.id, {
        first_name: data.first_name,
        last_name: data.last_name,
        grade: data.grade,
        experience_level: data.experience_level,
        side: data.side,
        notes: data.notes,
      });
      // Update squad on the junction table
      if (data.squad !== isEditing.squad) {
        await updateAthleteSquad(teamId, isEditing.id, data.squad || null);
      }
    } else {
      await createAthlete(teamId, userId, {
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        grade: data.grade,
        experience_level: data.experience_level,
        side: data.side,
        notes: data.notes,
      }, data.squad || null);
    }
    setIsEditing(null);
    setIsAdding(false);
    await refreshAthletes();
  };

  const handleDelete = async (id: string) => {
    await deleteAthlete(id);
    setDeletingAthlete(null);
    await refreshAthletes();
  };

  // Derived: distinct squad names + filtered list
  const squads = [...new Set(athletes.map((a) => a.squad).filter((s): s is string => !!s))].sort();
  const filteredAthletes = selectedSquad === 'all' ? athletes : athletes.filter((a) => a.squad === selectedSquad);

  return (
    <>
    <CoachingNav />
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Roster</h1>
            <p className="text-neutral-400 mt-1">
              {filteredAthletes.length}{selectedSquad !== 'all' ? ` in ${selectedSquad}` : ''} athlete{filteredAthletes.length !== 1 ? 's' : ''}{selectedSquad !== 'all' ? ` (${athletes.length} total)` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {squads.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-neutral-500" />
                <select
                  value={selectedSquad}
                  onChange={(e) => setSelectedSquad(e.target.value)}
                  className="px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  aria-label="Filter by squad"
                >
                  <option value="all">All Squads</option>
                  {squads.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Athlete
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* Error */}
      {(error || teamError) && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
          {error || teamError}
          {error && <button onClick={() => { setError(null); refreshAthletes(); }} className="ml-3 underline hover:text-red-300">Retry</button>}
        </div>
      )}

      {/* Athlete List (vertical) */}
      {!isLoading && !error && (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
        {filteredAthletes.map((athlete) => (
          <div
            key={athlete.id}
            className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-neutral-800/50 transition-colors group"
            onClick={() => navigate(`/coaching/roster/${athlete.id}`)}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold shrink-0">
                {athlete.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                  {athlete.name}
                </h3>
                <p className="text-sm text-neutral-500 truncate">
                  {athlete.grade && `Grade ${athlete.grade}`}
                  {athlete.grade && athlete.side && ' · '}
                  {athlete.side &&
                    `${athlete.side.charAt(0).toUpperCase() + athlete.side.slice(1)}`}
                </p>
              </div>
              {athlete.experience_level && (
                <span
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
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
              {athlete.squad && (
                <span className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-cyan-900/30 text-cyan-400">
                  {athlete.squad}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(athlete); }}
                className="p-2 hover:bg-neutral-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Edit athlete"
              >
                <Edit2 className="w-4 h-4 text-neutral-500 hover:text-indigo-400" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeletingAthlete(athlete); }}
                className="p-2 hover:bg-neutral-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Delete athlete"
              >
                <Trash2 className="w-4 h-4 text-neutral-500 hover:text-red-400" />
              </button>
              <ChevronRight className="w-5 h-5 text-neutral-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredAthletes.length === 0 && !isAdding && (
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
          squads={squads}
          onSave={handleSave}
          onCancel={() => { setIsAdding(false); setIsEditing(null); }}
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
  squads,
  onSave,
  onCancel,
}: {
  athlete: CoachingAthlete | null;
  squads: string[];
  onSave: (data: Partial<CoachingAthlete> & { squad?: string }) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(athlete?.first_name ?? '');
  const [lastName, setLastName] = useState(athlete?.last_name ?? '');
  const [grade, setGrade] = useState(athlete?.grade ?? '');
  const [experienceLevel, setExperienceLevel] = useState<CoachingAthlete['experience_level']>(
    athlete?.experience_level ?? 'novice'
  );
  const [side, setSide] = useState<CoachingAthlete['side']>(athlete?.side ?? 'both');
  const [squad, setSquad] = useState(athlete?.squad ?? '');
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
            onSave({ first_name: firstName, last_name: lastName, grade: grade || undefined, experience_level: experienceLevel, side, squad: squad || undefined, notes: notes || undefined } as Partial<CoachingAthlete> & { squad?: string });
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
            <label htmlFor="athlete-squad" className="block text-sm font-medium text-neutral-300 mb-1">Squad</label>
            <input id="athlete-squad" type="text" list="squad-options" value={squad} onChange={(e) => setSquad(e.target.value)}
              placeholder="e.g. Novice Boys, JV, Varsity"
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            {squads.length > 0 && (
              <datalist id="squad-options">
                {squads.map((s) => <option key={s} value={s} />)}
              </datalist>
            )}
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
