import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { Path, Svg } from "react-native-svg";
import { completeTask, isTaskSatisfied } from "./experimentSession";

// SVG container dimensions
const height = 900;
const width = 400;

type Point = { x: number; y: number };

type AppIcon = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  groupId?: string;
  containerHeight: number;
};

type Folder = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  containerHeight: number;
  appIds: string[];
  open: boolean;
};

// Icon positions
const startX = 15;
const startY = 40;
const iconSize = 64;
const Xspacing = 100;
const Yspacing = 100;
const numColumns = 4;
const LabelHeight = 15;

// ── Pager config ─────────────────────────────────────────────
const PAGE_COUNT = 3;

const PAGE_OF = (id: string): number => {
  if (id.startsWith("p2-")) return 2;
  if (id.startsWith("p3-")) return 3;
  return 1;
};
// ─────────────────────────────────────────────────────────────

const labels = [
  "Mail", "Photos", "Music", "Maps",
  "Camera", "Notes", "Clock", "Weather",
  "Settings", "Phone", "Wallet", "Messages",
  "Calendar", "Reminders", "Stocks", "Books",
  "Podcasts", "Health", "Files", "Bank",
];

const APPS: AppIcon[] = labels.map((label, i) => {
  const col = i % numColumns;
  const row = Math.floor(i / numColumns);

  return {
    id: String(i + 1),
    label,
    x: startX + col * Xspacing,
    y: startY + row * Yspacing,
    size: iconSize,
    containerHeight: iconSize + LabelHeight,
  };
});

// ── Decoy pages ──────────────────────────────────────────────
const PAGE_2_LABELS = [
  "Gym",
  "Travel",
  "Shop",
  "News",
  "Recipes",
  "Finance",
  "Scanner",
  "Translate",
];

const PAGE_3_LABELS = [
  "Podcasts 2",
  "Health 2",
  "Files 2",
  "Bank 2",
  "Notes 2",
  "Books 2",
  "Stocks 2",
  "Reminders 2",
];

function buildDecoyPage(labels: string[], pageIndex: number): AppIcon[] {
  return labels.map((label, i) => {
    const col = i % numColumns;
    const row = Math.floor(i / numColumns);
    return {
      id: `p${pageIndex}-${i + 1}`,
      label,
      x: startX + col * Xspacing,
      y: startY + row * Yspacing,
      size: iconSize,
      containerHeight: iconSize + LabelHeight,
    };
  });
}

const APPS_PAGE_2 = buildDecoyPage(PAGE_2_LABELS, 2);
const APPS_PAGE_3 = buildDecoyPage(PAGE_3_LABELS, 3);
// ─────────────────────────────────────────────────────────────

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

type JigglingAppIconProps = {
  app: AppIcon;
  selected: boolean;
};

