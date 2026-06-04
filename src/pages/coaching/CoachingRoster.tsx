import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import {
  getAthletes,
  createAthlete,
  updateAthlete,
  updateAthleteSquad,
  updateAthletePerformanceTier,
  deleteAthlete,
  transferAthlete,
  getAssignmentCompletions,
  getErgScores,
  getOrganizationsForUser,
  getOrgAthletesWithTeam,
  getCoachNoteCountsByTeam,
  getCoachNoteCountsByOrg,
  type CoachingAthlete,
  type AssignmentCompletion,
} from '../../services/coaching/coachingService';
import { Plus, Trash2, Loader2, AlertTriangle, Filter, CheckCircle2, XCircle, Download, ExternalLink, ArrowUpDown, ChevronUp, ChevronDown, ArrowRightLeft, Users, FileSpreadsheet, FileText, MessageSquare } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { QuickScoreModal } from '../../components/coaching/QuickScoreModal';
import { AthleteEditorModal } from '../../components/coaching/AthleteEditorModal';
import { BulkRosterModal } from '../../components/coaching/BulkRosterModal';
import { AthleteNotesDrawer } from '../../components/coaching/AthleteNotesDrawer';
import { downloadCsv } from '../../utils/csvExport';
import { exportToPdf, exportToExcel } from '../../utils/exportUtils';
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg } from '../../utils/unitConversion';
import { benchmarkCriteriaIndicator, benchmarkTierBadgeClass, benchmarkTierLabel, buildBest2kByAthlete, deriveBenchmarkTier, formatErgTime, TIER_SORT_ORDER, type PerformanceTierRubricConfig } from '../../utils/performanceTierRubric';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMeasurementUnits } from '../../hooks/useMeasurementUnits';
import { useNotifications } from '../../hooks/useNotifications';
import { makeNotification } from '../../utils/notificationFactory';

const experienceLevelOrder: Record<string, number> = { beginner: 0, intermediate: 1, experienced: 2, advanced: 3 };

/** Extract a numeric grade for sorting: "8th" → 8, "10th" → 10, "12" → 12.
 *  Non-numeric grades (masters, alumni, etc.) sort after all numeric grades. */
function gradeRank(grade: string | undefined | null): number {
  if (!grade) return 9999;
  const num = parseInt(grade, 10);
  if (!isNaN(num)) return num;
  // Non-numeric grades — alphabetical tiebreak via large offset + charCode
  return 1000 + grade.toLowerCase().charCodeAt(0);
}

