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
import ExperimentTimer from "../components/ExperimentTimer";
import {
  completeTask,
  getCurrentTrial,
  isTaskSatisfied,
  layoutStyleForTask,
  pageStyleForTask,
} from "../lib/experimentSession";
// SVG container dimensions
const height = 890;
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
  page: number; // 1-based
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
  page: number; // 1-based — folder lives on this page
};

// Icon positions
const startX = 25;
const startY = 15;
const iconSize = 64;
const Xspacing = 95;
const Yspacing = 95;
const numColumns = 4;
const LabelHeight = 15;

// ── Pager config ─────────────────────────────────────────────
const PAGE_COUNT = 3;
// ─────────────────────────────────────────────────────────────

const labels = [
  "Mail",
  "Photos",
  "Music",
  "Maps",
  "Camera",
  "Notes",
  "Clock",
  "Weather",
  "Settings",
  "Phone",
  "Wallet",
  "Messages",
  "Calendar",
  "Reminders",
  "Stocks",
  "Books",
  "Podcasts",
  "Health",
  "Files",
  "Bank",
  "Search",
  "Socials",
  "Contacts",
  "Calculator",
];

// ── Grid layout ──────────────────────────────────────────────
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
    page: 1,
  };
});

// ── Clustered & scattered layouts for page 1 ─────────────────
const CLUSTERED_CELLS: Array<[row: number, col: number]> = [
  [0, 0], [0, 1], [0, 2], [0, 3],
  [1, 0], [1, 1], [1, 2], [1, 3],
  [2, 0], [2, 1], [2, 2], [2, 3],
];

const SCATTERED_CELLS_1: Array<[row: number, col: number]> = [
  [0, 0], [0, 2],
  [1, 0], [1, 2],
  [2, 1], [2, 3],
  [3, 0], [3, 1], [3, 3],
  [4, 1], [4, 2],
  [5, 0], [5, 3],
];
const SCATTERED_CELLS_2: Array<[row: number, col: number]> = [
  [0, 0], [0, 2], [0, 3],
  [1, 2], [1, 3],
  [2, 2], [2, 3],
  [3, 0], [3, 1],
  [4, 1], [4, 3],
  [5, 2],
];
const SCATTERED_CELLS_3: Array<[row: number, col: number]> = [
  [0, 0], [0, 1],
  [1, 0],
  [2, 2], [2, 3],
  [3, 0], [3, 1], [3, 3],
  [4, 1], [4, 2],
  [5, 0], [5, 3],
];

export type LayoutMode =
  | "grid"
  | "clustered"
  | "scattered-1"
  | "scattered-2"
  | "scattered-3";

const LAYOUT_CYCLE: LayoutMode[] = [
  "grid",
  "clustered",
  "scattered-1",
  "scattered-2",
  "scattered-3",
];

const SCATTERED_CELLS_BY_MODE: Record<
  Exclude<LayoutMode, "grid">,
  Array<[row: number, col: number]>
> = {
  clustered: CLUSTERED_CELLS,
  "scattered-1": SCATTERED_CELLS_1,
  "scattered-2": SCATTERED_CELLS_2,
  "scattered-3": SCATTERED_CELLS_3,
};

function buildScatteredApps(cells: Array<[number, number]>): AppIcon[] {
  return labels.slice(0, cells.length).map((label, i) => {
    const [row, col] = cells[i];
    return {
      id: String(i + 1),
      label,
      x: startX + col * Xspacing,
      y: startY + row * Yspacing,
      size: iconSize,
      containerHeight: iconSize + LabelHeight,
      page: 1,
    };
  });
}

const APPS_SCATTERED_BY_MODE: Record<Exclude<LayoutMode, "grid">, AppIcon[]> = {
  clustered: buildScatteredApps(CLUSTERED_CELLS),
  "scattered-1": buildScatteredApps(SCATTERED_CELLS_1),
  "scattered-2": buildScatteredApps(SCATTERED_CELLS_2),
  "scattered-3": buildScatteredApps(SCATTERED_CELLS_3),
};

function scatteredAppCountFor(mode: LayoutMode): number | undefined {
  return mode === "grid" ? undefined : SCATTERED_CELLS_BY_MODE[mode].length;
}

function appsForMode(mode: LayoutMode): AppIcon[] {
  return mode === "grid" ? APPS : APPS_SCATTERED_BY_MODE[mode];
}

