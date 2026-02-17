import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import {
  getAthletes,
  createAthlete,
  updateAthlete,
  updateAthleteSquad,
  deleteAthlete,
  getAssignmentCompletions,
  getTeamErgComparison,
  type CoachingAthlete,
  type AssignmentCompletion,
  type TeamErgComparison,
} from '../../services/coaching/coachingService';
import { Plus, Trash2, Loader2, AlertTriangle, Filter, CheckCircle2, XCircle, Download, BarChart3, ExternalLink } from 'lucide-react';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { QuickScoreModal } from '../../components/coaching/QuickScoreModal';
import { AthleteEditorModal } from '../../components/coaching/AthleteEditorModal';
import { SquadPowerComparisonChart } from '../../components/coaching/SquadPowerComparisonChart';
import { WattsPerKgChart } from '../../components/coaching/WattsPerKgChart';
import { downloadCsv } from '../../utils/csvExport';
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg } from '../../utils/unitConversion';
import { format } from 'date-fns';

export function CoachingRoster() {
  const { userId, teamId, isLoadingTeam, teamError } = useCoachingContext();
  const navigate = useNavigate();

  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingAthlete, setDeletingAthlete] = useState<CoachingAthlete | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string | 'all'>('all');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [completions, setCompletions] = useState<AssignmentCompletion[]>([]);
  const [hasAssignmentsToday, setHasAssignmentsToday] = useState(false);
  const [quickScoreAthlete, setQuickScoreAthlete] = useState<CoachingAthlete | null>(null);
  const [ergComparison, setErgComparison] = useState<TeamErgComparison[]>([]);
  const [showCharts, setShowCharts] = useState(false);

  // Inline editing: which cell is being edited?  { athleteId, field }
  const [editingCell, setEditingCell] = useState<{ athleteId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editValue2, setEditValue2] = useState(''); // for ft/in (second field)
  const editRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const refreshCompletions = async (loadedAthletes: CoachingAthlete[]) => {
    if (!teamId) return;
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const comps = await getAssignmentCompletions(teamId, todayStr, loadedAthletes);
      setCompletions(comps);
      setHasAssignmentsToday(comps.length > 0);
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;
    Promise.all([
      getAthletes(teamId),
      getTeamErgComparison(teamId).catch(() => [] as TeamErgComparison[]),
    ])
      .then(async ([loadedAthletes, ergData]) => {
        setAthletes(loadedAthletes);
        setErgComparison(ergData);
        await refreshCompletions(loadedAthletes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load athletes'))
      .finally(() => setIsLoading(false));
  }, [teamId, isLoadingTeam]);

  const refreshAthletes = async () => {
    if (teamId) {
      try {
        const loadedAthletes = await getAthletes(teamId);
        setAthletes(loadedAthletes);
        await refreshCompletions(loadedAthletes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh');
      }
    }
  };

  const handleSave = async (data: Partial<CoachingAthlete> & { squad?: string }) => {
    await createAthlete(teamId, userId, {
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      grade: data.grade,
      experience_level: data.experience_level,
      side: data.side,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      notes: data.notes,
    }, data.squad || null);
    setIsAdding(false);
    await refreshAthletes();
  };

  // ── Inline cell editing ──────────────────────────────────────────────────

  const startEditing = useCallback((athleteId: string, field: string) => {
    const a = athletes.find(x => x.id === athleteId);
    if (!a) return;

    setEditingCell({ athleteId, field });

    if (field === 'height') {
      const ftIn = a.height_cm ? cmToFtIn(a.height_cm) : null;
      setEditValue(ftIn?.feet?.toString() ?? '');
      setEditValue2(ftIn?.inches?.toString() ?? '');
    } else if (field === 'weight') {
      setEditValue(a.weight_kg ? kgToLbs(a.weight_kg).toString() : '');
    } else if (field === 'first_name') {
      setEditValue(a.first_name);
    } else if (field === 'last_name') {
      setEditValue(a.last_name);
    } else if (field === 'grade') {
      setEditValue(a.grade ?? '');
    } else if (field === 'side') {
      setEditValue(a.side ?? 'both');
    } else if (field === 'experience_level') {
      setEditValue(a.experience_level ?? 'beginner');
    } else if (field === 'squad') {
      setEditValue(a.squad ?? '');
    } else if (field === 'notes') {
      setEditValue(a.notes ?? '');
    }

    // Focus after render
    setTimeout(() => editRef.current?.focus(), 0);
  }, [athletes]);

  const commitEdit = useCallback(async () => {
    if (!editingCell) return;
    const { athleteId, field } = editingCell;
    const a = athletes.find(x => x.id === athleteId);
    if (!a) { setEditingCell(null); return; }

    setEditingCell(null);

    try {
      if (field === 'squad') {
        const trimmed = editValue.trim() || null;
        if (trimmed !== (a.squad ?? null)) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, squad: trimmed } : x));
          await updateAthleteSquad(teamId, athleteId, trimmed);
        }
      } else if (field === 'height') {
        const cm = (editValue || editValue2)
          ? ftInToCm(Number(editValue) || 0, Number(editValue2) || 0)
          : null;
        if (cm !== a.height_cm) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, height_cm: cm } : x));
          await updateAthlete(athleteId, { height_cm: cm });
        }
      } else if (field === 'weight') {
        const kg = editValue ? lbsToKg(Number(editValue)) : null;
        if (kg !== a.weight_kg) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, weight_kg: kg } : x));
          await updateAthlete(athleteId, { weight_kg: kg });
        }
      } else if (field === 'first_name' || field === 'last_name' || field === 'grade' || field === 'notes') {
        const val = editValue.trim() || (field === 'first_name' || field === 'last_name' ? a[field] : undefined);
        if (val !== a[field]) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? {
            ...x,
            [field]: val,
            name: field === 'first_name' ? `${val} ${x.last_name}`.trim()
                 : field === 'last_name' ? `${x.first_name} ${val}`.trim()
                 : x.name,
          } : x));
          await updateAthlete(athleteId, { [field]: val } as Partial<CoachingAthlete>);
        }
      } else if (field === 'side') {
        const val = editValue as CoachingAthlete['side'];
        if (val !== a.side) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, side: val } : x));
          await updateAthlete(athleteId, { side: val });
        }
      } else if (field === 'experience_level') {
        const val = editValue as CoachingAthlete['experience_level'];
        if (val !== a.experience_level) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, experience_level: val } : x));
          await updateAthlete(athleteId, { experience_level: val });
        }
      }
    } catch {
      // Revert on failure
      await refreshAthletes();
    }
  }, [editingCell, editValue, editValue2, athletes, teamId]);

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditingCell(null); }
  };

  const handleDelete = async (id: string) => {
    await deleteAthlete(id);
    setDeletingAthlete(null);
    await refreshAthletes();
  };

  // Derived: distinct squad names + filtered list
  const squads = [...new Set(athletes.map((a) => a.squad).filter((s): s is string => !!s))].sort();

  // Build a set of athlete IDs that are "missing" (have at least one incomplete assignment today)
  const missingAthleteIds = new Set<string>();
  for (const comp of completions) {
    for (const m of comp.missing_athletes) missingAthleteIds.add(m.id);
  }

  const getMissingCompletionsForAthlete = (athleteId: string): AssignmentCompletion[] =>
    completions.filter((comp) => comp.missing_athletes.some((m) => m.id === athleteId));

  let filteredAthletes = selectedSquad === 'all' ? athletes : athletes.filter((a) => a.squad === selectedSquad);
  if (showMissingOnly && hasAssignmentsToday) {
    filteredAthletes = filteredAthletes.filter((a) => missingAthleteIds.has(a.id));
  }