export function CoachingRoster() {
  const { userId, teamId, orgId, teams, isLoadingTeam, teamError, filterTeamId, filterTeamName } = useCoachingContext();
  const units = useMeasurementUnits();
  const { addNotification } = useNotifications();
  const isImperial = units === 'imperial';
  const navigate = useNavigate();

  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [deletingAthlete, setDeletingAthlete] = useState<CoachingAthlete | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string | 'all'>('all');
  const [selectedTier, setSelectedTier] = useState<string | 'all'>('all');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [completions, setCompletions] = useState<AssignmentCompletion[]>([]);
  const [hasAssignmentsToday, setHasAssignmentsToday] = useState(false);
  const [quickScoreAthlete, setQuickScoreAthlete] = useState<CoachingAthlete | null>(null);
  const [best2kByAthlete, setBest2kByAthlete] = useState<Record<string, number>>({});
  const [loadedOrgRubric, setLoadedOrgRubric] = useState<PerformanceTierRubricConfig | null>(null);

  // Inline editing: which cell is being edited?  { athleteId, field }
  const [editingCell, setEditingCell] = useState<{ athleteId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editValue2, setEditValue2] = useState(''); // for ft/in (second field)
  const editRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Mobile card expand/collapse
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleCardExpand = useCallback((athleteId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(athleteId)) next.delete(athleteId); else next.add(athleteId);
      return next;
    });
  }, []);

  // Column sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Team transfer
  const [transferringAthlete, setTransferringAthlete] = useState<CoachingAthlete | null>(null);

  // Notes drawer
  const [notesDrawerAthlete, setNotesDrawerAthlete] = useState<CoachingAthlete | null>(null);
  const [noteCountsByAthlete, setNoteCountsByAthlete] = useState<Record<string, number>>({});

  // Sibling teams in the same org (for transfers)
  const currentTeamInfo = teams.find((t) => t.team_id === teamId);
  const siblingTeams = currentTeamInfo?.org_id
    ? teams.filter((t) => t.org_id === currentTeamInfo.org_id && t.team_id !== teamId)
    : [];
  const canTransfer = siblingTeams.length > 0;

  // Org-wide mode: filterTeamId is null and coach is in an org
  const isOrgWide = filterTeamId === null && !!orgId;
  // The team ID to use for single-team queries (filter or home team)
  const effectiveTeamId = filterTeamId ?? teamId;
  const orgRubric = userId && orgId ? loadedOrgRubric : null;

  const refresh2kBenchmarks = useCallback(async () => {
    if (!effectiveTeamId) return;
    try {
      const scores = await getErgScores(effectiveTeamId);
      setBest2kByAthlete(buildBest2kByAthlete(scores));
    } catch {
      // non-critical
    }
  }, [effectiveTeamId]);

  const refreshCompletions = useCallback(async (loadedAthletes: CoachingAthlete[]) => {
    if (!effectiveTeamId) return;
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const comps = await getAssignmentCompletions(effectiveTeamId, todayStr, loadedAthletes, orgId ?? undefined);
      setCompletions(comps);
      setHasAssignmentsToday(comps.length > 0);
    } catch {
      // non-critical
    }
  }, [effectiveTeamId, orgId]);

  const refreshNoteCounts = useCallback(async () => {
    try {
      const counts = isOrgWide && orgId
        ? await getCoachNoteCountsByOrg(orgId)
        : effectiveTeamId
          ? await getCoachNoteCountsByTeam(effectiveTeamId)
          : {};
      setNoteCountsByAthlete(counts);
    } catch {
      // non-critical
    }
  }, [isOrgWide, orgId, effectiveTeamId]);

  useEffect(() => {
    if (!userId || !orgId) return;
    getOrganizationsForUser(userId)
      .then((organizations) => {
        const org = organizations.find((o) => o.id === orgId);
        setLoadedOrgRubric(org?.performance_tier_rubric ?? null);
      })
      .catch(() => setLoadedOrgRubric(null));
  }, [userId, orgId]);

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;

    const fetchAthletes = isOrgWide && orgId
      ? () => getOrgAthletesWithTeam(orgId)
      : () => getAthletes(effectiveTeamId);

    fetchAthletes()
      .then(async (loadedAthletes) => {
        setAthletes(loadedAthletes);
        await Promise.all([
          refreshCompletions(loadedAthletes),
          refresh2kBenchmarks(),
          refreshNoteCounts(),
        ]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load athletes'))
      .finally(() => setIsLoading(false));
  }, [teamId, effectiveTeamId, isLoadingTeam, isOrgWide, orgId, refreshCompletions, refresh2kBenchmarks, refreshNoteCounts]);

  const refreshAthletes = useCallback(async () => {
    if (teamId) {
      try {
        const loadedAthletes = isOrgWide && orgId
          ? await getOrgAthletesWithTeam(orgId)
          : await getAthletes(effectiveTeamId);
        setAthletes(loadedAthletes);
        await Promise.all([
          refreshCompletions(loadedAthletes),
          refresh2kBenchmarks(),
          refreshNoteCounts(),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh');
      }
    }
  }, [teamId, isOrgWide, orgId, effectiveTeamId, refreshCompletions, refresh2kBenchmarks, refreshNoteCounts]);

  const handleSave = async (data: Partial<CoachingAthlete> & { squad?: string; performance_tier?: CoachingAthlete['performance_tier'] }) => {
    if (!teamId) return;
    try {
      await createAthlete(teamId, userId, {
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        grade: data.grade,
        experience_level: data.experience_level,
        side: data.side,
        height_cm: data.height_cm,
        weight_kg: data.weight_kg,
        notes: data.notes,
      }, data.squad || null, data.performance_tier ?? null);
      const athleteName = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || 'Athlete';
      addNotification(makeNotification({
        type: 'athlete_joined',
        title: 'Athlete added',
        body: `${athleteName} was added to the roster.`,
        href: '/team-management/roster',
      }));
      setIsAdding(false);
      await refreshAthletes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save athlete');
    }
  };

  // ── Inline cell editing ──────────────────────────────────────────────────

  const startEditing = useCallback((athleteId: string, field: string) => {
    const a = athletes.find(x => x.id === athleteId);
    if (!a) return;

    setEditingCell({ athleteId, field });

    if (field === 'height') {
      if (isImperial) {
        const ftIn = a.height_cm ? cmToFtIn(a.height_cm) : null;
        setEditValue(ftIn?.feet?.toString() ?? '');
        setEditValue2(ftIn?.inches?.toString() ?? '');
      } else {
        setEditValue(a.height_cm?.toString() ?? '');
        setEditValue2('');
      }
    } else if (field === 'weight') {
      setEditValue(
        a.weight_kg
          ? (isImperial ? kgToLbs(a.weight_kg).toString() : a.weight_kg.toString())
          : ''
      );
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
    } else if (field === 'performance_tier') {
      setEditValue(a.performance_tier ?? '');
    } else if (field === 'notes') {
      setEditValue(a.notes ?? '');
    }

    // Focus after render
    setTimeout(() => editRef.current?.focus(), 0);
  }, [athletes, isImperial]);

  const commitEdit = useCallback(async (valueOverride?: string) => {
    if (!editingCell) return;
    const { athleteId, field } = editingCell;
    const a = athletes.find(x => x.id === athleteId);
    if (!a) { setEditingCell(null); return; }
    const resolvedValue = valueOverride ?? editValue;

    setEditingCell(null);

    try {
      if (field === 'squad') {
        const trimmed = resolvedValue.trim() || null;
        if (trimmed !== (a.squad ?? null)) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, squad: trimmed } : x));
          await updateAthleteSquad(a.team_id ?? effectiveTeamId, athleteId, trimmed);
        }
      } else if (field === 'performance_tier') {
        const val: CoachingAthlete['performance_tier'] = (resolvedValue.trim() || null) as CoachingAthlete['performance_tier'];
        if (val !== (a.performance_tier ?? null)) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, performance_tier: val } : x));
          await updateAthletePerformanceTier(a.team_id ?? effectiveTeamId, athleteId, val ?? null);
        }
      } else if (field === 'height') {
        const cm = isImperial
          ? ((resolvedValue || editValue2)
            ? ftInToCm(Number(resolvedValue) || 0, Number(editValue2) || 0)
            : null)
          : (resolvedValue ? Number(resolvedValue) : null);
        if (cm !== a.height_cm) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, height_cm: cm } : x));
          await updateAthlete(athleteId, { height_cm: cm });
        }
      } else if (field === 'weight') {
        const kg = resolvedValue
          ? (isImperial ? lbsToKg(Number(resolvedValue)) : Number(resolvedValue))
          : null;
        if (kg !== a.weight_kg) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, weight_kg: kg } : x));
          await updateAthlete(athleteId, { weight_kg: kg });
        }
      } else if (field === 'first_name' || field === 'last_name' || field === 'grade' || field === 'notes') {
        const val = resolvedValue.trim() || (field === 'first_name' || field === 'last_name' ? a[field] : undefined);
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
        const val = resolvedValue as CoachingAthlete['side'];
        if (val !== a.side) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, side: val } : x));
          await updateAthlete(athleteId, { side: val });
        }
      } else if (field === 'experience_level') {
        const val = resolvedValue as CoachingAthlete['experience_level'];
        if (val !== a.experience_level) {
          setAthletes(prev => prev.map(x => x.id === athleteId ? { ...x, experience_level: val } : x));
          await updateAthlete(athleteId, { experience_level: val });
        }
      }
    } catch {
      // Revert on failure
      await refreshAthletes();
    }
  }, [editingCell, editValue, editValue2, athletes, effectiveTeamId, refreshAthletes, isImperial]);

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditingCell(null); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAthlete(id);
      setDeletingAthlete(null);
      await refreshAthletes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete athlete');
    }
  };

  const handleTransfer = async (athlete: CoachingAthlete, toTeamId: string) => {
    const destTeam = siblingTeams.find((t) => t.team_id === toTeamId);
    try {
      await transferAthlete(athlete.id, athlete.team_id ?? effectiveTeamId, toTeamId);
      // Remove from local state immediately
      setAthletes((prev) => prev.filter((a) => a.id !== athlete.id));
      setTransferringAthlete(null);
      toast.success(`${athlete.name} moved to ${destTeam?.team_name ?? 'team'}`);
    } catch {
      toast.error('Failed to transfer athlete');
    }
  };

  // Derived: distinct squad names + filtered list
  const squads = [...new Set(athletes.map((a) => a.squad).filter((s): s is string => !!s))].sort();

  // Compute effective tier for each athlete (computed benchmark tier if available, else manual)
  const effectiveTierByAthlete = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const a of athletes) {
      const best2k = best2kByAthlete[a.id] ?? null;
      const benchmarkTier = deriveBenchmarkTier(a.squad ?? null, best2k, orgRubric);
      map[a.id] = benchmarkTier ?? a.performance_tier ?? null;
    }
    return map;
  }, [athletes, best2kByAthlete, orgRubric]);

  // Distinct tiers present in the current roster
  const activeTiers = useMemo(() => {
    const tierSet = new Set<string>();
    for (const tier of Object.values(effectiveTierByAthlete)) {
      if (tier) tierSet.add(tier);
    }
    return [...tierSet].sort((a, b) => (TIER_SORT_ORDER[a] ?? 99) - (TIER_SORT_ORDER[b] ?? 99));
  }, [effectiveTierByAthlete]);

  // Build a set of athlete IDs that are "missing" (have at least one incomplete assignment today)
  const missingAthleteIds = new Set<string>();
  for (const comp of completions) {
    for (const m of comp.missing_athletes) missingAthleteIds.add(m.id);
  }

  const getMissingCompletionsForAthlete = (athleteId: string): AssignmentCompletion[] =>
    completions.filter((comp) => comp.missing_athletes.some((m) => m.id === athleteId));

  let filteredAthletes = selectedSquad === 'all' ? athletes : athletes.filter((a) => a.squad === selectedSquad);
  if (selectedTier !== 'all') {
    filteredAthletes = filteredAthletes.filter((a) => effectiveTierByAthlete[a.id] === selectedTier);
  }
  if (showMissingOnly && hasAssignmentsToday) {
    filteredAthletes = filteredAthletes.filter((a) => missingAthleteIds.has(a.id));
  }

  // ── Column sorting ──────────────────────────────────────────────────────

  const sortedAthletes = useMemo(() => {
    if (!sortColumn) return filteredAthletes;
    return [...filteredAthletes].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'first_name': cmp = a.first_name.localeCompare(b.first_name); break;
        case 'last_name': cmp = a.last_name.localeCompare(b.last_name); break;
        case 'team_name': cmp = (a.team_name ?? '').localeCompare(b.team_name ?? ''); break;
        case 'squad': cmp = (a.squad ?? '').localeCompare(b.squad ?? ''); break;
        case 'grade': cmp = gradeRank(a.grade) - gradeRank(b.grade); break;
        case 'side': cmp = (a.side ?? '').localeCompare(b.side ?? ''); break;
        case 'experience_level':
          cmp = (experienceLevelOrder[a.experience_level ?? ''] ?? -1) - (experienceLevelOrder[b.experience_level ?? ''] ?? -1);
          break;
        case 'performance_tier':
          cmp = (TIER_SORT_ORDER[effectiveTierByAthlete[a.id] ?? ''] ?? -1) - (TIER_SORT_ORDER[effectiveTierByAthlete[b.id] ?? ''] ?? -1);
          break;
        case 'height': cmp = (a.height_cm ?? 0) - (b.height_cm ?? 0); break;
        case 'weight': cmp = (a.weight_kg ?? 0) - (b.weight_kg ?? 0); break;
        default: return 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredAthletes, sortColumn, sortDirection, effectiveTierByAthlete]);

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 text-neutral-600 ml-1 inline" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-400 ml-1 inline" />
      : <ChevronDown className="w-3 h-3 text-indigo-400 ml-1 inline" />;
  };

  const openAthleteDetail = useCallback((athleteId: string) => {
    navigate(`/team-management/roster/${athleteId}`);
  }, [navigate]);

  const handleEditableCellClick = useCallback((athleteId: string, field: string) => {
    if (!editMode) return;
    startEditing(athleteId, field);
  }, [editMode, startEditing]);

