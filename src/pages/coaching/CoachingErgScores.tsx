import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { parseLocalDate } from '../../utils/dateUtils';
import {
  getErgScores,
  getAthletes,
  createErgScore,
  deleteErgScore,
  type CoachingErgScore,
  type CoachingAthlete,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { Plus, X, TrendingUp, TrendingDown, Minus, Loader2, Trash2 } from 'lucide-react';
import { CoachingNav } from '../../components/coaching/CoachingNav';

export function CoachingErgScores() {
  const { user } = useAuth();
  const coachId = user?.id ?? '';
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [scores, setScores] = useState<CoachingErgScore[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState<number | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coachId) return;
    Promise.all([getAthletes(coachId), getErgScores(coachId)])
      .then(([a, s]) => {
        setAthletes(a);
        setScores(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [coachId]);

  const refreshData = async () => {
    if (!coachId) return;
    try {
      const [a, s] = await Promise.all([getAthletes(coachId), getErgScores(coachId)]);
      setAthletes(a);
      setScores(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    }
  };

  const filteredScores = selectedDistance === 'all' ? scores : scores.filter((s) => s.distance === selectedDistance);
  const distances = [...new Set(scores.map((s) => s.distance))].sort((a, b) => a - b);

  const handleAddScore = async (score: Omit<Parameters<typeof createErgScore>[1], 'athlete_id'> & { athlete_id: string }) => {
    await createErgScore(coachId, score);
    setIsAdding(false);
    await refreshData();
  };

  const handleDeleteScore = async (id: string) => {
    await deleteErgScore(id);
    await refreshData();
  };

  const getAthleteName = (athleteId: string) =>
    athletes.find((a) => a.id === athleteId)?.name ?? 'Unknown';

  // Group by date for display
  const scoresByDate = filteredScores.reduce((acc, score) => {
    const dateKey = score.date.slice(0, 10); // yyyy-MM-dd
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(score);
    return acc;
  }, {} as Record<string, CoachingErgScore[]>);

  return (
    <>
    <CoachingNav />
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Erg Scores</h1>
            <p className="text-neutral-400 mt-1">
              {scores.length} score{scores.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedDistance}
              onChange={(e) => setSelectedDistance(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              aria-label="Filter by distance"
            >
              <option value="all">All Distances</option>
              {distances.map((d) => (
                <option key={d} value={d}>{d}m</option>
              ))}
            </select>
            <button
              onClick={() => setIsAdding(true)}
              disabled={athletes.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Record Score
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => { setError(null); refreshData(); }} className="ml-3 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Plus className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-neutral-400 mb-4">Add athletes first to record scores</p>
          <a href="/coaching/roster" className="text-indigo-400 hover:underline font-medium">Go to Roster</a>
        </div>
      ) : Object.keys(scoresByDate).length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-900/20 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-neutral-400 mb-4">No erg scores recorded yet</p>
          <button onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
            Record your first score
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(scoresByDate).map(([dateKey, dayScores]) => (
            <div key={dateKey} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-indigo-500/5 border-b border-neutral-800">
                <h3 className="font-semibold text-white">
                  {format(parseLocalDate(dateKey), 'EEEE, MMMM d, yyyy')}
                </h3>
              </div>
              <div className="divide-y divide-neutral-800">
                {dayScores.map((score) => {
                  const trend = getScoreTrend(score, scores);
                  return (
                    <div key={score.id} className="p-4 flex items-center justify-between hover:bg-neutral-800/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {getAthleteName(score.athlete_id).charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{getAthleteName(score.athlete_id)}</p>
                          <p className="text-sm text-neutral-500">{score.distance}m</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold font-mono text-white">
                              {formatTime(score.time_seconds)}
                            </span>
                            {trend && (
                              <span className={`flex items-center gap-0.5 text-sm ${
                                trend.direction === 'up' ? 'text-green-400' :
                                trend.direction === 'down' ? 'text-red-400' :
                                'text-neutral-500'
                              }`}>
                                {trend.direction === 'up' && <TrendingUp className="w-4 h-4" />}
                                {trend.direction === 'down' && <TrendingDown className="w-4 h-4" />}
                                {trend.direction === 'same' && <Minus className="w-4 h-4" />}
                                {trend.diff !== 0 && `${trend.diff > 0 ? '+' : ''}${trend.diff}s`}
                              </span>
                            )}
                          </div>
                          {score.split_500m && (
                            <p className="text-sm text-neutral-500">
                              {formatTime(score.split_500m)} /500m
                            </p>
                          )}
                        </div>
                        <button onClick={() => handleDeleteScore(score.id)}
                          className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors" title="Delete score">
                          <Trash2 className="w-4 h-4 text-neutral-500 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdding && (
        <AddScoreForm athletes={athletes} onSave={handleAddScore} onCancel={() => setIsAdding(false)} />
      )}
    </div>
    </>
  );
}

/* ─── Add Score Form ───────────────────────────────────────────────────────── */

function AddScoreForm({
  athletes,
  onSave,
  onCancel,
}: {
  athletes: CoachingAthlete[];
  onSave: (score: Pick<CoachingErgScore, 'athlete_id' | 'date' | 'distance' | 'time_seconds' | 'split_500m' | 'stroke_rate' | 'notes'>) => void;
  onCancel: () => void;
}) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [distance, setDistance] = useState(500);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [tenths, setTenths] = useState('');
  const [strokeRate, setStrokeRate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalSeconds = (parseInt(minutes || '0') * 60) + parseInt(seconds || '0') + (parseInt(tenths || '0') / 10);
    const split = (totalSeconds / distance) * 500;

    onSave({
      athlete_id: athleteId,
      date,
      distance,
      time_seconds: totalSeconds,
      split_500m: split,
      stroke_rate: strokeRate ? parseInt(strokeRate) : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Record Erg Score</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="athlete-select" className="block text-sm font-medium text-neutral-300 mb-2">Athlete</label>
              <select id="athlete-select" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="date-input" className="block text-sm font-medium text-neutral-300 mb-2">Date</label>
              <input id="date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>

          <div>
            <label htmlFor="distance-select" className="block text-sm font-medium text-neutral-300 mb-2">Distance (m)</label>
            <select id="distance-select" value={distance} onChange={(e) => setDistance(Number(e.target.value))}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
              <option value={500}>500m</option>
              <option value={1000}>1000m</option>
              <option value={1500}>1500m</option>
              <option value={2000}>2000m</option>
              <option value={5000}>5000m</option>
              <option value={6000}>6000m</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Time</label>
            <div className="flex items-center gap-2">
              <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" min="0" aria-label="Minutes"
                className="w-20 px-3 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-center text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              <span className="text-xl font-bold text-neutral-500">:</span>
              <input type="number" value={seconds} onChange={(e) => setSeconds(e.target.value)} placeholder="00" min="0" max="59" aria-label="Seconds"
                className="w-20 px-3 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-center text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              <span className="text-xl font-bold text-neutral-500">.</span>
              <input type="number" value={tenths} onChange={(e) => setTenths(e.target.value)} placeholder="0" min="0" max="9" aria-label="Tenths of a second"
                className="w-16 px-3 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-center text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>

          <div>
            <label htmlFor="stroke-rate" className="block text-sm font-medium text-neutral-300 mb-2">Stroke Rate (optional)</label>
            <input id="stroke-rate" type="number" value={strokeRate} onChange={(e) => setStrokeRate(e.target.value)} placeholder="e.g., 28"
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>

          <div>
            <label htmlFor="erg-notes" className="block text-sm font-medium text-neutral-300 mb-2">Notes (optional)</label>
            <textarea id="erg-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              placeholder="Test conditions, observations..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-3 border border-neutral-700 rounded-xl text-neutral-300 hover:bg-neutral-800 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-medium">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const t = Math.round((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${t}`;
}

function getScoreTrend(
  current: CoachingErgScore,
  allScores: CoachingErgScore[]
): { direction: 'up' | 'down' | 'same'; diff: number } | null {
  const previousScores = allScores
    .filter(
      (s) =>
        s.athlete_id === current.athlete_id &&
        s.distance === current.distance &&
        parseLocalDate(s.date) < parseLocalDate(current.date)
    )
    .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

  if (previousScores.length === 0) return null;

  const diff = Math.round(current.time_seconds - previousScores[0].time_seconds);
  return {
    direction: diff < 0 ? 'up' : diff > 0 ? 'down' : 'same',
    diff,
  };
}
