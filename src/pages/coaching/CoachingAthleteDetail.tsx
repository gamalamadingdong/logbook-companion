import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import {
  getAthletes,
  getErgScoresForAthlete,
  getNotesForAthlete,
  getAssignmentsForAthlete,
  markAssignmentAsTest,
  deleteErgScore,
  updateAthlete,
  updateAthleteSquad,
  deleteAthlete,
  type CoachingAthlete,
  type CoachingErgScore,
  type CoachingAthleteNote,
  type CoachingSession,
  type AthleteAssignment,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { ChevronLeft, Edit2, Trash2, Loader2, AlertTriangle, MessageSquare, ClipboardList, CheckCircle2, Circle, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { formatSplit, calculateWattsFromSplit } from '../../utils/paceCalculator';
import { formatHeight, formatWeight } from '../../utils/unitConversion';
import { ErgScoreProgressionChart } from '../../components/coaching/ErgScoreProgressionChart';
import { TrainingZoneDonut } from '../../components/coaching/TrainingZoneDonut';
import { AthleteTrainingZones } from '../../components/coaching/AthleteTrainingZones';
import { AthleteEditorModal } from '../../components/coaching/AthleteEditorModal';

export function CoachingAthleteDetail() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const navigate = useNavigate();
  const { teamId, userId, isLoadingTeam } = useCoachingContext();

  const [athlete, setAthlete] = useState<CoachingAthlete | null>(null);
  const [allAthletes, setAllAthletes] = useState<CoachingAthlete[]>([]);
  const [ergScores, setErgScores] = useState<CoachingErgScore[]>([]);
  const [athleteNotes, setAthleteNotes] = useState<(CoachingAthleteNote & { session?: CoachingSession })[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<AthleteAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!teamId || !athleteId || isLoadingTeam) return;
    
    const loadData = async () => {
      try {
        const athletes = await getAthletes(teamId);
        setAllAthletes(athletes);
        const found = athletes.find((a) => a.id === athleteId);
        if (found) {
          setAthlete(found);
          const [scores, notes, assignments] = await Promise.all([
            getErgScoresForAthlete(athleteId, 50),
            getNotesForAthlete(athleteId, 30),
            getAssignmentsForAthlete(athleteId, 100),
          ]);
          setErgScores(scores);
          setAthleteNotes(notes);
          setAssignmentHistory(assignments);
        } else {
          setError('Athlete not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load athlete');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [teamId, athleteId, isLoadingTeam]);

  const handleSave = async (data: Partial<CoachingAthlete> & { squad?: string }) => {
    if (!athleteId) return;
    await updateAthlete(athleteId, {
      first_name: data.first_name,
      last_name: data.last_name,
      grade: data.grade,
      experience_level: data.experience_level,
      side: data.side,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      notes: data.notes,
    });
    // Update squad on the junction table
    if (data.squad !== athlete?.squad) {
      await updateAthleteSquad(teamId, athleteId, data.squad || null);
    }
    setIsEditing(false);
    // Refresh
    const athletes = await getAthletes(teamId);
    setAllAthletes(athletes);
    const updated = athletes.find((a) => a.id === athleteId);
    if (updated) setAthlete(updated);
  };

  const handleDelete = async () => {
    if (!athleteId) return;
    await deleteAthlete(athleteId);
    navigate('/team-management/roster');
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
            <button onClick={() => navigate('/team-management/roster')}
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
          onClick={() => navigate('/team-management/roster')}
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
                      athlete.experience_level === 'beginner' ? 'bg-green-900/30 text-green-400' :
                      athlete.experience_level === 'intermediate' ? 'bg-amber-900/30 text-amber-400' :
                      athlete.experience_level === 'experienced' ? 'bg-purple-900/30 text-purple-400' :
                      'bg-blue-900/30 text-blue-400'
                    }`}>
                      {athlete.experience_level.charAt(0).toUpperCase() + athlete.experience_level.slice(1)}
                    </span>
                  )}
                  {athlete.squad && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-cyan-900/30 text-cyan-400">
                      {athlete.squad}
                    </span>
                  )}
                </div>
                {(athlete.height_cm || athlete.weight_kg) && (
                  <div className="flex gap-3 mt-2 text-sm text-neutral-400">
                    {athlete.height_cm != null && (
                      <span>{formatHeight(athlete.height_cm)}</span>
                    )}
                    {athlete.weight_kg != null && (
                      <span>{formatWeight(athlete.weight_kg)}</span>
                    )}
                  </div>
                )}
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

        {/* Erg Score Progression */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          {ergScores.length >= 2 ? (
            <ErgScoreProgressionChart scores={ergScores} />
          ) : ergScores.length === 1 ? (
            <div>
              <h3 className="text-sm font-medium text-neutral-400 mb-3">Erg Score Progression</h3>
              <p className="text-neutral-500 text-sm">
                1 erg score recorded ({ergScores[0].distance}m — {formatTime(ergScores[0].time_seconds)}).
                Mark another test to see the progression chart.
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-medium text-neutral-400 mb-3">Erg Score Progression</h3>
              <p className="text-neutral-500 text-sm">No erg scores recorded yet. Mark an assignment as a test to start tracking.</p>
            </div>
          )}
        </div>

        {/* Training Zone Distribution */}
        {assignmentHistory.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <TrainingZoneDonut zones={assignmentHistory.map(a => a.training_zone)} />
          </div>
        )}

        {/* Training Zones (from 2k baseline) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <AthleteTrainingZones ergScores={ergScores} />
        </div>

        {/* Assignment History */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Assignment History
            {assignmentHistory.length > 0 && (
              <span className="text-sm text-neutral-500 font-normal">({assignmentHistory.length})</span>
            )}
          </h2>
          {assignmentHistory.length === 0 ? (
            <p className="text-neutral-500 text-sm">No assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {assignmentHistory.map((a) => (
                <div key={a.id} className={`p-3 rounded-lg border ${
                  a.is_test ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-neutral-800/60 border-neutral-700/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {a.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-neutral-600 flex-shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium">
                            {a.title || a.template_name || 'Untitled Workout'}
                          </span>
                          {a.is_test && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-indigo-900/30 text-indigo-400 flex items-center gap-1">
                              <Timer className="w-3 h-3" /> Test
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-neutral-500">
                            {format(new Date(a.workout_date + 'T00:00:00'), 'MMM d, yyyy')}
                          </span>
                          {a.training_zone && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              a.training_zone === 'UT2' ? 'bg-emerald-900/30 text-emerald-400' :
                              a.training_zone === 'UT1' ? 'bg-blue-900/30 text-blue-400' :
                              a.training_zone === 'AT' ? 'bg-amber-900/30 text-amber-400' :
                              a.training_zone === 'TR' ? 'bg-orange-900/30 text-orange-400' :
                              a.training_zone === 'AN' ? 'bg-red-900/30 text-red-400' :
                              'bg-neutral-700 text-neutral-400'
                            }`}>
                              {a.training_zone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Mark as Test toggle — only for completed assignments with results */}
                      {a.completed && a.result_time_seconds && a.result_distance_meters && (
                        <button
                          title={a.is_test ? 'Unmark as test' : 'Mark as test / baseline'}
                          onClick={async () => {
                            if (!teamId || !athleteId) return;
                            const newIsTest = !a.is_test;
                            try {
                              if (newIsTest) {
                                // Mark as test — create erg score
                                await markAssignmentAsTest(
                                  a.id,
                                  true,
                                  {
                                    teamId,
                                    coachUserId: userId,
                                    athleteId,
                                    date: a.workout_date,
                                    distance: a.result_distance_meters!,
                                    time_seconds: a.result_time_seconds!,
                                    split_500m: a.result_split_seconds ?? undefined,
                                    watts: a.result_split_seconds
                                      ? calculateWattsFromSplit(a.result_split_seconds)
                                      : undefined,
                                    stroke_rate: a.result_stroke_rate ?? undefined,
                                  }
                                );
                                toast.success('Marked as test — erg score created');
                              } else {
                                // Unmark as test — remove matching erg score
                                await markAssignmentAsTest(a.id, false);
                                // Find and delete the matching erg score
                                const matchingScore = ergScores.find(s =>
                                  s.athlete_id === athleteId &&
                                  s.distance === a.result_distance_meters &&
                                  Number(s.time_seconds) === Number(a.result_time_seconds) &&
                                  s.date === a.workout_date
                                );
                                if (matchingScore) {
                                  await deleteErgScore(matchingScore.id);
                                }
                                toast.success('Unmarked as test — erg score removed');
                              }
                              // Update local state
                              setAssignmentHistory(prev => prev.map(h =>
                                h.id === a.id ? { ...h, is_test: newIsTest } : h
                              ));
                              // Refresh erg scores
                              const scores = await getErgScoresForAthlete(athleteId, 50);
                              setErgScores(scores);
                            } catch (err) {
                              console.error('Failed to toggle test:', err);
                              toast.error('Failed to update test status');
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            a.is_test
                              ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                              : 'text-neutral-600 hover:text-neutral-400 hover:bg-neutral-700/50'
                          }`}
                        >
                          <Timer className="w-4 h-4" />
                        </button>
                      )}
                      <span className={`text-xs font-medium ${
                        a.completed ? 'text-emerald-400' : 'text-neutral-500'
                      }`}>
                        {a.completed ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  {/* Results row */}
                  {a.completed && a.result_time_seconds != null && (
                    <div className="mt-2 ml-8 flex items-center gap-4 text-xs">
                      {a.result_distance_meters != null && (
                        <span className="text-neutral-300 font-mono">{a.result_distance_meters}m</span>
                      )}
                      <span className="text-neutral-300 font-mono">{formatTime(a.result_time_seconds)}</span>
                      {a.result_split_seconds != null && (
                        <span className="text-neutral-400">
                          {formatSplit(a.result_split_seconds)} /500m
                        </span>
                      )}
                      {a.result_stroke_rate != null && (
                        <span className="text-neutral-500">{a.result_stroke_rate} spm</span>
                      )}
                    </div>
                  )}
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
        <AthleteEditorModal
          athlete={athlete}
          squads={[...new Set(allAthletes.map((a) => a.squad).filter((s): s is string => !!s))].sort()}
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

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
