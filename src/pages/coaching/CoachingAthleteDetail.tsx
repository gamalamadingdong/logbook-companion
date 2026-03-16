import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import {
  getAthletes,
  getAthleteById,
  getOrgAthletesWithTeam,
  getCoachNotesForAthlete,
  createCoachNote,
  getErgScoresForAthlete,
  getNotesForAthlete,
  getAssignmentsForAthlete,
  markAssignmentAsTest,
  deleteErgScore,
  updateErgScore,
  updateAthlete,
  updateAthleteSquad,
  deleteAthlete,
  type CoachingAthlete,
  type CoachingAthleteCoachNote,
  type CoachingErgScore,
  type CoachingAthleteNote,
  type CoachingSession,
  type AthleteAssignment,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { Edit2, Trash2, Loader2, AlertTriangle, MessageSquare, ClipboardList, CheckCircle2, Circle, Timer, X, Check, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { formatSplit, calculateWattsFromSplit } from '../../utils/paceCalculator';
import { formatHeight, formatWeight } from '../../utils/unitConversion';
import { useMeasurementUnits } from '../../hooks/useMeasurementUnits';
import { ErgScoreProgressionChart } from '../../components/coaching/ErgScoreProgressionChart';
import { TrainingZoneDonut } from '../../components/coaching/TrainingZoneDonut';
import { AthleteTrainingZones } from '../../components/coaching/AthleteTrainingZones';
import { AthleteEditorModal } from '../../components/coaching/AthleteEditorModal';
import {
  getTierProgress,
  benchmarkTierBadgeClass,
  formatErgTime,
  buildBest2kByAthlete,
  type PerformanceTierRubricConfig,
} from '../../utils/performanceTierRubric';
import { getOrganizationsForUser } from '../../services/coaching/coachingService';

export function CoachingAthleteDetail() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const navigate = useNavigate();
  const { teamId, userId, orgId, isLoadingTeam } = useCoachingContext();

  const [athlete, setAthlete] = useState<CoachingAthlete | null>(null);
  const [allAthletes, setAllAthletes] = useState<CoachingAthlete[]>([]);
  const [ergScores, setErgScores] = useState<CoachingErgScore[]>([]);
  const [coachNotes, setCoachNotes] = useState<CoachingAthleteCoachNote[]>([]);
  const [athleteNotes, setAthleteNotes] = useState<(CoachingAthleteNote & { session?: CoachingSession })[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<AthleteAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newCoachNote, setNewCoachNote] = useState('');
  const [newCoachNoteVisible, setNewCoachNoteVisible] = useState(false);
  const [isSavingCoachNote, setIsSavingCoachNote] = useState(false);
  const [orgRubric, setOrgRubric] = useState<PerformanceTierRubricConfig | null>(null);
  const units = useMeasurementUnits();
  const athleteTeamId = athlete?.team_id ?? teamId;

  // Load org rubric for tier progress
  useEffect(() => {
    if (!userId || !orgId) { setOrgRubric(null); return; }
    getOrganizationsForUser(userId)
      .then((orgs) => {
        const org = orgs.find((o) => o.id === orgId);
        setOrgRubric(org?.performance_tier_rubric ?? null);
      })
      .catch(() => setOrgRubric(null));
  }, [userId, orgId]);

  useEffect(() => {
    if (!athleteId || isLoadingTeam || (!teamId && !orgId)) return;
    
    const loadData = async () => {
      try {
        // Load the specific athlete directly by ID (works cross-team)
        const found = await getAthleteById(athleteId);

        // Also load the roster for prev/next navigation
        const roster = orgId
          ? await getOrgAthletesWithTeam(orgId)
          : teamId
            ? await getAthletes(teamId)
            : [];
        setAllAthletes(roster);

        if (found) {
          setAthlete(found);
          const [scores, runningCoachNotes, notes, assignments] = await Promise.all([
            getErgScoresForAthlete(athleteId, 50),
            getCoachNotesForAthlete(athleteId, 50),
            getNotesForAthlete(athleteId, 30),
            getAssignmentsForAthlete(athleteId, 100),
          ]);
          setErgScores(scores);
          setCoachNotes(runningCoachNotes);
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
  }, [teamId, orgId, athleteId, isLoadingTeam]);

  const handleSave = async (data: Partial<CoachingAthlete> & { squad?: string }) => {
    if (!athleteId || !athleteTeamId) return;
    try {
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
        await updateAthleteSquad(athleteTeamId, athleteId, data.squad || null);
      }
      setIsEditing(false);
      // Refresh
      const updated = await getAthleteById(athleteId);
      const athletes = orgId
        ? await getOrgAthletesWithTeam(orgId)
        : await getAthletes(athleteTeamId);
      setAllAthletes(athletes);
      if (updated) setAthlete(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save athlete');
    }
  };

  const handleDelete = async () => {
    if (!athleteId) return;
    try {
      await deleteAthlete(athleteId);
      navigate('/team-management/roster');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete athlete');
    }
  };

  const handleAddCoachNote = async () => {
    if (!athleteId || !athleteTeamId || !newCoachNote.trim()) return;
    setIsSavingCoachNote(true);
    try {
      const created = await createCoachNote(athleteTeamId, userId, {
        athlete_id: athleteId,
        note: newCoachNote.trim(),
        visible_to_athlete: newCoachNoteVisible,
      });
      setCoachNotes((prev) => [created, ...prev]);
      setNewCoachNote('');
      setNewCoachNoteVisible(false);
      toast.success('Coach note added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add coach note');
    } finally {
      setIsSavingCoachNote(false);
    }
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
        <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
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
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-6">
        <Breadcrumb items={[
          { label: 'Team Management', to: '/team-management' },
          { label: 'Roster', to: '/team-management/roster' },
          { label: athlete ? `${athlete.first_name} ${athlete.last_name}` : 'Athlete' },
        ]} />

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
                      <span>{formatHeight(athlete.height_cm, units)}</span>
                    )}
                    {athlete.weight_kg != null && (
                      <span>{formatWeight(athlete.weight_kg, units)}</span>
                    )}
                  </div>
                )}
                {/* Tier Progress */}
                {(() => {
                  const best2kMap = buildBest2kByAthlete(ergScores.map((s) => ({ athlete_id: athleteId!, distance: s.distance, time_seconds: s.time_seconds })));
                  const best2k = best2kMap[athleteId!] ?? null;
                  const progress = getTierProgress(athlete.squad, best2k, orgRubric);
                  if (!progress) return null;
                  return (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${benchmarkTierBadgeClass(progress.tier)}`}>
                        {progress.tierLabel}
                      </span>
                      <span className="text-neutral-500">Best 2k: {formatErgTime(progress.best2kSeconds)}</span>
                      {progress.secondsToNextTier != null && progress.nextTierLabel && (
                        <span className="text-neutral-400">
                          &middot; {progress.secondsToNextTier}s from {progress.nextTierLabel}
                        </span>
                      )}
                      {progress.secondsToNextTier == null && (
                        <span className="text-emerald-400">
                          &middot; Top tier{progress.secondsClearedInTier != null ? ` (${progress.secondsClearedInTier}s clear)` : ''}
                        </span>
                      )}
                    </div>
                  );
                })()}
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
              <div>
                <h3 className="font-medium mb-2 text-sm text-neutral-500 uppercase tracking-wide">General Notes</h3>
                <p className="text-neutral-300 whitespace-pre-wrap">{athlete.notes}</p>
              </div>
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

        {/* Erg Scores Table — full CRUD */}
        {ergScores.length > 0 && (
          <ErgScoresTable
            scores={ergScores}
            onUpdate={async (id, updates) => {
              await updateErgScore(id, updates);
              const refreshed = await getErgScoresForAthlete(athleteId!, 50);
              setErgScores(refreshed);
              toast.success('Score updated');
            }}
            onDelete={async (id) => {
              await deleteErgScore(id);
              const refreshed = await getErgScoresForAthlete(athleteId!, 50);
              setErgScores(refreshed);
              toast.success('Score deleted');
            }}
          />
        )}

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

        {/* Coach Notes */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Coach Notes
              {coachNotes.length > 0 && (
                <span className="text-sm text-neutral-500 font-normal">({coachNotes.length})</span>
              )}
            </h2>
            <span className="text-xs text-neutral-500">Shared across the coaching staff</span>
          </div>

          <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-4 mb-4 space-y-3">
            <textarea
              value={newCoachNote}
              onChange={(e) => setNewCoachNote(e.target.value)}
              rows={3}
              placeholder="Add a technical observation, coaching cue, or development note..."
              className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label htmlFor="new-coach-note-visible" className="flex items-center gap-2 text-sm text-neutral-400">
                <input
                  id="new-coach-note-visible"
                  type="checkbox"
                  checked={newCoachNoteVisible}
                  onChange={(e) => setNewCoachNoteVisible(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-indigo-500 focus:ring-indigo-500"
                />
                Visible to the athlete in their team notes page
              </label>
              <button
                onClick={handleAddCoachNote}
                disabled={isSavingCoachNote || !newCoachNote.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {isSavingCoachNote ? 'Saving…' : 'Add Coach Note'}
              </button>
            </div>
          </div>

          {coachNotes.length === 0 ? (
            <p className="text-neutral-500 text-sm">No coach notes yet.</p>
          ) : (
            <div className="space-y-2">
              {coachNotes.map((note) => (
                <div key={note.id} className="p-3 bg-neutral-800/60 border border-neutral-700/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-neutral-300 font-medium">{note.author_display_name ?? 'Coach'}</span>
                    <span className="text-xs text-neutral-500">{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${note.visible_to_athlete ? 'bg-emerald-900/30 text-emerald-400' : 'bg-neutral-700 text-neutral-300'}`}>
                      {note.visible_to_athlete ? 'Visible to athlete' : 'Coach only'}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-200 whitespace-pre-wrap">{note.note}</p>
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
          units={units}
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
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

/* ─── Erg Scores Table with inline edit / delete ──────────────────────────── */

interface ErgScoresTableProps {
  scores: CoachingErgScore[];
  onUpdate: (id: string, updates: Partial<Pick<CoachingErgScore, 'date' | 'distance' | 'time_seconds' | 'split_500m' | 'watts' | 'stroke_rate' | 'heart_rate' | 'notes'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface EditState {
  date: string;
  distance: string;
  minutes: string;
  seconds: string;
  tenths: string;
  strokeRate: string;
  heartRate: string;
  notes: string;
}

function ErgScoresTable({ scores, onUpdate, onDelete }: ErgScoresTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    date: '', distance: '', minutes: '', seconds: '', tenths: '', strokeRate: '', heartRate: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const startEdit = (score: CoachingErgScore) => {
    const totalSec = score.time_seconds;
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const tenths = Math.round((totalSec % 1) * 10);
    setEditState({
      date: score.date,
      distance: String(score.distance),
      minutes: String(mins),
      seconds: String(secs).padStart(2, '0'),
      tenths: String(tenths),
      strokeRate: score.stroke_rate ? String(score.stroke_rate) : '',
      heartRate: score.heart_rate ? String(score.heart_rate) : '',
      notes: score.notes ?? '',
    });
    setEditingId(score.id);
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const dist = Number(editState.distance);
      const totalSec = Number(editState.minutes) * 60 + Number(editState.seconds) + Number(editState.tenths || 0) / 10;
      const split = dist > 0 ? (totalSec / dist) * 500 : 0;
      const watts = split > 0 ? 2.80 / Math.pow(split / 500, 3) : 0;
      await onUpdate(id, {
        date: editState.date,
        distance: dist,
        time_seconds: totalSec,
        split_500m: split,
        watts,
        stroke_rate: editState.strokeRate ? Number(editState.strokeRate) : undefined,
        heart_rate: editState.heartRate ? Number(editState.heartRate) : undefined,
        notes: editState.notes || undefined,
      });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update score');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (id: string) => {
    setSaving(true);
    try {
      await onDelete(id);
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete score');
    } finally {
      setSaving(false);
    }
  };

  const inp = "px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-xs w-full focus:ring-1 focus:ring-indigo-500 outline-none";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        Erg Scores
        <span className="text-sm text-neutral-500 font-normal">({scores.length})</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-500 border-b border-neutral-800 text-xs">
              <th className="text-left py-2 pr-2">Date</th>
              <th className="text-right py-2 pr-2">Distance</th>
              <th className="text-right py-2 pr-2">Time</th>
              <th className="text-right py-2 pr-2">Split</th>
              <th className="text-right py-2 pr-2">Watts</th>
              <th className="text-right py-2 pr-2">SR</th>
              <th className="text-right py-2 pr-2">HR</th>
              <th className="text-left py-2 pr-2">Notes</th>
              <th className="text-right py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score) => {
              const isEditing = editingId === score.id;
              const isDeleting = deleteConfirmId === score.id;

              if (isEditing) {
                return (
                  <tr key={score.id} className="border-b border-neutral-800/50 bg-neutral-800/30">
                    <td className="py-2 pr-2">
                      <input type="date" title="Score date" aria-label="Score date" className={inp} value={editState.date} onChange={(e) => setEditState(s => ({ ...s, date: e.target.value }))} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" title="Distance in meters" aria-label="Distance in meters" className={`${inp} text-right w-20`} value={editState.distance} onChange={(e) => setEditState(s => ({ ...s, distance: e.target.value }))} />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-0.5 justify-end">
                        <input type="number" title="Minutes" aria-label="Minutes" className={`${inp} w-10 text-right`} value={editState.minutes} min={0} onChange={(e) => setEditState(s => ({ ...s, minutes: e.target.value }))} />
                        <span className="text-neutral-500">:</span>
                        <input type="number" title="Seconds" aria-label="Seconds" className={`${inp} w-10 text-right`} value={editState.seconds} min={0} max={59} onChange={(e) => setEditState(s => ({ ...s, seconds: e.target.value }))} />
                        <span className="text-neutral-500">.</span>
                        <input type="number" title="Tenths" aria-label="Tenths" className={`${inp} w-8 text-right`} value={editState.tenths} min={0} max={9} onChange={(e) => setEditState(s => ({ ...s, tenths: e.target.value }))} />
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right text-neutral-500 text-xs">auto</td>
                    <td className="py-2 pr-2 text-right text-neutral-500 text-xs">auto</td>
                    <td className="py-2 pr-2">
                      <input type="number" className={`${inp} text-right w-12`} value={editState.strokeRate} placeholder="—" onChange={(e) => setEditState(s => ({ ...s, strokeRate: e.target.value }))} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" className={`${inp} text-right w-14`} value={editState.heartRate} placeholder="—" onChange={(e) => setEditState(s => ({ ...s, heartRate: e.target.value }))} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="text" className={inp} value={editState.notes} placeholder="—" onChange={(e) => setEditState(s => ({ ...s, notes: e.target.value }))} />
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => saveEdit(score.id)} disabled={saving} className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50" title="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-neutral-400 hover:text-neutral-300" title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={score.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="py-2 pr-2 text-neutral-300">{format(new Date(score.date + 'T00:00:00'), 'MMM d, yyyy')}</td>
                  <td className="py-2 pr-2 text-right font-mono text-white">{score.distance}m</td>
                  <td className="py-2 pr-2 text-right font-mono text-white">{formatTime(score.time_seconds)}</td>
                  <td className="py-2 pr-2 text-right font-mono text-neutral-300">{score.split_500m ? formatSplit(score.split_500m) : '—'}</td>
                  <td className="py-2 pr-2 text-right font-mono text-neutral-300">{score.watts ? Math.round(score.watts) : '—'}</td>
                  <td className="py-2 pr-2 text-right font-mono text-neutral-400">{score.stroke_rate ?? '—'}</td>
                  <td className="py-2 pr-2 text-right font-mono text-neutral-400">{score.heart_rate ?? '—'}</td>
                  <td className="py-2 pr-2 text-neutral-400 text-xs max-w-[120px] truncate" title={score.notes ?? undefined}>{score.notes || '—'}</td>
                  <td className="py-2 text-right">
                    {isDeleting ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => confirmDelete(score.id)} disabled={saving} className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50">
                          Delete
                        </button>
                        <button onClick={() => setDeleteConfirmId(null)} className="p-1 text-neutral-400 hover:text-neutral-300" title="Cancel delete" aria-label="Cancel delete">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 [tr:hover_&]:opacity-100">
                        <button onClick={() => startEdit(score)} className="p-1 text-neutral-500 hover:text-indigo-400 transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setDeleteConfirmId(score.id); setEditingId(null); }} className="p-1 text-neutral-500 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
