import AsyncStorage from "@react-native-async-storage/async-storage";

export type Condition = "baseline" | "lassoTool";
export type Outcome = "success" | "failure";

// ---------------------------------------------------------------------------
// Experimental design
// ---------------------------------------------------------------------------
// Two blocks of 12 trials each (24 trials total):
//   Block 1 (Single Page · 12 trials, 3 per condition):
//     1) Lasso Gesture + Clustered Layout
//     2) Lasso Gesture + Scattered Layout
//     3) Drag and Drop (Baseline) + Clustered Layout
//     4) Drag and Drop (Baseline) + Scattered Layout
//   Block 2 (Multi Page · 12 trials):
//     Multi-page tasks (Clustered & Scattered across multiple pages)
// ---------------------------------------------------------------------------
export type LayoutStyle = "clustered" | "scattered";
export type PageStyle = "single" | "multi";
export type ExperimentCondition = "A" | "B" | "C" | "D";
export type ExperimentBlock = 1 | 2;

export const CONDITION_MATRIX: Record<
  ExperimentCondition,
  { layout: LayoutStyle; pages: PageStyle; block: ExperimentBlock; label: string }
> = {
  A: {
    layout: "clustered",
    pages: "single",
    block: 1,
    label: "Clustered · Single Page",
  },
  B: {
    layout: "scattered",
    pages: "single",
    block: 1,
    label: "Scattered · Single Page",
  },
  C: {
    layout: "clustered",
    pages: "multi",
    block: 2,
    label: "Clustered · Multi Page",
  },
  D: {
    layout: "scattered",
    pages: "multi",
    block: 2,
    label: "Scattered · Multi Page",
  },
};

// ---------------------------------------------------------------------------
// ─── THE ONLY INPUT ────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------
type TaskSeed = {
  id: string;
  condition: ExperimentCondition;
  folders: number;
  appsPerFolder: number;
  pages: number; // minimum number of distinct pages that must be used
};

const EXPERIMENT_TASKS = [
  //Add New Tasks Here
  // ── Block 1: Condition A — clustered · single page ─────────
  { id: "A-3x3", condition: "A", folders: 3, appsPerFolder: 3, pages: 1 },
  { id: "A-1x8", condition: "A", folders: 1, appsPerFolder: 8, pages: 1 },
  { id: "A-2x4", condition: "A", folders: 2, appsPerFolder: 4, pages: 1 },

  // ── Block 1: Condition B — scattered · single page ─────────
  { id: "B-3x3", condition: "B", folders: 3, appsPerFolder: 3, pages: 1 },
  { id: "B-1x8", condition: "B", folders: 1, appsPerFolder: 8, pages: 1 },
  { id: "B-2x4", condition: "B", folders: 2, appsPerFolder: 4, pages: 1 },

  // ── Block 2: Condition C — clustered · multi page ──────────
  { id: "C-1x4-cross", condition: "C", folders: 1, appsPerFolder: 4, pages: 2 },
  { id: "C-2x3-cross", condition: "C", folders: 2, appsPerFolder: 3, pages: 2 },
  { id: "C-1x3-cross3", condition: "C", folders: 1, appsPerFolder: 3, pages: 3 },

  // ── Block 2: Condition D — scattered · multi page ──────────
  { id: "D-1x4-cross", condition: "D", folders: 1, appsPerFolder: 4, pages: 2 },
  { id: "D-2x3-cross", condition: "D", folders: 2, appsPerFolder: 3, pages: 2 },
  { id: "D-1x3-cross3", condition: "D", folders: 1, appsPerFolder: 3, pages: 3 },
] as const satisfies readonly TaskSeed[];

// Derive the literal TaskId union from EXPERIMENT_TASKS.
export type TaskId = (typeof EXPERIMENT_TASKS)[number]["id"];

// Map a task id to its layout style (reads the condition letter).
export function layoutStyleForTask(taskId: TaskId): LayoutStyle {
  const letter = taskId.charAt(0) as ExperimentCondition;
  return CONDITION_MATRIX[letter]?.layout ?? "clustered";
}

// Map a task id to its page style.
export function pageStyleForTask(taskId: TaskId): PageStyle {
  const letter = taskId.charAt(0) as ExperimentCondition;
  return CONDITION_MATRIX[letter]?.pages ?? "single";
}

