// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  team: "a" as string | null,
  role: "coach",
  list: vi.fn(),
  roster: vi.fn(),
  legacy: vi.fn(),
  create: vi.fn(),
  activate: vi.fn(),
  archive: vi.fn(),
  squad: vi.fn(),
}));
vi.mock("../../hooks/useCoachingContext", () => ({
  useCoachingContext: () => ({
    userId: "coach",
    teamId: "a",
    filterTeamId: mocks.team,
    orgId: "club",
    isLoadingTeam: false,
    teams: [
      { team_id: "a", team_name: "Juniors", role: mocks.role },
      { team_id: "b", team_name: "Masters", role: "coach" },
    ],
  }),
}));
vi.mock("../../components/coaching/CoachingNav", () => ({
  CoachingNav: () => <nav>Context</nav>,
}));
vi.mock("../../services/coaching/coachingService", () => ({
  getAthletes: mocks.legacy,
}));
vi.mock("../../services/coaching/teamSeasonService", () => ({
  listTeamSeasons: mocks.list,
  getSeasonRoster: mocks.roster,
  createTeamSeason: mocks.create,
  activateTeamSeason: mocks.activate,
  archiveTeamSeason: mocks.archive,
  setTeamSeasonSquad: mocks.squad,
}));
import { CoachingSeasons } from "./CoachingSeasons";
let root: Root;
async function render() {
  await act(async () => root.render(<CoachingSeasons />));
}
async function click(text: string) {
  const el = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  )!;
  expect(el).toBeTruthy();
  await act(async () => el.click());
}
async function change(selector: string, value: string) {
  await act(async () => {
    const el = document.querySelector(selector) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      el.tagName === "SELECT"
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(
      new Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.team = "a";
  mocks.role = "coach";
  mocks.list.mockResolvedValue([]);
  mocks.roster.mockResolvedValue([]);
  mocks.legacy.mockResolvedValue([
    {
      id: "athlete",
      first_name: "Jo",
      last_name: "Row",
      user_id: null,
      squad: "Novice",
    },
  ]);
  mocks.create.mockResolvedValue("new");
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
});
describe("season workspace", () => {
  it("requires explicit team in club overview", async () => {
    mocks.team = null;
    await render();
    expect(document.body.textContent).toContain("Select a team");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("requires explicit returning selection and previews no-account participants before save", async () => {
    await render();
    await click("Prepare a season");
    await change("#source-roster", "legacy");
    expect(
      (document.querySelector("button[data-review]") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await act(async () =>
      (
        document.querySelector(
          "input[type=checkbox][data-athlete]",
        ) as HTMLInputElement
      ).click(),
    );
    await click("Review season");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(document.querySelector("[role=dialog]")?.textContent).toContain(
      "Jo Row",
    );
    await click("Create draft season");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "a",
        athleteIds: ["athlete"],
        copySquads: false,
        sourceSeasonId: null,
      }),
    );
  });
  it("keeps reviewed input and error on failed save", async () => {
    mocks.create.mockRejectedValue(new Error("network"));
    await render();
    await click("Prepare a season");
    await change("#source-roster", "legacy");
    await act(async () =>
      (
        document.querySelector("input[data-athlete]") as HTMLInputElement
      ).click(),
    );
    await click("Review season");
    await click("Create draft season");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain(
      "Jo Row",
    );
    expect(document.querySelector("[role=alert]")).toBeTruthy();
  });
  it("keeps failed activation confirmation and explains pending work", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "draft",
        team_id: "a",
        name: "Future",
        starts_on: "2027-08-01",
        ends_on: "2028-07-31",
        status: "draft",
      },
    ]);
    mocks.activate.mockRejectedValue(new Error("incomplete assignments"));
    await render();
    expect(document.body.textContent).toContain(
      "does not change current assignment eligibility",
    );
    await click("Activate season");
    await click("Confirm activate");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain(
      "Future",
    );
    expect(document.querySelector("[role=alert]")?.textContent).toContain(
      "Resolve incomplete assignments",
    );
  });
  it("offers actionable unavailable-feature error without exposing schema", async () => {
    mocks.list.mockRejectedValue({
      message: "relation team_seasons does not exist",
    });
    await render();
    expect(document.querySelector("[role=alert]")?.textContent).toContain(
      "administrator",
    );
    expect(document.body.textContent).not.toContain("team_seasons");
  });
  it("discards preparation when team changes", async () => {
    await render();
    await click("Prepare a season");
    mocks.team = "b";
    await render();
    expect(document.querySelector("#season-name")).toBeNull();
    expect(document.body.textContent).toContain("Masters");
  });
  it("shows archived snapshots read-only and filters actual squads", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "old",
        team_id: "a",
        name: "2025/2026",
        starts_on: "2025-08-01",
        ends_on: "2026-07-31",
        status: "archived",
      },
    ]);
    mocks.roster.mockResolvedValue([
      {
        athlete_id: "athlete",
        first_name: "Past",
        last_name: "Name",
        squad: "Novice",
        performance_tier: "Varsity",
        grade: "9",
        status: "active",
        has_account: false,
      },
    ]);
    await render();
    expect(document.body.textContent).toContain("Past Name");
    expect(document.querySelector("a")).toBeNull();
    expect(document.body.textContent).not.toContain("Activate season");
    expect(document.querySelector("#squad-filter")?.textContent).not.toContain(
      "Varsity",
    );
  });
  it("allows reviewed empty bootstrap without changing eligibility during preparation", async () => {
    mocks.legacy.mockResolvedValue([]);
    await act(async () =>
      root.render(
        <StrictMode>
          <CoachingSeasons />
        </StrictMode>,
      ),
    );
    await click("Prepare a season");
    await change("#source-roster", "legacy");
    await click("Review season");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain(
      "0 selected participants",
    );
    expect(mocks.activate).not.toHaveBeenCalled();
    await click("Create draft season");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ athleteIds: [] }),
    );
    expect(document.querySelector("#season-name")).toBeNull();
  });
  it("ignores a late team load after changing scope", async () => {
    let resolveOld!: (rows: unknown[]) => void;
    mocks.list.mockImplementation((id: string) =>
      id === "a"
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve([]),
    );
    await render();
    mocks.team = "b";
    await render();
    await act(async () =>
      resolveOld([{ id: "old", name: "Wrong team season", status: "active" }]),
    );
    expect(document.body.textContent).toContain("Masters");
    expect(document.body.textContent).not.toContain("Wrong team season");
  });
  it("retains placement input on failed save and excludes performance tiers from squad filter", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "draft",
        name: "Future",
        status: "draft",
        starts_on: "2027-08-01",
        ends_on: "2028-07-31",
      },
    ]);
    mocks.roster.mockResolvedValue([
      {
        athlete_id: "athlete",
        first_name: "Jo",
        last_name: "Row",
        squad: null,
        performance_tier: "Varsity",
        status: "active",
        has_account: false,
      },
    ]);
    mocks.squad.mockRejectedValue(new Error("network"));
    await render();
    await change("#squad-athlete", "Novice");
    await click("Save squad");
    expect(mocks.squad).toHaveBeenCalledWith("draft", "athlete", "Novice");
    expect(
      (document.querySelector("#squad-athlete") as HTMLInputElement).value,
    ).toBe("Novice");
    expect(document.querySelector("[role=alert]")).toBeTruthy();
    expect(document.querySelector("#squad-filter")?.textContent).not.toContain(
      "Varsity",
    );
  });
  it("gives coxswains read-only snapshots without mutation controls", async () => {
    mocks.role = "coxswain";
    mocks.list.mockResolvedValue([
      {
        id: "draft",
        name: "Future",
        status: "draft",
        starts_on: "2027-08-01",
        ends_on: "2028-07-31",
      },
    ]);
    mocks.roster.mockResolvedValue([
      {
        athlete_id: "athlete",
        first_name: "Jo",
        last_name: "Row",
        squad: null,
        status: "active",
        has_account: false,
      },
    ]);
    await render();
    expect(document.body.textContent).toContain("Read-only season access");
    expect(document.body.textContent).toContain("Jo Row");
    const buttons = [...document.querySelectorAll("button")].map(
      (b) => b.textContent,
    );
    expect(buttons).not.toContain("Prepare a season");
    expect(buttons).not.toContain("Activate season");
    expect(buttons).not.toContain("Archive season");
    expect(document.querySelector("#squad-athlete")).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
