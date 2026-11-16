import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { CoachingNav } from "../../components/coaching/CoachingNav";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Select,
} from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { useCoachingContext } from "../../hooks/useCoachingContext";
import { getAthletes } from "../../services/coaching/coachingService";
import {
  activateTeamSeason,
  archiveTeamSeason,
  createTeamSeason,
  getSeasonRoster,
  listTeamSeasons,
  setTeamSeasonSquad,
  type SeasonRosterAthlete,
  type TeamSeason,
} from "../../services/coaching/teamSeasonService";

function failure(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";
  if (/pending|incomplete/i.test(message))
    return "Resolve incomplete assignments in the current season, then try again. Your season and results have been kept.";
  if (
    /schema|function|relation|migration|PGRST|not available yet/i.test(message)
  )
    return "Season management is not available yet. Ask your administrator to finish the season update, then reload.";
  if (/overlap/i.test(message))
    return "These season dates overlap an existing season. Review the calendar and try again.";
  if (/date|start|end must/i.test(message))
    return "Enter valid dates with the end on or after the start.";
  if (/source|participant|athlete.*(invalid|belong|found)/i.test(message))
    return "The selected source or participants are no longer available. Reload and review the source roster again.";
  return "The season could not be saved or loaded. Check your connection and permissions, then try again. Your selections have been kept.";
}
export function CoachingSeasons() {
  const context = useCoachingContext();
  const selected =
    context.orgId && context.filterTeamId === null
      ? null
      : (context.filterTeamId ?? context.teamId);
  return (
    <div className="space-y-6">
      <CoachingNav />
      {context.isLoadingTeam ? (
        <p role="status">Loading team…</p>
      ) : selected ? (
        <SeasonWorkspace
          key={`${context.userId}:${selected}:${context.teams.find((t) => t.team_id === selected)?.role}`}
          canManage={
            context.teams.find((t) => t.team_id === selected)?.role === "coach"
          }
          teamId={selected}
          teamName={
            context.teams.find((t) => t.team_id === selected)?.team_name ??
            "Selected team"
          }
        />
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title="Select a team"
          description="Choose a team above to view its seasons and prepare a roster."
        />
      )}
    </div>
  );
}
function SeasonWorkspace({
  teamId,
  teamName,
  canManage,
}: {
  teamId: string;
  teamName: string;
  canManage: boolean;
}) {
  const [seasons, setSeasons] = useState<TeamSeason[]>([]);
  const [viewId, setViewId] = useState("");
  const [roster, setRoster] = useState<SeasonRosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [error, setError] = useState("");
  const [squad, setSquad] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [transition, setTransition] = useState<"activate" | "archive" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    listTeamSeasons(teamId)
      .then((rows) => {
        if (active) {
          setSeasons(rows);
          setViewId(
            rows.find((s) => s.status === "active")?.id ?? rows[0]?.id ?? "",
          );
        }
      })
      .catch((e) => {
        if (active) setError(failure(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId]);
  useEffect(() => {
    let active = true;
    setRoster([]);
    setSquad("");
    if (!viewId) return;
    setRosterLoading(true);
    getSeasonRoster(viewId)
      .then((rows) => {
        if (active) setRoster(rows);
      })
      .catch((e) => {
        if (active) setError(failure(e));
      })
      .finally(() => {
        if (active) setRosterLoading(false);
      });
    return () => {
      active = false;
    };
  }, [viewId]);
  const viewed = seasons.find((s) => s.id === viewId);
  const current = seasons.find((s) => s.status === "active");
  async function reload(id: string) {
    const rows = await listTeamSeasons(teamId);
    if (mounted.current) {
      setSeasons(rows);
      setViewId(id);
    }
  }
  async function applyTransition() {
    if (!viewed || !transition || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await (transition === "activate"
        ? activateTeamSeason(viewed.id)
        : archiveTeamSeason(viewed.id));
      await reload(viewed.id);
      if (mounted.current) {
        setTransition(null);
        toast.success("Season updated");
      }
    } catch (e) {
      if (mounted.current) setError(failure(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <h1 className="text-xl font-semibold text-content-primary">
        Seasons · {teamName}
      </h1>
      <p className="text-sm text-content-muted">
        Current season:{" "}
        {current?.name ??
          "No active season selected. Draft preparation does not change the operational roster"}
        . This workspace views roster history; schedules and results keep their
        existing scope.
      </p>
      {error && !transition && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading seasons…</p>
      ) : (
        <>
          {!canManage && (
            <p className="text-sm text-content-muted">
              Read-only season access. A team coach can prepare seasons,
              activate or archive them, and edit squad placements.
            </p>
          )}
          {canManage && (
            <Button
              variant="coaching"
              onClick={() => setPreparing(true)}
              disabled={!!error}
            >
              Prepare a season
            </Button>
          )}
          {canManage && preparing && (
            <Preparation
              key={teamId}
              teamId={teamId}
              teamName={teamName}
              seasons={seasons}
              onCancel={() => setPreparing(false)}
              onCreated={async (id) => {
                await reload(id);
                if (mounted.current) setPreparing(false);
              }}
            />
          )}
          {!seasons.length ? (
            <EmptyState
              icon={<CalendarDays />}
              title="No seasons yet"
              description="Prepare a season from explicitly selected current participants. Existing records remain available."
            />
          ) : (
            <Card>
              <CardHeader title="Viewed season" />
              <Select
                label="Viewed season"
                value={viewId}
                onChange={(e) => {
                  setViewId(e.target.value);
                  setError("");
                }}
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.status} · {s.starts_on} – {s.ends_on}
                  </option>
                ))}
              </Select>
              {viewed && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-content-muted">
                    {viewed.status === "archived"
                      ? "Historical roster · read only"
                      : viewed.status === "draft"
                        ? "Draft roster · does not change current assignment eligibility"
                        : "Current operational roster"}
                  </p>
                  <Select
                    id="squad-filter"
                    label="Squad filter"
                    value={squad}
                    onChange={(e) => setSquad(e.target.value)}
                  >
                    <option value="">All squads</option>
                    {[
                      ...new Set(
                        roster
                          .map((a) => a.squad)
                          .filter((s): s is string => !!s),
                      ),
                    ]
                      .sort()
                      .map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                  </Select>
                  {rosterLoading ? (
                    <p role="status">Loading roster…</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {roster
                        .filter((a) => !squad || a.squad === squad)
                        .map((a) => (
                          <li key={a.athlete_id} className="py-3">
                            <p className="font-medium text-content-primary">
                              {a.first_name} {a.last_name}
                            </p>
                            <p className="text-sm text-content-muted">
                              {a.grade ? `Grade ${a.grade} · ` : ""}
                              {a.squad ?? "Unassigned"} · {a.status} ·{" "}
                              {a.has_account
                                ? "Account linked at snapshot"
                                : "No account at snapshot"}
                            </p>
                            {canManage && viewed.status !== "archived" && (
                              <SquadPlacement
                                key={`${viewed.id}:${a.athlete_id}`}
                                seasonId={viewed.id}
                                athlete={a}
                                onSaved={(value) =>
                                  setRoster((rows) =>
                                    rows.map((row) =>
                                      row.athlete_id === a.athlete_id
                                        ? { ...row, squad: value }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                  <p className="text-xs text-content-muted">
                    Accounts are optional. Season operations do not send
                    invitations or change account access.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {canManage && viewed.status === "draft" && (
                      <Button
                        variant="coaching"
                        onClick={() => {
                          setError("");
                          setTransition("activate");
                        }}
                      >
                        Activate season
                      </Button>
                    )}
                    {canManage && viewed.status !== "archived" && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setError("");
                          setTransition("archive");
                        }}
                      >
                        Archive season
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
      <Modal
        open={canManage && !!transition}
        onClose={() => {
          if (!busy) setTransition(null);
        }}
        title={
          transition === "activate"
            ? "Confirm season activation"
            : "Confirm season archive"
        }
        footer={
          <Button variant="coaching" loading={busy} onClick={applyTransition}>
            Confirm {transition}
          </Button>
        }
      >
        <div className="space-y-3">
          <p>
            {teamName} · {viewed?.name} · {viewed?.starts_on} –{" "}
            {viewed?.ends_on}
          </p>
          <p>
            {transition === "activate"
              ? `This makes this roster current and archives ${current?.name ?? "any previous active season"}. Only these participants will remain eligible for new team assignments.`
              : "This closes this season. If it is current, its participants stop being eligible for new team assignments."}
          </p>
          <p>
            Existing results, history, and account access are retained.
            Incomplete assignments must be resolved before closing an active
            season.
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
      </Modal>
    </section>
  );
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  squad: string | null;
  has_account: boolean;
  status: string;
}
function Preparation({
  teamId,
  teamName,
  seasons,
  onCancel,
  onCreated,
}: {
  teamId: string;
  teamName: string;
  seasons: TeamSeason[];
  onCancel: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const year = new Date().getFullYear();
  const [name, setName] = useState(`${year}/${year + 1}`);
  const [startsOn, setStartsOn] = useState(`${year}-08-01`);
  const [endsOn, setEndsOn] = useState(`${year + 1}-07-31`);
  const [source, setSource] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [copy, setCopy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const lock = useRef(false);
  const createdId = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setSelected([]);
    setCandidates([]);
    setSourceLoaded(false);
    setError("");
    if (!source) return;
    setLoading(true);
    const load =
      source === "legacy"
        ? getAthletes(teamId).then((rows) =>
            rows.map((a) => ({
              id: a.id,
              first_name: a.first_name,
              last_name: a.last_name,
              squad: a.squad ?? null,
              has_account: !!a.user_id,
              status: "active",
            })),
          )
        : getSeasonRoster(source).then((rows) =>
            rows.map((a) => ({
              id: a.athlete_id,
              first_name: a.first_name,
              last_name: a.last_name,
              squad: a.squad,
              has_account: a.has_account,
              status: a.status,
            })),
          );
    load
      .then((rows) => {
        if (active) {
          setCandidates(rows);
          setSourceLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError(failure(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [source, teamId]);
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  const valid =
    !!name.trim() &&
    name.trim().length <= 80 &&
    validDate(startsOn) &&
    validDate(endsOn) &&
    startsOn <= endsOn &&
    sourceLoaded &&
    !loading &&
    (selected.length > 0 || candidates.length === 0);
  async function create() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!createdId.current)
        createdId.current = await createTeamSeason({
          teamId,
          name: name.trim(),
          startsOn,
          endsOn,
          sourceSeasonId: source === "legacy" ? null : source,
          athleteIds: selected,
          copySquads: copy,
        });
      await onCreated(createdId.current);
      if (mounted.current) toast.success("Draft season created");
    } catch (e) {
      if (mounted.current) setError(failure(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader
        title="Prepare a season"
        subtitle="Step 1 of 2 · Choose source and returning participants"
      />
      <fieldset disabled={review || busy} className="space-y-4">
        <Input
          id="season-name"
          label="Season name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Starts on"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
          <Input
            label="Ends on"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            error={
              startsOn > endsOn ? "End date must follow start date" : undefined
            }
          />
        </div>
        <Select
          id="source-roster"
          label="Source roster"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">Choose a source to review</option>
          <option value="legacy">Current operational roster</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.status}
            </option>
          ))}
        </Select>
        {source === "legacy" && (
          <p className="text-sm text-content-muted">
            Review carefully: this is a present-day roster snapshot, not
            reconstructed historical participation.
          </p>
        )}
        {loading ? (
          <p role="status">Loading source roster…</p>
        ) : (
          source && (
            <>
              <p className="text-sm text-content-muted">
                Select returning participants. Accounts are optional; no
                invitations will be sent.
              </p>
              {sourceLoaded && candidates.length === 0 && (
                <p>
                  This source has no participants. Review and confirm an empty
                  draft; you can activate it before adding athletes, including
                  athletes without accounts.
                </p>
              )}
              <div className="max-h-72 overflow-y-auto">
                {candidates.map((a) => (
                  <label
                    key={a.id}
                    className="flex min-h-11 items-center gap-3"
                  >
                    <Input
                      data-athlete
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, a.id]
                            : ids.filter((id) => id !== a.id),
                        )
                      }
                    />
                    <span>
                      {a.first_name} {a.last_name} · {a.status} ·{" "}
                      {a.squad ?? "Unassigned"}
                      {!a.has_account ? " · No account" : ""}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )
        )}
        <label className="flex min-h-11 items-center gap-3">
          <Input
            type="checkbox"
            checked={copy}
            onChange={(e) => setCopy(e.target.checked)}
          />
          <span>Copy selected participants’ squad placements</span>
        </label>
      </fieldset>
      {error && !review && <p role="alert">{error}</p>}
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel preparation
        </Button>
        <Button
          data-review
          variant="coaching"
          disabled={!valid}
          onClick={() => setReview(true)}
        >
          Review season
        </Button>
      </div>
      <Modal
        open={review}
        title="Review season · Step 2 of 2"
        onClose={() => {
          if (!busy && !createdId.current) setReview(false);
        }}
        footer={
          <Button variant="coaching" loading={busy} onClick={create}>
            {createdId.current ? "Refresh saved season" : "Create draft season"}
          </Button>
        }
      >
        <div className="space-y-3">
          <p>
            {teamName} · {name} · {startsOn} – {endsOn}
          </p>
          <p>
            Source:{" "}
            {source === "legacy"
              ? "Current operational roster — present-day snapshot, not historical reconstruction"
              : seasons.find((s) => s.id === source)?.name}
          </p>
          <p>
            {selected.length} selected participants. Squads:{" "}
            {copy ? "copy source placements" : "all unassigned"}.
          </p>
          <ul>
            {candidates
              .filter((a) => selected.includes(a.id))
              .map((a) => (
                <li key={a.id}>
                  {a.first_name} {a.last_name} ·{" "}
                  {copy ? (a.squad ?? "Unassigned") : "Unassigned"}
                </li>
              ))}
          </ul>
          <p>
            This creates a draft. Current eligibility stays unchanged until
            activation. Athlete identities and account links are retained. No
            invitations, assignments, or grade advancement are created.
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
      </Modal>
    </Card>
  );
}

function SquadPlacement({
  seasonId,
  athlete,
  onSaved,
}: {
  seasonId: string;
  athlete: SeasonRosterAthlete;
  onSaved: (value: string | null) => void;
}) {
  const [value, setValue] = useState(athlete.squad ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const squad = value.trim() || null;
      await setTeamSeasonSquad(seasonId, athlete.athlete_id, squad);
      onSaved(squad);
      toast.success("Squad saved");
    } catch (e) {
      setError(failure(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <Input
          label={`Squad for ${athlete.first_name} ${athlete.last_name}`}
          id={`squad-${athlete.athlete_id}`}
          value={value}
          maxLength={80}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={busy}
          disabled={value.trim() === (athlete.squad ?? "")}
        >
          Save squad
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