// Helper: is a given cell currently being edited?
  const isEditing = (athleteId: string, field: string) =>
    editingCell?.athleteId === athleteId && editingCell?.field === field;

  // Shared cell CSS
  const cellBase = 'px-3 py-2.5 text-sm whitespace-nowrap';
  const editableCellClass = `${cellBase} cursor-pointer hover:bg-neutral-800/60 transition-colors`;
  const inputClass = 'w-full bg-neutral-800 border border-indigo-500 rounded px-2 py-1 text-white text-sm outline-none focus:ring-1 focus:ring-indigo-400';
  const selectClass = `${inputClass} appearance-none`;

  // Experience level badge styling
  const expBadge = (level?: string) => {
    const map: Record<string, string> = {
      beginner: 'bg-green-900/30 text-green-400',
      intermediate: 'bg-amber-900/30 text-amber-400',
      experienced: 'bg-purple-900/30 text-purple-400',
      advanced: 'bg-blue-900/30 text-blue-400',
    };
    return map[level ?? ''] ?? 'bg-neutral-800 text-neutral-500';
  };

  return (
    <>
    <CoachingNav />
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Roster</h1>
            <p className="text-neutral-400 mt-1">
              {filteredAthletes.length}{selectedSquad !== 'all' ? ` in ${selectedSquad}` : ''} athlete{filteredAthletes.length !== 1 ? 's' : ''}{selectedSquad !== 'all' ? ` (${athletes.length} total)` : ''}
              <span className="text-neutral-600 ml-2">· Click any cell to edit</span>
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {squads.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-neutral-500" />
                <select
                  value={selectedSquad}
                  onChange={(e) => setSelectedSquad(e.target.value)}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  aria-label="Filter by squad"
                >
                  <option value="all">All Squads</option>
                  {squads.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            {hasAssignmentsToday && (
              <button
                onClick={() => setShowMissingOnly(!showMissingOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  showMissingOnly
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <XCircle className="w-4 h-4" />
                {showMissingOnly ? `Missing (${missingAthleteIds.size})` : 'Show Missing'}
              </button>
            )}
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Athlete
            </button>
            {ergComparison.length > 0 && (
              <button
                onClick={() => setShowCharts(!showCharts)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  showCharts
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Charts
              </button>
            )}
            <button
              onClick={() => {
                downloadCsv(
                  filteredAthletes.map((a) => ({
                    name: a.name,
                    first_name: a.first_name,
                    last_name: a.last_name,
                    squad: a.squad ?? '',
                    grade: a.grade ?? '',
                    side: a.side ?? '',
                    experience: a.experience_level ?? '',
                    height_cm: a.height_cm ?? '',
                    weight_kg: a.weight_kg ?? '',
                    notes: a.notes ?? '',
                  })),
                  `roster-${format(new Date(), 'yyyy-MM-dd')}.csv`,
                  [
                    { key: 'name', label: 'Name' },
                    { key: 'squad', label: 'Squad' },
                    { key: 'grade', label: 'Grade' },
                    { key: 'side', label: 'Side' },
                    { key: 'experience', label: 'Experience' },
                    { key: 'height_cm', label: 'Height (cm)' },
                    { key: 'weight_kg', label: 'Weight (kg)' },
                    { key: 'notes', label: 'Notes' },
                  ]
                );
              }}
              disabled={filteredAthletes.length === 0}
              className="flex items-center gap-2 px-3 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 text-sm"
              title="Export roster to CSV"
            >
              <Download className="w-4 h-4" />
              CSV
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

      {/* Charts Section */}
      {showCharts && ergComparison.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-medium text-neutral-400 mb-4">Squad Power Comparison</h3>
            <SquadPowerComparisonChart data={ergComparison} />
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-medium text-neutral-400 mb-4">Watts / kg Ratio</h3>
            <WattsPerKgChart ergData={ergComparison} athletes={athletes} />
          </div>
        </div>
      )}

      {/* ── Inline-Editable Roster Table ──────────────────────────────────── */}
      {!isLoading && !error && filteredAthletes.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80">
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">First</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Last</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Squad</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Grade</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Side</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Experience</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Height</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Weight</th>
                  {hasAssignmentsToday && <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Today</th>}
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredAthletes.map((athlete) => (
                  <tr key={athlete.id} className="hover:bg-neutral-800/30 transition-colors group">
                    {/* First Name */}
                    <td className={editableCellClass} onClick={() => startEditing(athlete.id, 'first_name')}>
                      {isEditing(athlete.id, 'first_name') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={inputClass} style={{ width: '100px' }} />
                      ) : (
                        <span className="text-white font-medium">{athlete.first_name}</span>
                      )}
                    </td>

                    {/* Last Name */}
                    <td className={editableCellClass} onClick={() => startEditing(athlete.id, 'last_name')}>
                      {isEditing(athlete.id, 'last_name') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={inputClass} style={{ width: '100px' }} />
                      ) : (
                        <span className="text-white font-medium">{athlete.last_name}</span>
                      )}
                    </td>

                    {/* Squad */}
                    <td className={editableCellClass} onClick={() => startEditing(athlete.id, 'squad')}>
                      {isEditing(athlete.id, 'squad') ? (
                        <>
                          <input ref={r => { editRef.current = r; }} type="text" list={`sq-${athlete.id}`} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                            className={inputClass} style={{ width: '100px' }} />
                          <datalist id={`sq-${athlete.id}`}>
                            {squads.map(s => <option key={s} value={s} />)}
                          </datalist>
                        </>
                      ) : athlete.squad ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-900/30 text-cyan-400">{athlete.squad}</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Grade */}
                    <td className={editableCellClass} onClick={() => startEditing(athlete.id, 'grade')}>
                      {isEditing(athlete.id, 'grade') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={inputClass} style={{ width: '60px' }} />
                      ) : (
                        <span className="text-neutral-300">{athlete.grade || <span className="text-neutral-600">—</span>}</span>
                      )}
                    </td>

                    {/* Side */}
                    <td className={editableCellClass} onClick={() => startEditing(athlete.id, 'side')}>
                      {isEditing(athlete.id, 'side') ? (
                        <select ref={r => { editRef.current = r; }} value={editValue} onChange={e => { setEditValue(e.target.value); }}
                          onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={selectClass} style={{ width: '110px' }}>
                          <option value="port">Port</option>
                          <option value="starboard">Starboard</option>
                          <option value="coxswain">Coxswain</option>
                          <option value="both">Both</option>
                        </select>
                      ) : (
                        <span className="text-neutral-300 capitalize">{athlete.side || '—'}</span>
                      )}
                    </td>

                    {/* Experience Level */}
                    <td className={editableCellClass} onClick={() => startEditing(athlete.id, 'experience_level')}>
                      {isEditing(athlete.id, 'experience_level') ? (
                        <select ref={r => { editRef.current = r; }} value={editValue} onChange={e => { setEditValue(e.target.value); }}
                          onBlur={commitEdit} onKeyDown={handleCellKeyDown} className={selectClass} style={{ width: '130px' }}>
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="experienced">Experienced</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      ) : athlete.experience_level ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${expBadge(athlete.experience_level)}`}>
                          {athlete.experience_level.charAt(0).toUpperCase() + athlete.experience_level.slice(1)}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Height (ft/in) */}
                    <td className={editableCellClass} onClick={() => startEditing(athlete.id, 'height')}>
                      {isEditing(athlete.id, 'height') ? (
                        <div className="flex items-center gap-1">
                          <input ref={r => { editRef.current = r; }} type="number" min={0} max={8} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onKeyDown={handleCellKeyDown}
                            className={inputClass} style={{ width: '40px' }} placeholder="ft" />
                          <span className="text-neutral-500">'</span>
                          <input type="number" min={0} max={11} value={editValue2}
                            onChange={e => setEditValue2(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                            className={inputClass} style={{ width: '40px' }} placeholder="in" />
                          <span className="text-neutral-500">"</span>
                        </div>
                      ) : athlete.height_cm ? (
                        <span className="text-neutral-300">{cmToFtIn(athlete.height_cm).display}</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Weight (lbs) */}
                    <td className={editableCellClass} onClick={() => startEditing(athlete.id, 'weight')}>
                      {isEditing(athlete.id, 'weight') ? (
                        <div className="flex items-center gap-1">
                          <input ref={r => { editRef.current = r; }} type="number" min={0} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleCellKeyDown}
                            className={inputClass} style={{ width: '60px' }} />
                          <span className="text-neutral-500 text-xs">lbs</span>
                        </div>
                      ) : athlete.weight_kg ? (
                        <span className="text-neutral-300">{kgToLbs(athlete.weight_kg)} lbs</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Today's completion status */}
                    {hasAssignmentsToday && (
                      <td className={cellBase}>
                        {missingAthleteIds.has(athlete.id) ? (
                          <button
                            type="button"
                            onClick={() => setQuickScoreAthlete(athlete)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
                            title="Enter quick score"
                          >
                            <XCircle className="w-3 h-3" />
                            Missing
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Done
                          </span>
                        )}
                      </td>
                    )}

                    {/* Actions */}
                    <td className={`${cellBase} text-right`}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/team-management/roster/${athlete.id}`)}
                          className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
                          title="View detail"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-500 hover:text-indigo-400" />
                        </button>
                        <button
                          onClick={() => setDeletingAthlete(athlete)}
                          className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
                          title="Delete athlete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-neutral-500 hover:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Add Modal (modal only used for adding new athletes) */}
      {isAdding && (
        <AthleteEditorModal
          athlete={null}
          squads={squads}
          onSave={handleSave}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* Quick Score Modal */}
      {quickScoreAthlete && teamId && (
        <QuickScoreModal
          athlete={quickScoreAthlete}
          missingCompletions={getMissingCompletionsForAthlete(quickScoreAthlete.id)}
          teamId={teamId}
          coachUserId={userId}
          onClose={() => setQuickScoreAthlete(null)}
          onComplete={async () => {
            await refreshAthletes();
            setQuickScoreAthlete(null);
          }}
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
