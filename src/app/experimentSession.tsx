import AsyncStorage from "@react-native-async-storage/async-storage";

export type Condition = "baseline" | "lassoTool";
export type Outcome = "success" | "failure";

export type TrialLog = {
  participantId: string;
  condition: Condition;
  trialNumber: number;
  timestamp: string;
  durationMs: number;
  correct: boolean;
  outcome: Outcome;          // NEW
  targetId: string;
  selectedIds: string;
};

const PARTICIPANT_KEY = "experiment_participant_id";
const CONDITION_KEY = "experiment_condition";
const START_KEY = "experiment_start_time";
const ACTIVE_KEY = "experiment_task_active";

export async function getOrCreateParticipantId(): Promise<string> {
  const existing = await AsyncStorage.getItem(PARTICIPANT_KEY);
  if (existing) return existing;
  const id = String(Math.floor(1000 + Math.random() * 9000));
  await AsyncStorage.setItem(PARTICIPANT_KEY, id);
  return id;
}

export async function clearParticipantId(): Promise<void> {
  await AsyncStorage.removeItem(PARTICIPANT_KEY);
}

export async function getOrAssignCondition(): Promise<Condition> {
  const stored = await AsyncStorage.getItem(CONDITION_KEY);
  if (stored === "baseline" || stored === "lassoTool") return stored;
  const condition: Condition = Math.random() < 0.5 ? "baseline" : "lassoTool";
  await AsyncStorage.setItem(CONDITION_KEY, condition);
  return condition;
}

export async function clearCondition(): Promise<void> {
  await AsyncStorage.removeItem(CONDITION_KEY);
}

export async function startTimer(): Promise<void> {
  await AsyncStorage.multiSet([
    [START_KEY, String(Date.now())],
    [ACTIVE_KEY, "1"],
  ]);
}

export async function isTaskActive(): Promise<boolean> {
  return (await AsyncStorage.getItem(ACTIVE_KEY)) === "1";
}

// Signature unchanged from your file: (selectedIds: string[], targetId: string)
// `outcome` defaults to "success" for backward compatibility.
export async function completeTask(
  selectedIds: string[],
  targetId: string,
  outcome: Outcome = "success"
): Promise<TrialLog | null> {
  const active = await isTaskActive();
  if (!active) return null;

  const startStr = await AsyncStorage.getItem(START_KEY);
  if (!startStr) return null;

  const durationMs = Date.now() - Number(startStr);

  const [participantId, condition] = await Promise.all([
    getOrCreateParticipantId(),
    getOrAssignCondition(),
  ]);

  const log: TrialLog = {
    participantId,
    condition,
    trialNumber: 1,
    timestamp: new Date().toISOString(),
    durationMs,
    // correct only when outcome is success and all 20 apps are accounted for
    correct: outcome === "success" && selectedIds.length >= 20,
    outcome,
    targetId,
    selectedIds: selectedIds.join("|"),
  };

  const existing = await AsyncStorage.getItem("experiment_logs");
  const logs: TrialLog[] = existing ? JSON.parse(existing) : [];
  logs.push(log);

  await AsyncStorage.multiSet([
    ["experiment_logs", JSON.stringify(logs)],
    ["experiment_last_log", JSON.stringify(log)],
  ]);
  await AsyncStorage.multiRemove([START_KEY, ACTIVE_KEY]);

  return log;
}

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
    CONDITION_KEY,
    START_KEY,
    ACTIVE_KEY,
    "experiment_last_log",
    "experiment_logs",
  ]);
}

export function toCsvRow(row: TrialLog): string {
  return [
    row.participantId,
    row.condition,
    row.trialNumber,
    row.timestamp,
    row.durationMs,
    row.correct ? "1" : "0",
    row.outcome,
    row.targetId,
    row.selectedIds,
  ].join(",");
}

export const CSV_HEADERS = [
  "participant_id",
  "condition",
  "trial_number",
  "timestamp",
  "duration_ms",
  "correct",
  "outcome",
  "target_id",
  "selected_ids",
];