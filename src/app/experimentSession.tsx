import AsyncStorage from "@react-native-async-storage/async-storage";

export type Condition = "baseline" | "lassoTool";
export type Outcome = "success" | "failure";

// ---------------------------------------------------------------------------
// Task config
// ---------------------------------------------------------------------------
// A task is defined by two numbers:
//   folders       — how many folders the participant must create
//   appsPerFolder — how many apps each folder must contain
// The validator is generated from those numbers.
// ---------------------------------------------------------------------------
export type TaskShape = {
  folders: number;
  appsPerFolder: number;
};

export type TaskId = // config Step 1
  | "5x4"
  | "4x4"
  | "3x5"
  | "1x10"
  | "1x8"
  | "1x12"
  | "1x3"
  | "6x3";

export type FolderGroup = { appIds: string[] };

export type TrialPlanEntry = {
  condition: Condition;
  taskId: TaskId;
};

export type TaskSpec = TaskShape & {
  id: TaskId;
  label: string;
  brief: string;
  validate: (
    folders: FolderGroup[],
    pageOf: (id: string) => number
  ) => boolean;
};

export type TrialLog = {
  participantId: string;
  condition: Condition;
  taskId: TaskId;
  trialNumber: number;
  timestamp: string;
  duration_sec: number;
  correct: boolean;
  outcome: Outcome;
  targetId: string;
  selectedIds: string;
};

const PARTICIPANT_KEY = "experiment_participant_id";
const PLAN_KEY = "experiment_trial_plan";
const TRIAL_INDEX_KEY = "experiment_trial_index";
const START_KEY = "experiment_start_time";
const ACTIVE_KEY = "experiment_task_active";

// ---------------------------------------------------------------------------
// Task registry
// ---------------------------------------------------------------------------
function makeTask(id: TaskId, shape: TaskShape): TaskSpec {
  const { folders, appsPerFolder } = shape;
  const total = folders * appsPerFolder;
  return {
    id,
    ...shape,
    label:
      folders === 1
        ? `1 folder × ${appsPerFolder} apps`
        : `${folders} folders × ${appsPerFolder} apps each`,
    brief:
      folders === 1
        ? `Create 1 folder containing exactly ${appsPerFolder} apps.`
        : `Create ${folders} folders, each containing exactly ${appsPerFolder} apps (${total} apps total).`,
    validate: (finalFolders) =>
      finalFolders.length === folders &&
      finalFolders.every((f) => f.appIds.length === appsPerFolder),
  };
}

export const TASKS: Record<TaskId, TaskSpec> = { // config Step 2
  // Multi-folder tasks
  "5x4": makeTask("5x4", { folders: 5, appsPerFolder: 4 }),
  "4x4": makeTask("4x4", { folders: 4, appsPerFolder: 4 }),
  "3x5": makeTask("3x5", { folders: 3, appsPerFolder: 5 }),
  "6x3": makeTask("6x3", { folders: 6, appsPerFolder: 3 }),

  // Single-folder tasks
  "1x10": makeTask("1x10", { folders: 1, appsPerFolder: 10 }),
  "1x8": makeTask("1x8", { folders: 1, appsPerFolder: 8 }),
  "1x12": makeTask("1x12", { folders: 1, appsPerFolder: 12 }),
  "1x3": makeTask("1x3", { folders: 1, appsPerFolder: 3 }),
};

// ---------------------------------------------------------------------------
// Trial plan configuration
// ---------------------------------------------------------------------------
// Edit this list to choose which tasks run this cohort. Every id here produces
// two trials (one baseline, one lassoTool), so the plan stays balanced.
// ---------------------------------------------------------------------------
export const TASKS_PER_CONDITION: TaskId[] = [ // config Step 3
  "5x4",   // multi-folder
  "1x10",  // single-folder
  "1x8",   // single-folder
  "1x3",   // single-folder
  "3x5",   // multi-folder
  "6x3",   // multi-folder
];

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
async function generateTrialPlan(): Promise<TrialPlanEntry[]> {
  const plan: TrialPlanEntry[] = [];
  for (const taskId of TASKS_PER_CONDITION) {
    plan.push({ condition: "baseline", taskId });
    plan.push({ condition: "lassoTool", taskId });
  }
  // Fisher-Yates shuffle
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  return plan;
}

export async function getOrCreateTrialPlan(): Promise<TrialPlanEntry[]> {
  const stored = await AsyncStorage.getItem(PLAN_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Only reuse the cached plan if it's still compatible with the current
      // task registry (so removing/renaming a task auto-regenerates).
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (e: unknown) =>
            e !== null &&
            typeof e === "object" &&
            "taskId" in e &&
            typeof (e as TrialPlanEntry).taskId === "string" &&
            (e as TrialPlanEntry).taskId in TASKS
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

// ---------------------------------------------------------------------------
// Task status — checks whether the current trial's task is satisfied
// ---------------------------------------------------------------------------
export async function isTaskSatisfied(
  folders: FolderGroup[],
  pageOf: (id: string) => number
): Promise<boolean> {
  const current = await getCurrentTrial();
  if (!current) return false;
  return TASKS[current.trial.taskId].validate(folders, pageOf);
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------
/**
 * Attempt to complete the current trial.
 *
 * - If the current task's validator rejects the participant's folder
 *   structure AND no `outcomeOverride` is passed, this returns `null` and
 *   leaves the timer running. The caller must let the participant keep
 *   trying.
 * - On success (or when `outcomeOverride: "failure"` is used to log a
 *   give-up), writes a log, advances the trial index, and clears the timer.
 */
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

  // Timer keeps running unless the task is actually satisfied.
  if (!passed && args.outcomeOverride === undefined) return null;

  const outcome: Outcome =
    args.outcomeOverride ?? (passed ? "success" : "failure");

  const duration_sec = Date.now() - Number(startStr);
  const participantId = await getOrCreateParticipantId();
  const selectedIds = args.folders.flatMap((f) => f.appIds);

  const log: TrialLog = {
    participantId,
    condition: current.trial.condition,
    taskId: current.trial.taskId,
    trialNumber: current.index + 1,
    timestamp: new Date().toISOString(),
    duration_sec,
    correct: outcome === "success" && passed,
    outcome,
    targetId: args.targetId,
    selectedIds: selectedIds.join("|"),
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
    row.condition,
    row.taskId,
    row.trialNumber,
    row.timestamp,
    (row.duration_sec / 1000).toFixed(5),
    row.correct ? "1" : "0",
    row.outcome,
    row.targetId,
    row.selectedIds,
  ].join(",");
}

export const CSV_HEADERS = [
  "participant_id",
  "condition",
  "task_id",
  "trial_number",
  "timestamp",
  "duration_Sec",
  "correct",
  "outcome",
  "target_id",
  "selected_ids",
];