import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Platform, StyleSheet, Text, View } from "react-native";
import {
  clearAllExperimentData,
  CSV_HEADERS,
  getCurrentTrial,
  getLogs,
  getOrCreateParticipantId,
  startTimer,
  TASKS,
  toCsvRow,
  TrialLog,
  TrialPlanEntry,
} from "./experimentSession";

type Phase = "idle" | "done" | "complete";

type CurrentTrial = {
  index: number;
  total: number;
  trial: TrialPlanEntry;
};

export default function ExperimentScreen() {
  const [participantId, setParticipantId] = useState("");
  const [currentTrial, setCurrentTrial] = useState<CurrentTrial | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastLog, setLastLog] = useState<TrialLog | null>(null);
  const [logs, setLogs] = useState<TrialLog[]>([]);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const shownLogCountRef = useRef(0);

  // Initial mount
  useEffect(() => {
    (async () => {
      const [id, trial, allLogs] = await Promise.all([
        getOrCreateParticipantId(),
        getCurrentTrial(),
        getLogs(),
      ]);
      setParticipantId(id);
      setCurrentTrial(trial);
      setLogs(allLogs);
      shownLogCountRef.current = allLogs.length;
      setPhase(trial ? "idle" : "complete");
      setReady(true);
    })();
  }, []);

  // On focus (returning from baseline/lasso)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [trial, allLogs] = await Promise.all([
          getCurrentTrial(),
          getLogs(),
        ]);
        if (cancelled) return;
        setCurrentTrial(trial);
        setLogs(allLogs);

        if (allLogs.length > shownLogCountRef.current) {
          // A new trial was completed while we were away
          setLastLog(allLogs[allLogs.length - 1]);
          shownLogCountRef.current = allLogs.length;
          setPhase(trial ? "done" : "complete");
        } else {
          setPhase(trial ? "idle" : "complete");
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleStart = async () => {
    if (!currentTrial) return;
    await startTimer();
    router.navigate(
      currentTrial.trial.condition === "baseline" ? "/baseline" : "/"
    );
  };

  const handleNext = async () => {
    setLastLog(null);
    const trial = await getCurrentTrial();
    setCurrentTrial(trial);
    setPhase(trial ? "idle" : "complete");
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

  const handleReset = async () => {
    await clearAllExperimentData();
    shownLogCountRef.current = 0;
    const [id, trial] = await Promise.all([
      getOrCreateParticipantId(),
      getCurrentTrial(),
    ]);
    setParticipantId(id);
    setCurrentTrial(trial);
    setLastLog(null);
    setLogs([]);
    setPhase(trial ? "idle" : "complete");
  };

  if (!ready) return <Text style={styles.loading}>Loading…</Text>;

  if (phase === "complete") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Study Complete</Text>
        <Text style={styles.info}>Participant: {participantId}</Text>
        <Text style={styles.info}>Trials completed: {logs.length}</Text>

        <View style={styles.buttonGroup}>
          <Button title="Export CSV" onPress={handleExport} />
          <Button
            title="New Participant"
            onPress={handleReset}
            color="red"
          />
        </View>
      </View>
    );
  }

  if (!currentTrial) return <Text style={styles.loading}>Loading…</Text>;

  const spec = TASKS[currentTrial.trial.taskId];
  const conditionLabel =
    currentTrial.trial.condition === "baseline" ? "Baseline" : "Lasso";

  if (phase === "idle") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Trial {currentTrial.index + 1} of {currentTrial.total}
        </Text>
        <Text style={styles.info}>Participant: {participantId}</Text>
        <Text style={styles.info}>Condition: {conditionLabel}</Text>
        <Text style={styles.info}>Task: {spec.label}</Text>

        <Text style={styles.brief}>{spec.brief}</Text>

        <Button title="Start Task" onPress={handleStart} />
        <Button
            title="New Participant"
            onPress={handleReset}
            color="red"
          />
      </View>
    );
  }

  // phase === "done"
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trial Complete</Text>
      <Text style={styles.info}>Participant: {participantId}</Text>

      {lastLog && (
        <>
          <Text style={styles.info}>
            Condition:{" "}
            {lastLog.condition === "baseline" ? "Baseline" : "Lasso"}
          </Text>
          <Text style={styles.info}>
            Task: {TASKS[lastLog.taskId].label}
          </Text>
          <Text style={styles.info}>
            Time taken: {(lastLog.duration_sec / 1000).toFixed(2)} s
          </Text>
          <Text style={styles.info}>
            Result: {lastLog.correct ? "Completed" : "Incomplete"}
          </Text>
        </>
      )}

      <Text style={styles.info}>
        {currentTrial
          ? `Next: trial ${currentTrial.index + 1} of ${currentTrial.total}`
          : "All trials complete"}
      </Text>

      <View style={styles.buttonGroup}>
        <Button
          title={currentTrial ? "Next Task" : "Finish"}
          onPress={handleNext}
        />
        <Button title="Export CSV" onPress={handleExport} />
        <Button
          title="New Participant"
          onPress={handleReset}
          color="red"
        />
        <Button
          title="Reset Plan (dev)"
          onPress={async () => {
            await clearAllExperimentData();
            shownLogCountRef.current = 0;
            const [id, trial] = await Promise.all([
              getOrCreateParticipantId(),
              getCurrentTrial(),
            ]);
            setParticipantId(id);
            setCurrentTrial(trial);
            setLastLog(null);
            setLogs([]);
            setPhase(trial ? "idle" : "complete");
          }}
          color="orange"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 10 },
  loading: { flex: 1, textAlign: "center", marginTop: 100 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  info: { fontSize: 16 },
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