// Map a task id to its experiment block (1 = Single Page, 2 = Multi Page).
export function blockForTask(taskId: TaskId): ExperimentBlock {
  const letter = taskId.charAt(0) as ExperimentCondition;
  return CONDITION_MATRIX[letter]?.block ?? 1;
}

// ---------------------------------------------------------------------------
// Task config
// ---------------------------------------------------------------------------
export type TaskShape = {
  folders: number;
  appsPerFolder: number;
  pages: number;
};

export type FolderGroup = { appIds: string[] };

export type TrialPlanEntry = {
  block: ExperimentBlock;
  condition: Condition;
  taskId: TaskId;
};

export type TaskSpec = TaskShape & {
  id: TaskId;
  block: ExperimentBlock;
  label: string;
  brief: string;
  validate: (folders: FolderGroup[], pageOf: (id: string) => number) => boolean;
};

export type TrialLog = {
  participantId: string;
  block: ExperimentBlock;
  condition: Condition;
  taskId: TaskId;
  trialNumber: number;
  timestamp: string;
  duration_sec: number;
  correct: boolean;
  outcome: Outcome;
  targetId: string;
  selectedIds: string;
  // Page distribution for multi-page tasks.
  pagesUsed: string; // e.g. "1|2"
  pagesInFolders: string; // e.g. "1:1-2|2:2"
};

const PARTICIPANT_KEY = "experiment_participant_id";
const PLAN_KEY = "experiment_trial_plan";
const TRIAL_INDEX_KEY = "experiment_trial_index";
const START_KEY = "experiment_start_time";
const ACTIVE_KEY = "experiment_task_active";

// ---------------------------------------------------------------------------
// Task registry (built from EXPERIMENT_TASKS)
// ---------------------------------------------------------------------------
function buildTaskSpec(seed: TaskSeed): TaskSpec {
  const { id, condition, folders, appsPerFolder, pages } = seed;
  const block = CONDITION_MATRIX[condition]?.block ?? (pages > 1 ? 2 : 1);
  const total = folders * appsPerFolder;
  const multiPage = pages > 1;

  return {
    id: id as TaskId,
    block,
    folders,
    appsPerFolder,
    pages,
    label: multiPage
      ? folders === 1
        ? `1 folder × ${appsPerFolder} apps (across ${pages} pages)`
        : `${folders} folders × ${appsPerFolder} apps each (across ${pages} pages)`
      : folders === 1
        ? `1 folder × ${appsPerFolder} apps`
        : `${folders} folders × ${appsPerFolder} apps each`,
    brief: multiPage
      ? folders === 1
        ? `Create 1 folder containing exactly ${appsPerFolder} apps, with at least one app taken from a different page.`
        : `Create ${folders} folders, each containing exactly ${appsPerFolder} apps (${total} apps total). At least one folder must contain apps drawn from more than one page.`
      : folders === 1
        ? `Create 1 folder containing exactly ${appsPerFolder} apps.`
        : `Create ${folders} folders, each containing exactly ${appsPerFolder} apps (${total} apps total).`,
    validate: (finalFolders, pageOf) => {
      // Shape check: correct count and sizes.
      const shapeOk =
        finalFolders.length === folders &&
        finalFolders.every((f) => f.appIds.length === appsPerFolder);
      if (!shapeOk) return false;

      // Multi-page check: at least one folder must span ≥ `pages` distinct
      // pages, and across the whole solution the participant must have used
      // at least `pages` distinct pages.
      if (!multiPage) return true;

      const usedPages = new Set<number>();
      let someFolderSpansPages = false;

      for (const f of finalFolders) {
        const folderPages = new Set(f.appIds.map(pageOf));
        folderPages.forEach((p) => usedPages.add(p));
        if (folderPages.size >= pages) someFolderSpansPages = true;
      }

      return someFolderSpansPages && usedPages.size >= pages;
    },
  };
}

export const TASKS: Record<TaskId, TaskSpec> = Object.fromEntries(
  EXPERIMENT_TASKS.map((seed) => [seed.id, buildTaskSpec(seed)]),
) as Record<TaskId, TaskSpec>;

