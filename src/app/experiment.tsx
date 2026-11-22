import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  clearAllExperimentData,
  CONDITION_MATRIX,
  CSV_HEADERS,
  ExperimentBlock,
  ExperimentCondition,
  getCurrentTrial,
  getLogs,
  getOrCreateParticipantId,
  startTimer,
  TASKS,
  toCsvRow,
  TrialLog,
  TrialPlanEntry,
} from "../lib/experimentSession";

type Phase = "blockIntro" | "idle" | "done" | "complete";

type CurrentTrial = {
  index: number;
  total: number;
  trial: TrialPlanEntry;
};

function conditionFromTaskId(taskId: string): ExperimentCondition {
  return (taskId.charAt(0) as ExperimentCondition) ?? "A";
}

function blockHeaderLabel(block: ExperimentBlock): string {
  return block === 1
    ? "Block 1 · Single Page (Trials 1–12)"
    : "Block 2 · Multi Page (Trials 13–24)";
}

function renderBlockBrief(block: ExperimentBlock) {
  if (block === 1) {
    return (
      <Text style={styles.brief}>
        In this first block, you will group apps on a single page using either
        the <Text style={styles.inlineLasso}>Lasso</Text> gesture or
        Drag-and-Drop (<Text style={styles.inlineBaseline}>Baseline</Text>)
        across clustered and scattered layouts.
      </Text>
    );
  }
  return (
    <Text style={styles.brief}>
      In this second block, tasks span multiple pages—group apps across
      different pages into folders using{" "}
      <Text style={styles.inlineLasso}>Lasso</Text> or{" "}
      <Text style={styles.inlineBaseline}>Baseline</Text> under the active
      layout.
    </Text>
  );
}