// Helper: is a given cell currently being edited?
  const isEditing = (athleteId: string, field: string) =>
    editingCell?.athleteId === athleteId && editingCell?.field === field;

  // Shared cell CSS
  const cellBase = 'px-3 py-2.5 text-sm whitespace-nowrap';
  const editableCellClass = editMode
    ? `${cellBase} cursor-pointer hover:bg-neutral-800/60 transition-colors`
    : cellBase;
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

  // Side abbreviation for mobile badges
  const sideAbbrev = (side?: string | null): string => {
    const map: Record<string, string> = { port: 'P', starboard: 'S', both: 'B', coxswain: 'Cox' };
    return map[side ?? ''] ?? '';
  };
  const sideBadgeClass = (side?: string | null): string => {
    const map: Record<string, string> = {
      port: 'bg-red-900/30 text-red-400',
      starboard: 'bg-emerald-900/30 text-emerald-400',
      both: 'bg-neutral-800 text-neutral-400',
      coxswain: 'bg-amber-900/30 text-amber-400',
    };
    return map[side ?? ''] ?? 'bg-neutral-800 text-neutral-500';
  };

  return (
    <>
    <CoachingNav />
    <div className="px-4 sm:px-6 py-3 sm:py-6 max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {isOrgWide ? 'Program Roster' : 'Team Roster'}
            </h1>
            <p className="text-neutral-400 mt-1 text-sm">
              {filteredAthletes.length}{selectedSquad !== 'all' ? ` in ${selectedSquad}` : ''}{selectedTier !== 'all' ? ` · ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} tier` : ''} athlete{filteredAthletes.length !== 1 ? 's' : ''}{selectedSquad !== 'all' || selectedTier !== 'all' ? ` (${athletes.length} total)` : ''}
              {isOrgWide && <span className="text-neutral-600"> · All Teams</span>}
              {!isOrgWide && filterTeamName && <span className="text-neutral-600"> · {filterTeamName}</span>}
              <span className="text-neutral-600 ml-2 hidden sm:inline">
                · {editMode ? 'Edit mode is on. Click fields to edit.' : 'Click an athlete name to open their detail page.'}
              </span>
              <span className="text-neutral-600 ml-2 sm:hidden">
                · {editMode ? 'Edit mode on' : 'Tap a name for detail'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (editMode) {
                  setEditingCell(null);
                }
                setEditMode((current) => !current);
              }}
              className={`px-2 sm:px-3 py-2 rounded-lg text-sm transition-colors ${
                editMode
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {editMode ? 'Editing On' : 'Edit Mode'}
            </button>
            {squads.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-neutral-500 hidden sm:block" />
                <select
                  value={selectedSquad}
                  onChange={(e) => setSelectedSquad(e.target.value)}
                  className="px-2 sm:px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  aria-label="Filter by squad"
                >
                  <option value="all">All Squads</option>
                  {squads.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            {activeTiers.length > 1 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="px-2 sm:px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  aria-label="Filter by performance tier"
                >
                  <option value="all">All Tiers</option>
                  {activeTiers.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
            {hasAssignmentsToday && (
              <button
                onClick={() => setShowMissingOnly(!showMissingOnly)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm transition-colors ${
                  showMissingOnly
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{showMissingOnly ? `Missing (${missingAthleteIds.size})` : 'Show Missing'}</span>
                <span className="sm:hidden">{showMissingOnly ? missingAthleteIds.size : 'Missing'}</span>
              </button>
            )}
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Athlete</span>
              <span className="sm:hidden">Add</span>
            </button>
            <button
              onClick={() => setShowBulkAdd(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Bulk Add</span>
              <span className="sm:hidden">Bulk</span>
            </button>
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
                    performance_tier: a.performance_tier ?? '',
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
                    { key: 'performance_tier', label: 'Performance Tier' },
                    { key: 'height_cm', label: 'Height (cm)' },
                    { key: 'weight_kg', label: 'Weight (kg)' },
                    { key: 'notes', label: 'Notes' },
                  ]
                );
              }}
              disabled={filteredAthletes.length === 0}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 text-sm"
              title="Export roster to CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={() => {
                const columns = ['Name', 'Squad', 'Grade', 'Side', 'Experience', 'Performance Tier', 'Height (cm)', 'Weight (kg)'];
                const rows = filteredAthletes.map((a) => [
                  a.name,
                  a.squad ?? '',
                  a.grade ?? '',
                  a.side ?? '',
                  a.experience_level ?? '',
                  a.performance_tier ?? '',
                  a.height_cm ?? '',
                  a.weight_kg ?? '',
                ]);
                exportToPdf({
                  filename: `roster-${format(new Date(), 'yyyy-MM-dd')}`,
                  title: 'Team Roster',
                  subtitle: `Exported ${format(new Date(), 'PPP')} · ${filteredAthletes.length} athletes`,
                  columns,
                  rows,
                  orientation: 'landscape',
                });
              }}
              disabled={filteredAthletes.length === 0}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 text-sm"
              title="Export roster to PDF"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={() => {
                const columns = ['Name', 'Squad', 'Grade', 'Side', 'Experience', 'Performance Tier', 'Height (cm)', 'Weight (kg)'];
                const rows = filteredAthletes.map((a) => [
                  a.name,
                  a.squad ?? '',
                  a.grade ?? '',
                  a.side ?? '',
                  a.experience_level ?? '',
                  a.performance_tier ?? '',
                  a.height_cm as string | number | null,
                  a.weight_kg as string | number | null,
                ]);
                exportToExcel({
                  filename: `roster-${format(new Date(), 'yyyy-MM-dd')}`,
                  sheets: [{ name: 'Roster', columns, rows }],
                });
              }}
              disabled={filteredAthletes.length === 0}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 text-sm"
              title="Export roster to Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
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

      {/* ── Inline-Editable Roster ──────────────────────────────────── */}
      {!isLoading && !error && filteredAthletes.length > 0 && (
        <>
        {/* ── Mobile Card Layout (< md) ─────────────────────────────── */}
        <div className="md:hidden space-y-3">
          {sortedAthletes.map((athlete, index) => {
            const isExpanded = expandedCards.has(athlete.id);
            const noteCount = noteCountsByAthlete[athlete.id] ?? 0;
            return (
            <div key={athlete.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              {/* Name row + actions */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-neutral-500 font-mono text-xs min-w-[1.5rem]">{index + 1}.</span>
                    <span
                      className={`text-white font-semibold text-base ${editMode ? 'cursor-pointer' : 'cursor-pointer hover:text-indigo-300 transition-colors'}`}
                      onClick={() => editMode ? startEditing(athlete.id, 'first_name') : openAthleteDetail(athlete.id)}
                    >
                      {isEditing(athlete.id, 'first_name') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${inputClass} w-24`} title="First name" />
                      ) : athlete.first_name}
                    </span>
                    <span
                      className={`text-white font-semibold text-base ${editMode ? 'cursor-pointer' : 'cursor-pointer hover:text-indigo-300 transition-colors'}`}
                      onClick={() => editMode ? startEditing(athlete.id, 'last_name') : openAthleteDetail(athlete.id)}
                    >
                      {isEditing(athlete.id, 'last_name') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${inputClass} w-24`} title="Last name" />
                      ) : athlete.last_name}
                    </span>
                  </div>
                  {/* Badges row: side, squad, tier */}
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {/* Side badge (abbreviated) */}
                    {athlete.side ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sideBadgeClass(athlete.side)} ${editMode ? 'cursor-pointer' : ''}`}
                        onClick={() => handleEditableCellClick(athlete.id, 'side')}>
                        {isEditing(athlete.id, 'side') ? (
                          <select ref={r => { editRef.current = r; }} value={editValue} onChange={e => { setEditValue(e.target.value); commitEdit(e.target.value); }}
                            onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${selectClass} w-24 text-xs`} title="Side">
                            <option value="port">Port</option>
                            <option value="starboard">Starboard</option>
                            <option value="coxswain">Coxswain</option>
                            <option value="both">Both</option>
                          </select>
                        ) : sideAbbrev(athlete.side)}
                      </span>
                    ) : editMode ? (
                      <span className="px-2 py-0.5 rounded-full text-xs text-neutral-600 bg-neutral-800 cursor-pointer"
                        onClick={() => handleEditableCellClick(athlete.id, 'side')}>
                        {isEditing(athlete.id, 'side') ? (
                          <select ref={r => { editRef.current = r; }} value={editValue} onChange={e => { setEditValue(e.target.value); commitEdit(e.target.value); }}
                            onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${selectClass} w-24 text-xs`} title="Side">
                            <option value="port">Port</option>
                            <option value="starboard">Starboard</option>
                            <option value="coxswain">Coxswain</option>
                            <option value="both">Both</option>
                          </select>
                        ) : 'Side'}
                      </span>
                    ) : null}
                    {/* Squad badge */}
                    <span className={`${editMode ? 'cursor-pointer' : ''}`} onClick={() => handleEditableCellClick(athlete.id, 'squad')}>
                      {isEditing(athlete.id, 'squad') ? (
                        <>
                          <input ref={r => { editRef.current = r; }} type="text" list={`sq-m-${athlete.id}`} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-28`} title="Squad" />
                          <datalist id={`sq-m-${athlete.id}`}>
                            {squads.map(s => <option key={s} value={s} />)}
                          </datalist>
                        </>
                      ) : athlete.squad ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-900/30 text-cyan-400">{athlete.squad}</span>
                      ) : editMode ? (
                        <span className="px-2 py-0.5 rounded-full text-xs text-neutral-600 bg-neutral-800">Squad</span>
                      ) : null}
                    </span>
                    {/* Performance tier badge */}
                    {(() => {
                      const best2k = best2kByAthlete[athlete.id] ?? null;
                      const benchmarkTier = deriveBenchmarkTier(athlete.squad ?? null, best2k, orgRubric);
                      if (benchmarkTier) {
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${benchmarkTierBadgeClass(benchmarkTier)}`}>
                            {benchmarkTierLabel(benchmarkTier)}
                          </span>
                        );
                      }
                      if (athlete.performance_tier) {
                        return (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/30 text-indigo-300">
                            {athlete.performance_tier.charAt(0).toUpperCase() + athlete.performance_tier.slice(1)}
                          </span>
                        );
                      }
                      return null;
                    })()}
                    {/* Experience badge */}
                    {athlete.experience_level && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${expBadge(athlete.experience_level)} ${editMode ? 'cursor-pointer' : ''}`}
                        onClick={() => handleEditableCellClick(athlete.id, 'experience_level')}>
                        {isEditing(athlete.id, 'experience_level') ? (
                          <select ref={r => { editRef.current = r; }} value={editValue} onChange={e => { setEditValue(e.target.value); commitEdit(e.target.value); }}
                            onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${selectClass} w-28 text-xs`} title="Experience level">
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="experienced">Experienced</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        ) : (
                          athlete.experience_level.charAt(0).toUpperCase() + athlete.experience_level.slice(1)
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {/* Always-visible actions on mobile */}
                <div className="flex items-center gap-1 ml-2">
                  {(() => {
                    const hasNotes = noteCount > 0;
                    return (
                      <button
                        onClick={() => setNotesDrawerAthlete(athlete)}
                        className="inline-flex items-center gap-0.5 p-2 rounded-lg hover:bg-neutral-700 transition-colors"
                        aria-label={hasNotes ? `${noteCount} notes` : 'Add note'}
                        title={hasNotes ? `${noteCount} note${noteCount !== 1 ? 's' : ''}` : 'Add note'}
                      >
                        <MessageSquare className={`w-4 h-4 ${hasNotes ? 'text-indigo-400' : 'text-neutral-400'}`} />
                        {hasNotes && (
                          <span className="text-[10px] font-medium text-indigo-400 leading-none -mt-2">
                            {noteCount}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => navigate(`/team-management/roster/${athlete.id}`)}
                    className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
                    aria-label="View detail"
                    title="View detail"
                  >
                    <ExternalLink className="w-4 h-4 text-neutral-400" />
                  </button>
                  <button
                    onClick={() => setQuickScoreAthlete(athlete)}
                    className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
                    aria-label="Add score"
                    title="Add score"
                  >
                    <Plus className="w-4 h-4 text-neutral-400" />
                  </button>
                  {canTransfer && (
                    <button
                      onClick={() => setTransferringAthlete(athlete)}
                      className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
                      aria-label="Move to another team"
                      title="Move to another team"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-neutral-400" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeletingAthlete(athlete)}
                    className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
                    aria-label="Delete athlete"
                    title="Delete athlete"
                  >
                    <Trash2 className="w-4 h-4 text-neutral-500" />
                  </button>
                </div>
              </div>

              {/* Today's status (if applicable) */}
              {hasAssignmentsToday && (
                <div>
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
                </div>
              )}

              {/* Expand/collapse toggle */}
              <button
                type="button"
                onClick={() => toggleCardExpand(athlete.id)}
                className="flex items-center gap-1.5 w-full py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors min-h-[44px]"
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {isExpanded ? 'Less' : 'More'}
                {!isExpanded && (noteCount > 0 || athlete.height_cm || athlete.weight_kg || athlete.grade) && (
                  <span className="text-neutral-600 ml-1">
                    ({[
                      athlete.grade && `Gr ${athlete.grade}`,
                      athlete.height_cm && (isImperial ? cmToFtIn(athlete.height_cm).display : `${athlete.height_cm}cm`),
                      athlete.weight_kg && (isImperial ? `${kgToLbs(athlete.weight_kg)}lbs` : `${athlete.weight_kg}kg`),
                      noteCount > 0 && `${noteCount} note${noteCount !== 1 ? 's' : ''}`,
                    ].filter(Boolean).join(', ')})
                  </span>
                )}
              </button>

              {/* Expandable detail fields */}
              {isExpanded && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-neutral-800 pt-3">
                  {/* Grade */}
                  <div className={editMode ? 'cursor-pointer min-h-[44px]' : 'min-h-[44px]'} onClick={() => handleEditableCellClick(athlete.id, 'grade')}>
                    <span className="text-neutral-500 text-xs">Grade</span>
                    <div>
                      {isEditing(athlete.id, 'grade') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${inputClass} w-full`} title="Grade" />
                      ) : (
                        <span className="text-neutral-300">{athlete.grade || <span className="text-neutral-600">—</span>}</span>
                      )}
                    </div>
                  </div>

                  {/* Notes count */}
                  <div className="min-h-[44px]">
                    <span className="text-neutral-500 text-xs">Notes</span>
                    <div>
                      <button
                        onClick={() => setNotesDrawerAthlete(athlete)}
                        className="inline-flex items-center gap-1 text-sm hover:text-indigo-300 transition-colors min-h-[28px]"
                      >
                        <MessageSquare className={`w-3.5 h-3.5 ${noteCount > 0 ? 'text-indigo-400' : 'text-neutral-600'}`} />
                        <span className={noteCount > 0 ? 'text-indigo-400' : 'text-neutral-600'}>
                          {noteCount > 0 ? `${noteCount} note${noteCount !== 1 ? 's' : ''}` : 'None'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Height */}
                  <div className={editMode ? 'cursor-pointer min-h-[44px]' : 'min-h-[44px]'} onClick={() => handleEditableCellClick(athlete.id, 'height')}>
                    <span className="text-neutral-500 text-xs">Height</span>
                    <div>
                      {isEditing(athlete.id, 'height') ? isImperial ? (
                        <div className="flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                          onBlur={e => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              commitEdit();
                            }
                          }}
                        >
                          <input ref={r => { editRef.current = r; }} type="number" min={0} max={8} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-14`} placeholder="ft" title="Height feet" />
                          <span className="text-neutral-500">'</span>
                          <input type="number" min={0} max={11} value={editValue2}
                            onChange={e => setEditValue2(e.target.value)} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-14`} placeholder="in" title="Height inches" />
                          <span className="text-neutral-500">"</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input ref={r => { editRef.current = r; }} type="number" min={0} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-16`} placeholder="cm" title="Height in centimeters" />
                          <span className="text-neutral-500 text-xs">cm</span>
                        </div>
                      ) : athlete.height_cm ? (
                        <span className="text-neutral-300">{isImperial ? cmToFtIn(athlete.height_cm).display : `${athlete.height_cm} cm`}</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </div>
                  </div>

                  {/* Weight */}
                  <div className={editMode ? 'cursor-pointer min-h-[44px]' : 'min-h-[44px]'} onClick={() => handleEditableCellClick(athlete.id, 'weight')}>
                    <span className="text-neutral-500 text-xs">Weight</span>
                    <div>
                      {isEditing(athlete.id, 'weight') ? (
                        <div className="flex items-center gap-1">
                          <input ref={r => { editRef.current = r; }} type="number" min={0} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-16`} title={isImperial ? 'Weight in lbs' : 'Weight in kg'} />
                          <span className="text-neutral-500 text-xs">{isImperial ? 'lbs' : 'kg'}</span>
                        </div>
                      ) : athlete.weight_kg ? (
                        <span className="text-neutral-300">{isImperial ? `${kgToLbs(athlete.weight_kg)} lbs` : `${athlete.weight_kg} kg`}</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </div>
                  </div>

                  {/* Performance tier detail (2k time + criteria) in expanded view */}
                  {(() => {
                    const best2k = best2kByAthlete[athlete.id] ?? null;
                    const benchmarkTier = deriveBenchmarkTier(athlete.squad ?? null, best2k, orgRubric);
                    const criteria = benchmarkCriteriaIndicator(athlete.squad ?? null, best2k, 0.02, orgRubric);
                    if (best2k == null && !criteria) return null;
                    return (
                      <div className="col-span-2">
                        <span className="text-neutral-500 text-xs">Performance Detail</span>
                        <div className="space-y-0.5">
                          {best2k != null && <div className="text-xs text-neutral-400">Best 2k: {formatErgTime(best2k)}</div>}
                          {criteria && <div className={`text-xs ${criteria.className}`}>{criteria.text}</div>}
                          {!benchmarkTier && athlete.performance_tier == null && best2k != null && (
                            <div className="text-xs text-neutral-600">Needs squad mapping for tier</div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            );
          })}
        </div>

        {/* ── Desktop Table (>= md) ─────────────────────────────────── */}
        <div className="hidden md:block bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80">
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider w-10">#</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('first_name')}>First {renderSortIcon('first_name')}</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('last_name')}>Last {renderSortIcon('last_name')}</th>
                  {isOrgWide && (
                    <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('team_name')}>Team {renderSortIcon('team_name')}</th>
                  )}
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('squad')}>Squad {renderSortIcon('squad')}</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('grade')}>Grade {renderSortIcon('grade')}</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('side')}>Side {renderSortIcon('side')}</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('experience_level')}>Experience {renderSortIcon('experience_level')}</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('performance_tier')}>Tier {renderSortIcon('performance_tier')}</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('height')}>Height {renderSortIcon('height')}</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-300 select-none" onClick={() => toggleSort('weight')}>Weight {renderSortIcon('weight')}</th>
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider w-14 text-center">Notes</th>
                  {hasAssignmentsToday && <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Today</th>}
                  <th className="px-3 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {sortedAthletes.map((athlete, index) => (
                  <tr key={athlete.id} className="hover:bg-neutral-800/30 transition-colors group">
                    {/* Row number */}
                    <td className={`${cellBase} text-neutral-500 font-mono text-xs`}>{index + 1}</td>
                    {/* First Name */}
                    <td className={editableCellClass} onClick={() => editMode ? startEditing(athlete.id, 'first_name') : openAthleteDetail(athlete.id)}>
                      {isEditing(athlete.id, 'first_name') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${inputClass} w-24`} title="First name" />
                      ) : (
                        <span className={`text-white font-medium ${editMode ? '' : 'hover:text-indigo-300 transition-colors'}`}>{athlete.first_name}</span>
                      )}
                    </td>

                    {/* Last Name */}
                    <td className={editableCellClass} onClick={() => editMode ? startEditing(athlete.id, 'last_name') : openAthleteDetail(athlete.id)}>
                      {isEditing(athlete.id, 'last_name') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${inputClass} w-24`} title="Last name" />
                      ) : (
                        <span className={`text-white font-medium ${editMode ? '' : 'hover:text-indigo-300 transition-colors'}`}>{athlete.last_name}</span>
                      )}
                    </td>

                    {/* Team (org-wide mode only) */}
                    {isOrgWide && (
                      <td className={`${cellBase} text-neutral-400 text-xs`}>
                        {athlete.team_name ?? '—'}
                      </td>
                    )}

                    {/* Squad */}
                    <td className={editableCellClass} onClick={() => handleEditableCellClick(athlete.id, 'squad')}>
                      {isEditing(athlete.id, 'squad') ? (
                        <>
                          <input ref={r => { editRef.current = r; }} type="text" list={`sq-${athlete.id}`} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-24`} title="Squad" />
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
                    <td className={editableCellClass} onClick={() => handleEditableCellClick(athlete.id, 'grade')}>
                      {isEditing(athlete.id, 'grade') ? (
                        <input ref={r => { editRef.current = r; }} type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${inputClass} w-16`} title="Grade" />
                      ) : (
                        <span className="text-neutral-300">{athlete.grade || <span className="text-neutral-600">—</span>}</span>
                      )}
                    </td>

                    {/* Side */}
                    <td className={editableCellClass} onClick={() => handleEditableCellClick(athlete.id, 'side')}>
                      {isEditing(athlete.id, 'side') ? (
                        <select ref={r => { editRef.current = r; }} value={editValue} onChange={e => { setEditValue(e.target.value); commitEdit(e.target.value); }}
                          onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${selectClass} w-28`} title="Side">
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
                    <td className={editableCellClass} onClick={() => handleEditableCellClick(athlete.id, 'experience_level')}>
                      {isEditing(athlete.id, 'experience_level') ? (
                        <select ref={r => { editRef.current = r; }} value={editValue} onChange={e => { setEditValue(e.target.value); commitEdit(e.target.value); }}
                          onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown} className={`${selectClass} w-32`} title="Experience level">
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

                    {/* Performance Tier */}
                    <td className={cellBase}>
                      <div className="space-y-1">
                        {(() => {
                          const best2k = best2kByAthlete[athlete.id] ?? null;
                          const benchmarkTier = deriveBenchmarkTier(athlete.squad ?? null, best2k, orgRubric);
                          const criteria = benchmarkCriteriaIndicator(athlete.squad ?? null, best2k, 0.02, orgRubric);
                          if (!benchmarkTier && !athlete.performance_tier && best2k == null) return <span className="text-neutral-600">—</span>;
                          return (
                            <>
                                {benchmarkTier ? (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${benchmarkTierBadgeClass(benchmarkTier)}`}>
                                    {benchmarkTierLabel(benchmarkTier)}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/30 text-indigo-300">
                                    {athlete.performance_tier
                                      ? `${athlete.performance_tier.charAt(0).toUpperCase()}${athlete.performance_tier.slice(1)}`
                                      : 'Needs squad mapping'}
                                  </span>
                                )}
                              {best2k != null && <div className="text-[10px] text-neutral-500">Best 2k: {formatErgTime(best2k)}</div>}
                              {criteria && <div className={`text-[10px] ${criteria.className}`}>{criteria.text}</div>}
                            </>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Height (ft/in) */}
                    <td className={editableCellClass} onClick={() => handleEditableCellClick(athlete.id, 'height')}>
                      {isEditing(athlete.id, 'height') ? isImperial ? (
                        <div className="flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                          onBlur={e => {
                            // Only commit when focus leaves the entire container (not moving between ft/in inputs)
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              commitEdit();
                            }
                          }}
                        >
                          <input ref={r => { editRef.current = r; }} type="number" min={0} max={8} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-14`} placeholder="ft" title="Height feet" />
                          <span className="text-neutral-500">'</span>
                          <input type="number" min={0} max={11} value={editValue2}
                            onChange={e => setEditValue2(e.target.value)} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-14`} placeholder="in" title="Height inches" />
                          <span className="text-neutral-500">"</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input ref={r => { editRef.current = r; }} type="number" min={0} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-16`} placeholder="cm" title="Height in centimeters" />
                          <span className="text-neutral-500 text-xs">cm</span>
                        </div>
                      ) : athlete.height_cm ? (
                        <span className="text-neutral-300">{isImperial ? cmToFtIn(athlete.height_cm).display : `${athlete.height_cm} cm`}</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Weight (lbs) */}
                    <td className={editableCellClass} onClick={() => handleEditableCellClick(athlete.id, 'weight')}>
                      {isEditing(athlete.id, 'weight') ? (
                        <div className="flex items-center gap-1">
                          <input ref={r => { editRef.current = r; }} type="number" min={0} value={editValue}
                            onChange={e => setEditValue(e.target.value)} onBlur={() => commitEdit()} onKeyDown={handleCellKeyDown}
                            className={`${inputClass} w-16`} title={isImperial ? 'Weight in lbs' : 'Weight in kg'} />
                          <span className="text-neutral-500 text-xs">{isImperial ? 'lbs' : 'kg'}</span>
                        </div>
                      ) : athlete.weight_kg ? (
                        <span className="text-neutral-300">{isImperial ? `${kgToLbs(athlete.weight_kg)} lbs` : `${athlete.weight_kg} kg`}</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Notes indicator */}
                    <td className={`${cellBase} text-center`}>
                      {(() => {
                        const count = noteCountsByAthlete[athlete.id] ?? 0;
                        const hasNotes = count > 0;
                        return (
                          <button
                            onClick={() => setNotesDrawerAthlete(athlete)}
                            className={`inline-flex items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                              hasNotes
                                ? 'hover:bg-neutral-700/60'
                                : 'hover:bg-neutral-700 opacity-30 hover:opacity-80'
                            }`}
                            aria-label={`${hasNotes ? `${count} notes for` : 'Add note for'} ${athlete.first_name} ${athlete.last_name}`}
                            title={hasNotes ? `${count} note${count !== 1 ? 's' : ''}` : 'Add note'}
                          >
                            <MessageSquare className={`w-3.5 h-3.5 ${hasNotes ? 'text-indigo-400' : 'text-neutral-600'}`} />
                            {hasNotes && (
                              <span className="text-[10px] font-medium text-indigo-400 leading-none -mt-2">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })()}
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
                          aria-label="View detail"
                          title="View detail"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-500 hover:text-indigo-400" />
                        </button>
                        <button
                          onClick={() => setQuickScoreAthlete(athlete)}
                          className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
                          aria-label="Add score"
                          title="Add score"
                        >
                          <Plus className="w-3.5 h-3.5 text-neutral-500 hover:text-indigo-400" />
                        </button>
                        {canTransfer && (
                          <button
                            onClick={() => setTransferringAthlete(athlete)}
                            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
                            aria-label="Move to another team"
                            title="Move to another team"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-500 hover:text-amber-400" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingAthlete(athlete)}
                          className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
                          aria-label="Delete athlete"
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
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredAthletes.length === 0 && !isAdding && (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="No athletes yet"
          description="Add athletes to your roster to get started."
          action={
            <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
              Add your first athlete
            </button>
          }
        />
      )}

      {/* Add Modal (modal only used for adding new athletes) */}
      {isAdding && (
        <AthleteEditorModal
          athlete={null}
          squads={squads}
          units={units}
          onSave={handleSave}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* Bulk Add Modal */}
      {showBulkAdd && teamId && (
        <BulkRosterModal
          teamId={teamId}
          userId={userId}
          existingSquads={squads}
          onClose={() => setShowBulkAdd(false)}
          onSaved={async (count) => {
            setShowBulkAdd(false);
            await refreshAthletes();
            toast.success(`Added ${count} athlete${count !== 1 ? 's' : ''}`);
          }}
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

      {/* Transfer Athlete Dialog */}
      {transferringAthlete && canTransfer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-900/30 rounded-lg">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Move Athlete</h2>
            </div>
            <p className="text-neutral-300 mb-4">
              Move <span className="font-semibold text-white">{transferringAthlete.name}</span> to:
            </p>
            <div className="space-y-2 mb-6">
              {siblingTeams.map((t) => (
                <button
                  key={t.team_id}
                  onClick={() => handleTransfer(transferringAthlete, t.team_id)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-neutral-700 hover:border-indigo-500 hover:bg-neutral-800 transition-colors text-white text-sm font-medium"
                >
                  {t.team_name}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setTransferringAthlete(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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

      {/* Notes Drawer */}
      <AthleteNotesDrawer
        athlete={notesDrawerAthlete}
        teamId={effectiveTeamId}
        userId={userId}
        onClose={() => setNotesDrawerAthlete(null)}
        onNoteAdded={refreshNoteCounts}
      />
    </div>
    </>
  );
}