// ---------------------------------------------------------------------------
// Trial plan configuration (derived from EXPERIMENT_TASKS)
// ---------------------------------------------------------------------------
export const TASKS_PER_CONDITION: TaskId[] = EXPERIMENT_TASKS.map(
  (seed) => seed.id as TaskId,
);

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------
export async function getOrCreateParticipantId(): Promise<string> {
  const existing = await AsyncStorage.getItem(PARTICIPANT_KEY);
  if (existing) return existing;
  const id = String(Math.floor(1000 + Math.random() * 9000));
  await AsyncStorage.setItem(PARTICIPANT_KEY, id);
  return id;
}

// ---------------------------------------------------------------------------
// Trial plan
// ---------------------------------------------------------------------------
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

async function generateTrialPlan(): Promise<TrialPlanEntry[]> {
  // Block 1 (Single Page · 12 trials):
  //   - Condition A (Clustered, Single Page): 3 trials (1 baseline, 2 lassoTool / or paired)
  //   - Condition B (Scattered, Single Page): 3 trials
  // To guarantee exact 3 trials per single-page condition and 12 trials per block:
  const block1: TrialPlanEntry[] = [
    // Lasso + Clustered (3 trials)
    { block: 1, condition: "lassoTool", taskId: "A-3x3" },
    { block: 1, condition: "lassoTool", taskId: "A-1x8" },
    { block: 1, condition: "lassoTool", taskId: "A-2x4" },
    // Lasso + Scattered (3 trials)
    { block: 1, condition: "lassoTool", taskId: "B-3x3" },
    { block: 1, condition: "lassoTool", taskId: "B-1x8" },
    { block: 1, condition: "lassoTool", taskId: "B-2x4" },
    // Baseline (Drag & Drop) + Clustered (3 trials)
    { block: 1, condition: "baseline", taskId: "A-3x3" },
    { block: 1, condition: "baseline", taskId: "A-1x8" },
    { block: 1, condition: "baseline", taskId: "A-2x4" },
    // Baseline (Drag & Drop) + Scattered (3 trials)
    { block: 1, condition: "baseline", taskId: "B-3x3" },
    { block: 1, condition: "baseline", taskId: "B-1x8" },
    { block: 1, condition: "baseline", taskId: "B-2x4" },
  ];

  // Block 2 (Multi Page · 12 trials):
  // Multi-page tasks from EXPERIMENT_TASKS (Conditions C & D) across both conditions.
  const multiPageSeeds = EXPERIMENT_TASKS.filter((seed) => seed.pages > 1);
  const block2: TrialPlanEntry[] = [];
  for (const seed of multiPageSeeds) {
    block2.push({ block: 2, condition: "baseline", taskId: seed.id as TaskId });
    block2.push({ block: 2, condition: "lassoTool", taskId: seed.id as TaskId });
  }

  shuffleInPlace(block1);
  shuffleInPlace(block2);

  return [...block1, ...block2];
}

export async function getOrCreateTrialPlan(): Promise<TrialPlanEntry[]> {
  const stored = await AsyncStorage.getItem(PLAN_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (
        Array.isArray(parsed) &&
        parsed.length === 24 &&
        parsed.every(
          (e: unknown) =>
            e !== null &&
            typeof e === "object" &&
            "taskId" in e &&
            typeof (e as TrialPlanEntry).taskId === "string" &&
            (e as TrialPlanEntry).taskId in TASKS &&
            ((e as TrialPlanEntry).block === 1 || (e as TrialPlanEntry).block === 2),
        )
      ) {
        return parsed as TrialPlanEntry[];
      }
    } catch {
      // fall through to regenerate
    }
  }
  const plan = await generateTrialPlan();
  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  return plan;
}

export async function getCurrentTrial(): Promise<{
  index: number;
  total: number;
  trial: TrialPlanEntry;
} | null> {
  const plan = await getOrCreateTrialPlan();
  const idxStr = await AsyncStorage.getItem(TRIAL_INDEX_KEY);
  const idx = idxStr ? Number(idxStr) : 0;
  if (idx < 0 || idx >= plan.length) return null;
  return { index: idx, total: plan.length, trial: plan[idx] };
}

// ---------------------------------------------------------------------------
// Timer / active flag
// ---------------------------------------------------------------------------
export async function startTimer(): Promise<void> {
  await AsyncStorage.multiSet([
    [START_KEY, String(Date.now())],
    [ACTIVE_KEY, "1"],
  ]);
}

export async function isTaskActive(): Promise<boolean> {
  return (await AsyncStorage.getItem(ACTIVE_KEY)) === "1";
}