const LAYOUT_LABEL: Record<LayoutMode, string> = {
  grid: "Grid",
  clustered: "Clustered (12)",
  "scattered-1": "Scattered 1",
  "scattered-2": "Scattered 2",
  "scattered-3": "Scattered 3",
};

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
  "Calendar",
  "Stocks", 
  "Files",
  "Contacts",
];
const PAGE_3_LABELS = [
  "Podcast",
  "Health",
  "Files",
  "Bank",
  "Notes",
  "Books",
  "Stocks",
  "Reminders",
  "Game",
  "Settings",
  "e-Health", 
  "Social"
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
      page: pageIndex,
    };
  });
}

function buildDecoyScatteredPage(
  pageLabels: string[],
  cells: Array<[number, number]>,
  pageIndex: number,
): AppIcon[] {
  return pageLabels.slice(0, cells.length).map((label, i) => {
    const [row, col] = cells[i];
    return {
      id: `p${pageIndex}-${i + 1}`,
      label,
      x: startX + col * Xspacing,
      y: startY + row * Yspacing,
      size: iconSize,
      containerHeight: iconSize + LabelHeight,
      page: pageIndex,
    };
  });
}

const APPS_PAGE_2 = buildDecoyPage(PAGE_2_LABELS, 2);
const APPS_PAGE_3 = buildDecoyPage(PAGE_3_LABELS, 3);

// Scattered variants for decoy pages. Page 2 uses SCATTERED_CELLS_2 and
// page 3 uses SCATTERED_CELLS_3.
const APPS_PAGE_2_SCATTERED = buildDecoyScatteredPage(
  PAGE_2_LABELS,
  SCATTERED_CELLS_2,
  2,
);
const APPS_PAGE_3_SCATTERED = buildDecoyScatteredPage(
  PAGE_3_LABELS,
  SCATTERED_CELLS_3,
  3,
);

// Clustered variants for decoy pages — reuse CLUSTERED_CELLS so all pages
// share the same 12-cell clustered look.
const APPS_PAGE_2_CLUSTERED = buildDecoyScatteredPage(
  PAGE_2_LABELS,
  CLUSTERED_CELLS,
  2,
);
const APPS_PAGE_3_CLUSTERED = buildDecoyScatteredPage(
  PAGE_3_LABELS,
  CLUSTERED_CELLS,
  3,
);

// "grid" leaves every page alone. Everything else (clustered + scattered-*)
// rearranges pages 1–3, but with different cell sets per mode/page.
function rearrangesPages(mode: LayoutMode): boolean {
  return mode !== "grid";
}

// Cells that apply to a given page under a given layout, or undefined if the
// layout doesn't rearrange that page.
function layoutCellsForPage(
  pageNumber: number,
  mode: LayoutMode,
): Array<[number, number]> | undefined {
  if (!rearrangesPages(mode)) return undefined;

  if (mode === "clustered") {
    // Clustered uses the same cell set for every page.
    return CLUSTERED_CELLS;
  }

  // Scattered modes: page 1 follows the mode, pages 2/3 use 2 and 3.
  if (pageNumber === 1) return SCATTERED_CELLS_BY_MODE[mode];
  if (pageNumber === 2) return SCATTERED_CELLS_2;
  if (pageNumber === 3) return SCATTERED_CELLS_3;
  return undefined;
}

// Prebuilt positions per page under a given layout, or undefined when the
// layout leaves that page's positions untouched (grid).
function positionsForPage(
  pageNumber: number,
  mode: LayoutMode,
): AppIcon[] | undefined {
  if (!rearrangesPages(mode)) return undefined;

  if (mode === "clustered") {
    if (pageNumber === 1) return APPS_SCATTERED_BY_MODE.clustered;
    if (pageNumber === 2) return APPS_PAGE_2_CLUSTERED;
    if (pageNumber === 3) return APPS_PAGE_3_CLUSTERED;
    return undefined;
  }

  // Scattered modes.
  if (pageNumber === 1) return APPS_SCATTERED_BY_MODE[mode];
  if (pageNumber === 2) return APPS_PAGE_2_SCATTERED;
  if (pageNumber === 3) return APPS_PAGE_3_SCATTERED;
  return undefined;
}