function PillButton({
  title,
  onPress,
  color = "#007AFF",
  compact = false,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.pillButton,
        compact && styles.pillButtonCompact,
        { backgroundColor: color },
      ]}
    >
      <Text
        style={[
          styles.pillButtonText,
          compact && styles.pillButtonTextCompact,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function ExperimentScreen() {
  const [participantId, setParticipantId] = useState("");
  const [currentTrial, setCurrentTrial] = useState<CurrentTrial | null>(null);
  const [phase, setPhase] = useState<Phase>("blockIntro");
  const [acknowledgedBlock, setAcknowledgedBlock] =
    useState<ExperimentBlock | null>(null);
  const [lastLog, setLastLog] = useState<TrialLog | null>(null);
  const [logs, setLogs] = useState<TrialLog[]>([]);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const shownLogCountRef = useRef(0);

  const syncPhaseForTrial = useCallback(
    (
      trial: CurrentTrial | null,
      ackBlock: ExperimentBlock | null,
      forceDone = false,
    ) => {
      if (!trial) {
        setPhase("complete");
        return;
      }
      if (forceDone) {
        setPhase("done");
        return;
      }
      if (ackBlock !== trial.trial.block) {
        setPhase("blockIntro");
      } else {
        setPhase("idle");
      }
    },
    [],
  );

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

      const initialAck: ExperimentBlock | null =
        trial && trial.index > 0 && trial.index !== 12
          ? trial.trial.block
          : null;
      setAcknowledgedBlock(initialAck);
      syncPhaseForTrial(trial, initialAck, false);
      setReady(true);
    })();
  }, [syncPhaseForTrial]);

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
          const latest = allLogs[allLogs.length - 1];
          setLastLog(latest);
          shownLogCountRef.current = allLogs.length;
          syncPhaseForTrial(trial, acknowledgedBlock, true);
        } else {
          syncPhaseForTrial(trial, acknowledgedBlock, false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [acknowledgedBlock, syncPhaseForTrial]),
  );

  const handleBeginBlock = () => {
    if (!currentTrial) return;
    setAcknowledgedBlock(currentTrial.trial.block);
    setPhase("idle");
  };

  const handleStart = async () => {
    if (!currentTrial) return;
    await startTimer();
    router.navigate(
      currentTrial.trial.condition === "baseline" ? "/baseline" : "/",
    );
  };

  const handleNext = async () => {
    setLastLog(null);
    const trial = await getCurrentTrial();
    setCurrentTrial(trial);
    syncPhaseForTrial(trial, acknowledgedBlock, false);
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
    setAcknowledgedBlock(null);
    const [id, trial] = await Promise.all([
      getOrCreateParticipantId(),
      getCurrentTrial(),
    ]);
    setParticipantId(id);
    setCurrentTrial(trial);
    setLastLog(null);
    setLogs([]);
    syncPhaseForTrial(trial, null, false);
  };

  if (!ready) return <Text style={styles.loading}>Loading…</Text>;

  if (phase === "complete") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Study Complete</Text>
        <Text style={styles.info}>Participant: {participantId}</Text>
        <Text style={styles.info}>Trials completed: {logs.length}</Text>

        <View style={styles.buttonGroup}>
          <PillButton title="Export CSV" onPress={handleExport} />
        </View>

        <View style={styles.secondaryActions}>
          <PillButton
            title="New Participant"
            onPress={handleReset}
            color="#6E7681"
          />
        </View>
      </View>
    );
  }

  if (!currentTrial) return <Text style={styles.loading}>Loading…</Text>;

  const activeBlock = currentTrial.trial.block;
  const insideBlock = acknowledgedBlock === activeBlock;

  if (phase === "blockIntro") {
    return (
      <View style={styles.container}>
        <Text style={styles.blockHeader}>Begin Block</Text>
        <Text style={styles.title}>{blockHeaderLabel(activeBlock)}</Text>
        <Text style={styles.info}>Participant: {participantId}</Text>
        {renderBlockBrief(activeBlock)}

        <View style={styles.buttonGroup}>
          <PillButton title="Begin Block" onPress={handleBeginBlock} />
        </View>

        <View style={styles.secondaryActions}>
          <PillButton
            title="New Participant"
            onPress={handleReset}
            color="#6E7681"
          />
        </View>
      </View>
    );
  }

  const spec = TASKS[currentTrial.trial.taskId];
  const isBaseline = currentTrial.trial.condition === "baseline";
  const methodLabel = isBaseline ? "Baseline" : "Lasso";
  const expCondition = conditionFromTaskId(currentTrial.trial.taskId);
  const expConditionLabel = CONDITION_MATRIX[expCondition].label;

  if (phase === "idle") {
    return (
      <View style={styles.container}>
        <Text style={styles.blockHeader}>
          {blockHeaderLabel(currentTrial.trial.block)}
        </Text>
        <Text style={styles.title}>
          Trial {currentTrial.index + 1} of {currentTrial.total}
        </Text>
        <Text style={styles.info}>Participant: {participantId}</Text>
        <Text
          style={[
            styles.methodBadge,
            isBaseline ? styles.baselineText : styles.lassoText,
          ]}
        >
          {methodLabel}
        </Text>
        <Text style={styles.info}>Layout cell: {expConditionLabel}</Text>
        <Text style={styles.info}>Task: {spec.label}</Text>

        <Text style={styles.brief}>{spec.brief}</Text>

        <View style={styles.buttonGroup}>
          <PillButton title="Start Task" onPress={handleStart} />
        </View>

        <View
          style={
            insideBlock ? styles.bottomCornerAction : styles.secondaryActions
          }
        >
          <PillButton
            title="New Participant"
            onPress={handleReset}
            color="#6E7681"
            compact={insideBlock}
          />
        </View>
      </View>
    );
  }

  // phase === "done"
  const lastIsBaseline = lastLog?.condition === "baseline";

  return (
    <View style={styles.container}>
      {lastLog && (
        <Text style={styles.blockHeader}>
          {blockHeaderLabel(lastLog.block)}
        </Text>
      )}
      <Text style={styles.title}>Trial Complete</Text>
      <Text style={styles.info}>Participant: {participantId}</Text>

      {lastLog && (
        <>
          <Text
            style={[
              styles.methodBadge,
              lastIsBaseline ? styles.baselineText : styles.lassoText,
            ]}
          >
            {lastIsBaseline ? "Baseline" : "Lasso"}
          </Text>
          <Text style={styles.info}>
            Layout cell:{" "}
            {CONDITION_MATRIX[conditionFromTaskId(lastLog.taskId)].label}
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
          ? `Next: trial ${currentTrial.index + 1} of ${currentTrial.total} (${blockHeaderLabel(currentTrial.trial.block)})`
          : "All trials complete"}
      </Text>

      <View style={styles.buttonGroup}>
        <PillButton
          title={currentTrial ? "Next Task" : "Finish"}
          onPress={handleNext}
        />
        <PillButton title="Export CSV" onPress={handleExport} />
        <PillButton
          title="Reset Plan (dev)"
          onPress={async () => {
            await clearAllExperimentData();
            shownLogCountRef.current = 0;
            setAcknowledgedBlock(null);
            const [id, trial] = await Promise.all([
              getOrCreateParticipantId(),
              getCurrentTrial(),
            ]);
            setParticipantId(id);
            setCurrentTrial(trial);
            setLastLog(null);
            setLogs([]);
            syncPhaseForTrial(trial, null, false);
          }}
          color="#F79009"
        />
      </View>

      <View
        style={
          insideBlock ? styles.bottomCornerAction : styles.secondaryActions
        }
      >
        <PillButton
          title="New Participant"
          onPress={handleReset}
          color="#6E7681"
          compact={insideBlock}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 10 },
  loading: { flex: 1, textAlign: "center", marginTop: 100 },
  blockHeader: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#007AFF",
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  info: { fontSize: 16 },
  methodBadge: {
    fontSize: 22,
    fontWeight: "800",
    marginVertical: 2,
  },
  lassoText: {
    color: "#D92D20",
  },
  baselineText: {
    color: "#1570EF",
  },
  inlineLasso: {
    color: "#D92D20",
    fontWeight: "700",
  },
  inlineBaseline: {
    color: "#1570EF",
    fontWeight: "700",
  },
  brief: {
    fontSize: 15,
    marginVertical: 16,
    lineHeight: 22,
    backgroundColor: "#f2f2f2",
    padding: 12,
    borderRadius: 8,
  },
  buttonGroup: { marginTop: 20, gap: 12 },
  secondaryActions: { marginTop: 32, gap: 12 },
  bottomCornerAction: {
    position: "absolute",
    bottom: 24,
    right: 24,
  },
  pillButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pillButtonCompact: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  pillButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  pillButtonTextCompact: {
    fontSize: 13,
  },
});