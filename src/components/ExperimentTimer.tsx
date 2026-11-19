// components/ExperimentTimer.tsx
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getStartTime } from "../lib/experimentSession";

function formatElapsed(ms: number) {
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/**
 * Small elapsed-time pill for experiment screens. Reads the same start time
 * that completeTask() uses for duration_Sec, so it matches the CSV. Renders
 * nothing when no trial is active (e.g. opened from the header without
 * pressing "Start Task").
 */
export default function ExperimentTimer() {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let id: ReturnType<typeof setInterval> | undefined;

      (async () => {
        const start = await getStartTime();
        if (cancelled) return;
        setStartTime(start);
        if (start == null) return;
        const tick = () => setElapsed(Date.now() - start);
        tick();
        id = setInterval(tick, 100);
      })();

      return () => {
        cancelled = true;
        if (id) clearInterval(id);
      };
    }, []),
  );

  if (startTime == null) return null;

  return (
    <View pointerEvents="none" style={styles.pill}>
      <Text style={styles.text}>{formatElapsed(elapsed)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    top: 8, // the custom header already handles the safe-area inset
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 100,
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