// True when an app is hidden by the active layout's cell count on its page.
// "grid" hides nothing. Clustered and scattered modes hide extras.
function isHiddenByLayout(
  app: AppIcon,
  currentPage: number,
  mode: LayoutMode,
): boolean {
  if (app.page !== currentPage) return false;
  if (!rearrangesPages(mode)) return false;

  const cells = layoutCellsForPage(currentPage, mode);
  if (!cells) return false;

  // Page-1 apps: numbered ids only.
  if (currentPage === 1) {
    const n = Number(app.id);
    if (Number.isNaN(n)) return false;
    return n > cells.length;
  }

  // Page-2/3 decoy apps: ids are `p{page}-{n}`.
  if (currentPage === 2 || currentPage === 3) {
    const match = /^p\d+-(\d+)$/.exec(app.id);
    if (!match) return false;
    return Number(match[1]) > cells.length;
  }

  return false;
}
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
        ]),
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
          shadowColor: "black",
          shadowOffset: selected
            ? { width: 0, height: 2 }
            : { width: 0, height: 0 },
          shadowOpacity: selected ? 0.5 : 0.3,
          shadowRadius: selected ? 2 : 1,
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

  // ── Layout mode ──────────────────────────────────────────
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");

  const applyLayoutForApps = (
    next: LayoutMode,
    baseApps: AppIcon[],
    baseFolders: Folder[],
  ) => {
    const nextApps = baseApps.map((app) => {
      const positions = positionsForPage(app.page, next);
      if (!positions) return app;
      const pos = positions.find((p) => p.id === app.id);
      return pos ? { ...app, x: pos.x, y: pos.y } : app;
    });

    // Only grid leaves everything untouched; every other layout can hide
    // apps that fall outside its cell count.
    if (!rearrangesPages(next)) {
      setApps(nextApps);
      setFolders(baseFolders);
      return;
    }

    const isHidden = (app: AppIcon) => isHiddenByLayout(app, app.page, next);
    const hiddenIds = new Set(nextApps.filter(isHidden).map((a) => a.id));

    setSelectedIds((prev) => prev.filter((id) => !hiddenIds.has(id)));
    setFolders(
      baseFolders.filter((f) => f.appIds.every((id) => !hiddenIds.has(id))),
    );
    setApps(
      nextApps.map((app) =>
        hiddenIds.has(app.id) ? { ...app, groupId: undefined } : app,
      ),
    );
  };

  const applyLayout = (next: LayoutMode) => {
    setLayoutMode(next);
    applyLayoutForApps(next, apps, folders);
  };

  const cycleLayout = () => {
    const next =
      LAYOUT_CYCLE[
        (LAYOUT_CYCLE.indexOf(layoutMode) + 1) % LAYOUT_CYCLE.length
      ];
    applyLayout(next);
  };

  // Auto-set the layout for the current trial's condition.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const trial = await getCurrentTrial();
      if (cancelled || !trial) return;
      const style = layoutStyleForTask(trial.trial.taskId);
      applyLayout(style === "clustered" ? "clustered" : "scattered-1");

      setShowPager(pageStyleForTask(trial.trial.taskId) === "multi");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ─────────────────────────────────────────────────────────

  const [showPager, setShowPager] = useState(false);
  const [page, setPage] = useState<0 | 1 | 2>(0);

  const goToPage = (next: number) => {
    if (next < 0 || next >= PAGE_COUNT) return;
    setPage(next as 0 | 1 | 2);
  };

  const toSvgPath = (points: Point[]) =>
    points
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command}${point.x.toFixed(0)},${point.y.toFixed(0)}`;
      })
      .join(" ");

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

    // Lassos only apps visible on the current page.
    const pageIds = new Set(visibleApps.map((a) => a.id));

    const insideIds = apps
      .filter((app) => !app.groupId && pageIds.has(app.id))
      .filter((app) =>
        pointInPolygon(
          { x: app.x + app.size / 2, y: app.y + app.size / 2 },
          polygon,
        ),
      )
      .map((app) => app.id);

    if (insideIds.length === 0) return;

    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of insideIds) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
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
    }, 1500);
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
        selectedIds.includes(app.id) ? { ...app, groupId } : app,
      ),
    );

    // Folder is placed on the page of the first selected app. Its appIds
    // may span pages — this is what allows multi-page tasks to complete.
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
      page: firstApp.page,
    };

    const nextFolders = [...folders, newFolder];
    setFolders(nextFolders);
    setSelectedIds([]);

    const foldersSnapshot = nextFolders.map((f) => ({ appIds: f.appIds }));

    const pageOfHelper = (appId: string) => {
      const found = apps.find((a) => a.id === appId);
      return found ? found.page : 1;
    };

    if (await isTaskSatisfied(foldersSnapshot, pageOfHelper)) {
      const log = await completeTask({
        folders: foldersSnapshot,
        targetId: String(foldersSnapshot.flatMap((f) => f.appIds).length),
        pageOf: pageOfHelper,
      });

      if (log) {
        console.log("Lasso task logged:", log);
        router.navigate("/experiment");
      }
    }
  };

  const ungroupSelectedApps = () => {
    const resetApps = [
      ...APPS.map((a) => ({ ...a, page: 1 })),
      ...APPS_PAGE_2.map((a) => ({ ...a, page: 2 })),
      ...APPS_PAGE_3.map((a) => ({ ...a, page: 3 })),
    ].map((a) => ({ ...a, groupId: undefined }));

    pathRef.current = [];
    setCurrentPath([]);
    setSelectedIds([]);
    groupIdCounter.current = 0;
    setPage(0);
    applyLayoutForApps(layoutMode, resetApps, []);
  };

  const visibleApps = apps.filter((a) => {
    if (a.groupId) return false;
    if (a.page !== page + 1) return false;

    // Hide apps that fall outside the active layout's cell count on this page.
    if (isHiddenByLayout(a, page + 1, layoutMode)) return false;

    return true;
  });

  const visibleFolders = folders.filter((f) => f.page === page + 1);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/LassoToolAssets/ios_wallpaper.png")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />

        <ExperimentTimer />

        <View style={styles.pageContainer}>
          {visibleApps.map((app) => (
            <JigglingAppIcon
              key={app.id}
              app={app}
              selected={selectedIds.includes(app.id)}
            />
          ))}
        </View>

        {visibleFolders.map((folder) => (
          <FolderTile
            key={folder.id}
            folder={folder}
            apps={apps}
            onOpen={() =>
              setFolders((previous) =>
                previous.map((item) =>
                  item.id === folder.id ? { ...item, open: !item.open } : item,
                ),
              )
            }
          />
        ))}

        <GestureDetector gesture={drag}>
          <View style={styles.svgContainer}>
            <Svg width={width} height={height} pointerEvents="none">
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

        {showPager && (
          <View style={styles.pagerBar} pointerEvents="box-none">
            <TouchableOpacity
              style={[
                styles.pageButton,
                page === 0 && styles.pageButtonDisabled,
              ]}
              disabled={page === 0}
              onPress={() => goToPage(page - 1)}
            >
              <Text style={styles.pageButtonText}>‹</Text>
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
              <Text style={styles.pageButtonText}>›</Text>
            </TouchableOpacity>
          </View>
        )}

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

        {/*Dev Toggle Buttons for Layout and Pager REMOVE LATER*/}
        <View style={styles.toggleRow}>
          <TouchableOpacity style={styles.toggleButton} onPress={cycleLayout}>
            <Text style={styles.toggleText}>
              Layout: {LAYOUT_LABEL[layoutMode]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowPager((v) => !v)}
          >
            <Text style={styles.toggleText}>
              Pager: {showPager ? "On" : "Off"}
            </Text>
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
  container: { flex: 1 },
  pageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  svgContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  pagerBar: {
    position: "absolute",
    bottom: 70,
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
  pageButtonDisabled: { opacity: 0.35 },
  pageButtonText: { color: "white", fontSize: 14, fontWeight: "600" },
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
  dotActive: { backgroundColor: "white" },

  buttonRow: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
    marginTop: 0,
  },
  button: {
    backgroundColor: "black",
    opacity: 0.5,
    paddingVertical: 8,
    paddingHorizontal: 10,
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
  toggleRow: {
    flexDirection: "column",
    gap: 5,
    marginTop: 12,
    marginLeft: 10,
    width: "40%",
  },
  toggleButton: {
    backgroundColor: "#333",
    opacity: 0.7,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
  toggleText: { color: "white", fontSize: 12, fontWeight: "700" },
  app: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  folderWrapper: { position: "absolute", alignItems: "center" },
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
  folderMini: { width: 13, height: 13, borderRadius: 3, overflow: "hidden" },
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