function JigglingAppIcon({ app, selected }: JigglingAppIconProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (selected) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(rotation, {
            toValue: 2,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(rotation, {
            toValue: -2,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );

      animRef.current.start();
    } else {
      animRef.current?.stop();
      rotation.setValue(0);
    }

    return () => {
      animRef.current?.stop();
    };
  }, [selected, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-2deg", "2deg"],
  });

  return (
    <Animated.View
      style={[
        styles.app,
        {
          left: app.x,
          top: app.y,
          width: app.size,
          height: app.containerHeight,
          transform: [{ rotate }],
        },
      ]}
    >
      <Image
        source={require("../../assets/LassoToolAssets/app.png")}
        style={{
          width: app.size,
          height: app.size,
          borderRadius: 14,
          shadowColor: "#000",
          shadowOffset: selected
            ? { width: 0, height: 2 }
            : { width: 0, height: 0 },
          shadowOpacity: selected ? 0.8 : 0.3,
          shadowRadius: selected ? 4 : 2,
          elevation: 5,
        }}
      />

      <Text
        numberOfLines={1}
        style={{
          width: app.size,
          height: LabelHeight,
          lineHeight: LabelHeight,
          fontSize: 12,
          textAlign: "center",
          color: "white",
          textShadowColor: "rgba(0,0,0,0.6)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }}
      >
        {app.label}
      </Text>
    </Animated.View>
  );
}

function FolderTile({
  folder,
  apps,
  onOpen,
}: {
  folder: Folder;
  apps: AppIcon[];
  onOpen: () => void;
}) {
  const preview = folder.appIds
    .map((id) => apps.find((app) => app.id === id))
    .filter(Boolean)
    .slice(0, 9) as AppIcon[];

  return (
    <View
      style={[
        styles.folderWrapper,
        { left: folder.x, top: folder.y, width: folder.size },
      ]}
    >
      <TouchableOpacity
        style={[styles.folderTile, { width: folder.size, height: folder.size }]}
        onPress={onOpen}
      >
        <View style={styles.folderGrid}>
          {preview.map((app) => (
            <View key={app.id} style={styles.folderMini}>
              <Image
                source={require("../../assets/LassoToolAssets/app.png")}
                style={{ width: "100%", height: "100%" }}
              />
            </View>
          ))}
        </View>
      </TouchableOpacity>

      <Text numberOfLines={1} style={styles.folderLabel}>
        {folder.label}
      </Text>
    </View>
  );
}

export default function Index() {
  const router = useRouter();

  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const pathRef = useRef<Point[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [apps, setApps] = useState<AppIcon[]>([
    ...APPS,
    ...APPS_PAGE_2,
    ...APPS_PAGE_3,
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const groupIdCounter = useRef(0);

  // ── Pager state (tap-based, no gesture) ───────────────────
  const [page, setPage] = useState<0 | 1 | 2>(0);

  const goToPage = (next: number) => {
    if (next < 0 || next >= PAGE_COUNT) return;
    setPage(next as 0 | 1 | 2);
  };
  // ────────────────────────────────────────────────────────────

  const toSvgPath = (points: Point[]) =>
    points
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command}${point.x.toFixed(0)},${point.y.toFixed(0)}`;
      })
      .join(" ");

  // These helpers are called on the JS thread via runOnJS.
  const startLasso = (point: Point) => {
    pathRef.current = [point];
    setCurrentPath([point]);
  };

  const addLassoPoint = (point: Point) => {
    const nextPath = [...pathRef.current, point];
    pathRef.current = nextPath;
    setCurrentPath(nextPath);
  };

  const finishLasso = () => {
    const polygon = pathRef.current;
    pathRef.current = [];
    setCurrentPath([]);

    if (polygon.length < 3) return;

    // Only apps that exist on the currently visible page are lassoable.
    const pageIds = new Set(visibleApps.map((a) => a.id));

    const insideIds = apps
      .filter((app) => !app.groupId && pageIds.has(app.id))
      .filter((app) =>
        pointInPolygon(
          { x: app.x + app.size / 2, y: app.y + app.size / 2 },
          polygon
        )
      )
      .map((app) => app.id);

    if (insideIds.length === 0) return;

    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of insideIds) {
        if (next.has(id)) {
          next.delete(id); // already selected → unselect
        } else {
          next.add(id); // not selected → select
        }
      }
      return [...next];
    });
  };

  const drag = Gesture.Pan()
    .onStart((event) => {
      runOnJS(startLasso)({ x: event.x, y: event.y });
    })
    .onUpdate((event) => {
      runOnJS(addLassoPoint)({ x: event.x, y: event.y });
    })
    // onFinalize also handles a gesture that is cancelled.
    .onFinalize(() => {
      runOnJS(finishLasso)();
    });

  const handleClearButtonClick = () => {
    pathRef.current = [];
    setCurrentPath([]);
    setSelectedIds([]);
  };

  const messageOpacity = useRef(new Animated.Value(0)).current;
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);

    Animated.timing(messageOpacity, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    messageTimer.current = setTimeout(() => {
      Animated.timing(messageOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, 1500); // visible for 1.5s before fading out
  };

  const groupSelectedApps = async () => {
    const selectedApps = apps.filter((app) => selectedIds.includes(app.id));

    if (selectedApps.length <= 1) {
      console.log("Not enough apps selected to form a group.");
      showMessage();
      return;
    }

    const groupId = `group-${groupIdCounter.current++}`;
    console.log(`Created group ${groupId} with`, selectedIds);

    setApps((previous) =>
      previous.map((app) =>
        selectedIds.includes(app.id) ? { ...app, groupId } : app
      )
    );

    const firstApp = selectedApps[0];
    if (!firstApp) return;

    const newFolder: Folder = {
      id: groupId,
      label: `Folder ${groupIdCounter.current}`,
      x: firstApp.x,
      y: firstApp.y,
      size: iconSize,
      containerHeight: iconSize + LabelHeight,
      appIds: selectedIds,
      open: false,
    };

    const nextFolders = [...folders, newFolder];
    setFolders(nextFolders);
    setSelectedIds([]);

    const foldersSnapshot = nextFolders.map((f) => ({ appIds: f.appIds }));

    if (await isTaskSatisfied(foldersSnapshot, PAGE_OF)) {
      const log = await completeTask({
        folders: foldersSnapshot,
        targetId: String(foldersSnapshot.flatMap((f) => f.appIds).length),
        pageOf: PAGE_OF,
      });

      if (log) {
        console.log("Lasso task logged:", log);
        router.navigate("/experiment");
      }
    }
  };

  const ungroupSelectedApps = () => {
    setApps((previous) =>
      previous.map((app) => ({ ...app, groupId: undefined }))
    );
    setSelectedIds([]);
    setFolders([]);
    groupIdCounter.current = 0;
  };

  // ── Visible apps for the current page ──────────────────────
  const visibleApps = apps.filter(
    (a) => !a.groupId && PAGE_OF(a.id) === page + 1
  );
  // ────────────────────────────────────────────────────────────

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/LassoToolAssets/ios_wallpaper.png")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />

        {/* App grid for the active page — plain View, no gesture wrapper */}
        <View style={styles.pageContainer}>
          {visibleApps.map((app) => (
            <JigglingAppIcon
              key={app.id}
              app={app}
              selected={selectedIds.includes(app.id)}
            />
          ))}
        </View>

        {folders.map((folder) => (
          <FolderTile
            key={folder.id}
            folder={folder}
            apps={apps}
            onOpen={() =>
              setFolders((previous) =>
                previous.map((item) =>
                  item.id === folder.id
                    ? { ...item, open: !item.open }
                    : item
                )
              )
            }
          />
        ))}

        {/* Lasso overlay — transparent to touches so buttons are tappable */}
        <GestureDetector gesture={drag}>
          <View style={styles.svgContainer}>
            <Svg height={height * 0.7} width={width} pointerEvents="none">
              {currentPath.length > 1 && (
                <Path
                  d={toSvgPath(currentPath)}
                  stroke="black"
                  fill="transparent"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={[4, 4]}
                />
              )}
            </Svg>
          </View>
        </GestureDetector>

        {/* Page navigation + dots */}
        <View style={styles.pagerBar} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.pageButton, page === 0 && styles.pageButtonDisabled]}
            disabled={page === 0}
            onPress={() => goToPage(page - 1)}
          >
            <Text style={styles.pageButtonText}>‹ Prev</Text>
          </TouchableOpacity>

          <View style={styles.dots}>
            {Array.from({ length: PAGE_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, page === i && styles.dotActive]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.pageButton,
              page === PAGE_COUNT - 1 && styles.pageButtonDisabled,
            ]}
            disabled={page === PAGE_COUNT - 1}
            onPress={() => goToPage(page + 1)}
          >
            <Text style={styles.pageButtonText}>Next ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleClearButtonClick}
          >
            <Text style={styles.buttonText}>Clear Selection</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={groupSelectedApps}>
            <Text style={styles.buttonText}>Group Selected</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={ungroupSelectedApps}>
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { opacity: messageOpacity }]}
        >
          <Text style={styles.toastText}>Select at least 2 apps to group</Text>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  pageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  svgContainer: {
    height: height * 0.7,
    backgroundColor: "transparent",
  },
  pagerBar: {
    position: "absolute",
    bottom: 150,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    zIndex: 10,
  },
  pageButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pageButtonDisabled: {
    opacity: 0.35,
  },
  pageButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: "white",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
    marginTop: 10,
  },
  button: {
    marginTop: 10,
    backgroundColor: "black",
    opacity: 0.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    width: "30%",
  },
  buttonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  app: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  folderWrapper: {
    position: "absolute",
    alignItems: "center",
  },
  folderTile: {
    borderRadius: 14,
    backgroundColor: "rgba(99, 161, 247, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  folderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 48,
    height: 48,
    alignItems: "center",
    gap: 3,
  },
  folderMini: {
    width: 13,
    height: 13,
    borderRadius: 3,
    overflow: "hidden",
  },
  folderLabel: {
    width: iconSize,
    height: LabelHeight,
    lineHeight: LabelHeight,
    fontSize: 12,
    textAlign: "center",
    color: "white",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  toast: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
    maxWidth: "80%",
  },
  toastText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});