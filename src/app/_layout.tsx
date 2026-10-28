// app/_layout.tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

function HeaderBar() {
  const router = useRouter();
  const segments = useSegments();
  const current = segments[segments.length - 1];

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          disabled={!router.canGoBack()}
        >
          <Text style={styles.backText}>
            {router.canGoBack() ? "‹ Back" : ""}
          </Text>
        </Pressable>
      </View>

      <View style={styles.right}>
        <Pressable
          onPress={() => router.navigate("/")}
          style={({ pressed }) => [
            styles.navButton,
            current === undefined && styles.navButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.navText}>index</Text>
        </Pressable>
        <Pressable
          onPress={() => router.navigate("/baseline")}
          style={({ pressed }) => [
            styles.navButton,
            current === "baseline" && styles.navButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.navText}>Baseline</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        header: () => <HeaderBar />,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Index" }} />
      <Stack.Screen name="baseline" options={{ title: "Baseline" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    backgroundColor: "#111",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  left: { flexDirection: "row", alignItems: "center", minWidth: 70 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  backButton: { paddingVertical: 8, paddingHorizontal: 6 },
  backText: { color: "white", fontSize: 16, fontWeight: "600" },
  navButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  navButtonActive: { backgroundColor: "#007AFF" },
  navText: { color: "white", fontSize: 13, fontWeight: "600" },
  pressed: { opacity: 0.6 },
});