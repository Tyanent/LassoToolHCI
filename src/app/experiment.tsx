import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Button, Platform, StyleSheet, Text, View } from "react-native";
import {
  clearAllExperimentData,
  Condition,
  CSV_HEADERS,
  flipCondition,
  getLastLog,
  getLogs,
  getOrAssignCondition,
  getOrCreateParticipantId,
  startTimer,
  toCsvRow,
  TrialLog,
} from "./experimentSession";

type Phase = "idle" | "running" | "done";


export default function ExperimentScreen() {
  const [participantId, setParticipantId] = useState("");
  const [condition, setCondition] = useState<Condition>("baseline");
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastLog, setLastLog] = useState<TrialLog | null>(null);
  const [logs, setLogs] = useState<TrialLog[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [id, cond, allLogs, newest] = await Promise.all([
        getOrCreateParticipantId(),
        getOrAssignCondition(),
        getLogs(),
        getLastLog(),
      ]);
      if (cancelled) return;
      setParticipantId(id);
      setCondition(cond);
      setLogs(allLogs);
      if (newest) {
        setLastLog(newest);
        setPhase("done");
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = async () => {
    await startTimer();
    setPhase("running");
  };
  
  const handleExport = async () => {
    if (logs.length === 0) return;
    const csv = [CSV_HEADERS.join(","), ...logs.map(toCsvRow)].join("\n");
    const content = "\ufeff" + csv;

    if (Platform.OS === "web") {
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `experiment_${participantId}_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const fileUri = FileSystem.cacheDirectory + `experiment_log.csv`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Save experiment data",
        UTI: "public.comma-separated-values-text",
      });
    }
  };

  // NEW: start another task without wiping the accumulated logs
  const handleNewTask = async () => {
  const next = await flipCondition();
  setCondition(next);
  setLastLog(null);
  setPhase("idle");
  };

  const handleReset = async () => {
    await clearAllExperimentData();
    setPhase("idle");
    setLastLog(null);
    setLogs([]);
    setParticipantId(await getOrCreateParticipantId());
    setCondition(await getOrAssignCondition());
  };

  if (!ready) return <Text style={styles.loading}>Loading…</Text>;

  if (phase === "idle") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>User Study</Text>
        <Text style={styles.info}>Participant ID: {participantId}</Text>
        <Text style={styles.info}>Assigned condition: {condition}</Text>

        <Text style={styles.brief}>
          Your task: Create 5 folders, each containing 4 apps. The timer starts
          when you press Start and stops when you create your 5th folder.
        </Text>

        <Button title="Start Task" onPress={handleStart} />
      </View>
    );
  }

  if (phase === "running") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Task in progress…</Text>
        <Text style={styles.info}>
          Use the{" "}
          <Text style={styles.emphasis}>
            {condition === "baseline" ? "Baseline" : "Lasso"}
          </Text>{" "}
          tab to create 5 folders with 4 apps each.
        </Text>
        <Text style={styles.info}>
          When you create your 5th folder, the timer stops automatically and
          your result is saved. Come back to this tab to see it.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Task Results</Text>
      <Text style={styles.info}>Participant: {participantId}</Text>
      <Text style={styles.info}>Condition: {condition}</Text>
      {lastLog && (
        <>
          <Text style={styles.info}>
            Time taken: {(lastLog.duration_sec / 1000).toFixed(2)} s
          </Text>
          <Text style={styles.info}>
            Result: {lastLog.correct ? "Task completed" : "Incomplete"}
          </Text>
        </>
      )}
      <Text style={styles.info}>Total trials logged: {logs.length}</Text>

      <View style={styles.buttonGroup}>
        <Button title="New Task" onPress={handleNewTask} />
        <Button title="Export CSV" onPress={handleExport} />
        <Button title="New Participant" onPress={handleReset} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 10 },
  loading: { flex: 1, textAlign: "center", marginTop: 100 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  info: { fontSize: 16 },
  emphasis: { fontWeight: "700", color: "#007AFF" },
  brief: {
    fontSize: 15,
    marginVertical: 16,
    lineHeight: 22,
    backgroundColor: "#f2f2f2",
    padding: 12,
    borderRadius: 8,
  },
  buttonGroup: { marginTop: 24, gap: 12 },
});