export async function getStartTime(): Promise<number | null> {
  const [[, start], [, active]] = await AsyncStorage.multiGet([
    START_KEY,
    ACTIVE_KEY,
  ]);
  return active === "1" && start ? Number(start) : null;
}

// ---------------------------------------------------------------------------
// Task status — checks whether the current trial's task is satisfied
// ---------------------------------------------------------------------------
export async function isTaskSatisfied(
  folders: FolderGroup[],
  pageOf: (id: string) => number,
): Promise<boolean> {
  const current = await getCurrentTrial();
  if (!current) return false;
  return TASKS[current.trial.taskId].validate(folders, pageOf);
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------
export async function completeTask(args: {
  folders: FolderGroup[];
  targetId: string;
  pageOf: (id: string) => number;
  outcomeOverride?: Outcome;
}): Promise<TrialLog | null> {
  const active = await isTaskActive();
  if (!active) return null;

  const startStr = await AsyncStorage.getItem(START_KEY);
  if (!startStr) return null;

  const current = await getCurrentTrial();
  if (!current) return null;

  const spec = TASKS[current.trial.taskId];
  const passed = spec.validate(args.folders, args.pageOf);

  if (!passed && args.outcomeOverride === undefined) return null;

  const outcome: Outcome =
    args.outcomeOverride ?? (passed ? "success" : "failure");

  const duration_sec = Date.now() - Number(startStr);
  const participantId = await getOrCreateParticipantId();

  const selectedIds = args.folders.flatMap((f) => f.appIds);

  const pagesSet = new Set<number>();
  const perFolderPages: string[] = [];
  args.folders.forEach((f, idx) => {
    const fps = new Set<number>();
    f.appIds.forEach((id) => {
      const p = args.pageOf(id);
      fps.add(p);
      pagesSet.add(p);
    });
    const sorted = [...fps].sort((a, b) => a - b);
    perFolderPages.push(`${idx + 1}:${sorted.join("-")}`);
  });

  const log: TrialLog = {
    participantId,
    block: current.trial.block,
    condition: current.trial.condition,
    taskId: current.trial.taskId,
    trialNumber: current.index + 1,
    timestamp: new Date().toISOString(),
    duration_sec,
    correct: outcome === "success" && passed,
    outcome,
    targetId: args.targetId,
    selectedIds: selectedIds.join("|"),
    pagesUsed: [...pagesSet].sort((a, b) => a - b).join("|"),
    pagesInFolders: perFolderPages.join("|"),
  };

  const existing = await AsyncStorage.getItem("experiment_logs");
  const logs: TrialLog[] = existing ? JSON.parse(existing) : [];
  logs.push(log);

  await AsyncStorage.multiSet([
    ["experiment_logs", JSON.stringify(logs)],
    ["experiment_last_log", JSON.stringify(log)],
    [TRIAL_INDEX_KEY, String(current.index + 1)],
  ]);
  await AsyncStorage.multiRemove([START_KEY, ACTIVE_KEY]);

  return log;
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------
export async function getLogs(): Promise<TrialLog[]> {
  const existing = await AsyncStorage.getItem("experiment_logs");
  return existing ? JSON.parse(existing) : [];
}

export async function getLastLog(): Promise<TrialLog | null> {
  const existing = await AsyncStorage.getItem("experiment_last_log");
  return existing ? JSON.parse(existing) : null;
}

export async function clearAllExperimentData(): Promise<void> {
  await AsyncStorage.multiRemove([
    PARTICIPANT_KEY,
    PLAN_KEY,
    TRIAL_INDEX_KEY,
    START_KEY,
    ACTIVE_KEY,
    "experiment_last_log",
    "experiment_logs",
  ]);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
export function toCsvRow(row: TrialLog): string {
  return [
    row.participantId,
    row.block,
    row.condition,
    row.taskId,
    row.trialNumber,
    row.timestamp,
    (row.duration_sec / 1000).toFixed(5),
    row.correct ? "1" : "0",
    row.outcome,
    row.targetId,
    row.selectedIds,
    row.pagesUsed,
    row.pagesInFolders,
  ].join(",");
}

export const CSV_HEADERS = [
  "participant_id",
  "block",
  "condition",
  "task_id",
  "trial_number",
  "timestamp",
  "duration_Sec",
  "correct",
  "outcome",
  "target_id",
  "selected_ids",
  "pages_used",
  "pages_in_folders",
];