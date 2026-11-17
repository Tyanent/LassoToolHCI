// name=baseline.tsx
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
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
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  completeTask,
  getCurrentTrial,
  isTaskSatisfied,
  layoutStyleForTask,
  pageStyleForTask,
} from "./experimentSession";
// ---------- Layout ----------
const height = 900;
const width = 380;
const startX = 25;
const startY = 15;
const iconSize = 64;
const Xspacing = 95;
const Yspacing = 95;
const numColumns = 4;
const labelHeight = 15;
const containerHeight = iconSize + labelHeight;

// ---------- Types ----------
type AppIcon = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  containerHeight: number;
  groupId?: string;
  page: number;
};

type Folder = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  containerHeight: number;
  appIds: string[];
  page: number;
};

const labels = [
  "Mail", "Photos", "Music", "Maps",
  "Camera", "Notes", "Clock", "Weather",
  "Settings", "Phone", "Wallet", "Messages",
  "Calendar", "Reminders", "Stocks", "Books",
  "Podcasts", "Health", "Files", "Bank",
  "Search", "Socials", "Contacts", "Calculator",
];

// ---------- Page config ----------
const PAGE_COUNT = 3;

// ---------- Grid layout (page 1) ----------
const APPS: AppIcon[] = labels.map((label, i) => {
  const col = i % numColumns;
  const row = Math.floor(i / numColumns);
  return {
    id: String(i + 1),
    label,
    x: startX + col * Xspacing,
    y: startY + row * Yspacing,
    size: iconSize,
    containerHeight,
    page: 1,
  };
});

// ---------- Clustered & scattered layouts (page 1) ----------
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
  [0, 0], [0, 1], [0, 2], [0, 3],
  [1, 1], [1, 2],
  [2, 1], [2, 2], [2, 3],
  [3, 2], [3, 3],
];
const SCATTERED_CELLS_3: Array<[row: number, col: number]> = [
  [0, 0], [0, 1],
  [1, 0], [1, 1],
  [2, 2], [2, 3],
  [3, 2], [3, 3],
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
  Array<[number, number]>
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
      containerHeight,
      page: 1,
    };
  });
}

const APPS_SCATTERED_BY_MODE: Record<
  Exclude<LayoutMode, "grid">,
  AppIcon[]
> = {
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

const SHOW_LAYOUT_TOGGLE = true;

// ---------- Decoy pages ----------
const PAGE_2_LABELS = [
  "Gym", "Travel", "Shop", "News",
  "Recipes", "Finance", "Scanner", "Translate",
];
const PAGE_3_LABELS = [
  "Podcasts 2", "Health 2", "Files 2", "Bank 2",
  "Notes 2", "Books 2", "Stocks 2", "Reminders 2",
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
      containerHeight,
      page: pageIndex,
    };
  });
}

const APPS_PAGE_2 = buildDecoyPage(PAGE_2_LABELS, 2);
const APPS_PAGE_3 = buildDecoyPage(PAGE_3_LABELS, 3);

// ---------- Layout visibility helper ----------
// True when an app is on the current page but hidden by the active layout's
// cell count. Only numbered page-1 apps can be hidden this way; decoy apps
// (ids like "p2-3") have NaN id and are never layout-hidden.
function isHiddenByLayout(
  app: AppIcon,
  currentPage: number,
  mode: LayoutMode
): boolean {
  if (app.page !== currentPage) return false;
  if (currentPage !== 1) return false;
  const limit = scatteredAppCountFor(mode);
  if (limit === undefined) return false;
  const n = Number(app.id);
  if (Number.isNaN(n)) return false;
  return n > limit;
}

// ---------- Helpers ----------
function findDropTarget(
  draggedCenterX: number,
  draggedCenterY: number,
  apps: AppIcon[],
  folders: Folder[],
  draggedId: string,
  currentPage: number,
  layoutMode: LayoutMode,
  maxDistance: number = 60
): { kind: "app"; id: string } | { kind: "folder"; id: string } | null {
  let best: { kind: "app" | "folder"; id: string } | null = null;
  let bestDist = maxDistance;

  for (const f of folders) {
    if (f.page !== currentPage) continue;
    const cx = f.x + f.size / 2;
    const cy = f.y + f.size / 2;
    const d = Math.hypot(cx - draggedCenterX, cy - draggedCenterY);
    if (d < bestDist) {
      bestDist = d;
      best = { kind: "folder", id: f.id };
    }
  }

  for (const a of apps) {
    if (a.id === draggedId) continue;
    if (a.groupId) continue;
    if (a.page !== currentPage) continue;
    if (isHiddenByLayout(a, currentPage, layoutMode)) continue;
    const cx = a.x + a.size / 2;
    const cy = a.y + a.size / 2;
    const d = Math.hypot(cx - draggedCenterX, cy - draggedCenterY);
    if (d < bestDist) {
      bestDist = d;
      best = { kind: "app", id: a.id };
    }
  }
  return best;
}

// ---------- Draggable app icon ----------
function DraggableAppIcon({
  app,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  app: AppIcon;
  isDragging: boolean;
  onDragStart: (id: string, absX: number, absY: number) => void;
  onDragMove: (id: string, absX: number, absY: number) => void;
  onDragEnd: (id: string, absX: number, absY: number) => void;
}) {
  const pan = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((e) => {
      runOnJS(onDragStart)(app.id, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      runOnJS(onDragMove)(app.id, e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(app.id, e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      runOnJS(onDragEnd)(app.id, -1, -1);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.app,
          {
            left: app.x,
            top: app.y,
            width: app.size,
            height: app.containerHeight,
            opacity: isDragging ? 0.4 : 1,
            zIndex: isDragging ? 999 : 1,
          },
        ]}
      >
        <Image
          source={require("../../assets/LassoToolAssets/app.png")}
          style={styles.appImage}
        />
        <Text numberOfLines={1} style={styles.appLabel}>
          {app.label}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ---------- Folder tile ----------
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
    .map((id) => apps.find((a) => a.id === id))
    .filter(Boolean)
    .slice(0, 9) as AppIcon[];

  return (
    <View
      style={[
        styles.folderWrapper,
        { left: folder.x, top: folder.y, width: folder.size },
      ]}
    >
      <Animated.View
        style={[styles.folderTile, { width: folder.size, height: folder.size }]}
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
      </Animated.View>
      <Text numberOfLines={1} style={styles.folderLabel}>
        {folder.label}
      </Text>
    </View>
  );
}

// ---------- Main screen ----------
export default function Index() {
  const router = useRouter();
  const [apps, setApps] = useState<AppIcon[]>([
    ...APPS,
    ...APPS_PAGE_2,
    ...APPS_PAGE_3,
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const groupIdCounter = useRef(0);

  // ---------- Pager state ----------
  const [page, setPage] = useState<0 | 1 | 2>(0);
  const [showPager, setShowPager] = useState(true);

  const goToPage = (next: number) => {
    if (next < 0 || next >= PAGE_COUNT) return;
    setPage(next as 0 | 1 | 2);
  };

  // ---------- Layout mode ----------
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");

  const applyLayout = (next: LayoutMode) => {
    setLayoutMode(next);

    const positions = appsForMode(next);
    const posById = new Map(positions.map((a) => [a.id, a]));

    setApps((prev) =>
      prev.map((app) => {
        if (app.page !== 1) return app;
        const pos = posById.get(app.id);
        return pos ? { ...app, x: pos.x, y: pos.y } : app;
      })
    );

    if (next !== "grid") {
      const limit = SCATTERED_CELLS_BY_MODE[next].length;
      const hidden = (app: AppIcon) => {
        if (app.page !== 1) return false;
        const n = Number(app.id);
        return !Number.isNaN(n) && n > limit;
      };

      setFolders((prev) =>
        prev.filter(
          (f) =>
            f.page !== 1 ||
            f.appIds.every((id) => {
              const targetApp = apps.find((a) => a.id === id);
              return targetApp ? !hidden(targetApp) : true;
            })
        )
      );
      setApps((prev) =>
        prev.map((app) =>
          hidden(app) ? { ...app, groupId: undefined } : app
        )
      );
    }
  };

  const cycleLayout = () => {
    if (page !== 0) return;
    const next =
      LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(layoutMode) + 1) % LAYOUT_CYCLE.length];
    applyLayout(next);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const trial = await getCurrentTrial();
      if (cancelled || !trial) return;
      const style = layoutStyleForTask(trial.trial.taskId);
      applyLayout(style === "clustered" ? "clustered" : "scattered-1");
      
      if (pageStyleForTask(trial.trial.taskId) === "multi") {
              setShowPager(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Drag tracking ----------
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverTarget, setHoverTarget] = useState<
    { kind: "app" | "folder"; id: string } | null
  >(null);

  const dragHomeRef = useRef<{
    id: string;
    page: number;
    x: number;
    y: number;
    size: number;
    baseAbsX: number;
    baseAbsY: number;
  } | null>(null);

  const dragStartRef = useRef<{ absX: number; absY: number } | null>(null);
  const edgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFlippedRef = useRef<boolean>(false);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const handleDragStart = (id: string, absX: number, absY: number) => {
    const app = apps.find((a) => a.id === id);
    if (!app) return;

    dragStartRef.current = { absX, absY };
    dragHomeRef.current = {
      id,
      page: app.page,
      x: app.x,
      y: app.y,
      size: app.size,
      baseAbsX: absX,
      baseAbsY: absY,
    };
    dragX.value = 0;
    dragY.value = 0;
    hasFlippedRef.current = false;
    setDraggingId(id);
    setHoverTarget(null);
  };

  // Edge-flip: move the app's x/y to the destination page's center, but
  // DO NOT change its `page` field. The origin page is needed for
  // multi-page validation — see handleDragEnd.
  const handlePageSwitchDuringDrag = (
    targetPage: number,
    absX: number,
    absY: number,
    id: string
  ) => {
    if (targetPage < 0 || targetPage >= PAGE_COUNT) return;
    if (hasFlippedRef.current) return;

    const home = dragHomeRef.current;
    if (!home || home.id !== id) return;

    hasFlippedRef.current = true;
    if (edgeTimerRef.current) {
      clearTimeout(edgeTimerRef.current);
      edgeTimerRef.current = null;
    }

    const ghostGlobalX = home.x + dragX.value;
    const ghostGlobalY = home.y + dragY.value;

    // Land near the center of the destination page so the ghost doesn't
    // stick to the edge after the flip.
    const newPageX = startX + 1 * Xspacing;
    const newPageY = startY + 2 * Yspacing;

    const newBaseAbsX = absX - (ghostGlobalX - newPageX);
    const newBaseAbsY = absY - (ghostGlobalY - newPageY);

    dragHomeRef.current = {
      id,
      page: targetPage + 1,
      x: newPageX,
      y: newPageY,
      size: home.size,
      baseAbsX: newBaseAbsX,
      baseAbsY: newBaseAbsY,
    };

    // Update x/y only — leave `page` untouched so validation can see the
    // app's origin page after it's dropped into a folder.
    setApps((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, x: newPageX, y: newPageY } : a
      )
    );

    setPage(targetPage as 0 | 1 | 2);

    dragX.value = ghostGlobalX - newPageX;
    dragY.value = ghostGlobalY - newPageY;
    dragStartRef.current = { absX: newBaseAbsX, absY: newBaseAbsY };

    setHoverTarget(null);
  };

  const handleDragMove = (id: string, absX: number, absY: number) => {
    const start = dragStartRef.current;
    const home = dragHomeRef.current;
    if (!start || !home || home.id !== id) return;

    const deltaX = absX - start.absX;
    const deltaY = absY - start.absY;

    dragX.value = deltaX;
    dragY.value = deltaY;

    const centerX = home.x + home.size / 2 + deltaX;
    const centerY = home.y + home.size / 2 + deltaY;

    const CENTER_MIN = 60;
    const CENTER_MAX = width - 60;

    if (centerX >= CENTER_MIN && centerX <= CENTER_MAX) {
      hasFlippedRef.current = false;
    }

    if (centerX <= 0 && home.page - 1 > 0) {
      if (!hasFlippedRef.current && !edgeTimerRef.current) {
        edgeTimerRef.current = setTimeout(() => {
          handlePageSwitchDuringDrag(home.page - 2, absX, absY, id);
          edgeTimerRef.current = null;
        }, 400);
      }
    } else if (centerX >= width && home.page - 1 < PAGE_COUNT - 1) {
      if (!hasFlippedRef.current && !edgeTimerRef.current) {
        edgeTimerRef.current = setTimeout(() => {
          handlePageSwitchDuringDrag(home.page, absX, absY, id);
          edgeTimerRef.current = null;
        }, 400);
      }
    } else {
      if (edgeTimerRef.current && centerX > 0 && centerX < width) {
        clearTimeout(edgeTimerRef.current);
        edgeTimerRef.current = null;
      }
    }

    const target = findDropTarget(
      centerX,
      centerY,
      apps,
      folders,
      id,
      home.page,
      layoutMode
    );
    setHoverTarget(target);
  };

  const handleDragEnd = async (id: string, absX: number, absY: number) => {
    if (edgeTimerRef.current) {
      clearTimeout(edgeTimerRef.current);
      edgeTimerRef.current = null;
    }
    hasFlippedRef.current = false;

    const start = dragStartRef.current;
    const home = dragHomeRef.current;
    dragStartRef.current = null;
    dragHomeRef.current = null;

    if (!start || !home || home.id !== id || absX < 0 || absY < 0) {
      setDraggingId(null);
      setHoverTarget(null);
      dragX.value = 0;
      dragY.value = 0;
      return;
    }

    const currentPage = home.page;
    const deltaX = absX - start.absX;
    const deltaY = absY - start.absY;
    const centerX = home.x + home.size / 2 + deltaX;
    const centerY = home.y + home.size / 2 + deltaY;

    const target = findDropTarget(
      centerX,
      centerY,
      apps,
      folders,
      id,
      currentPage,
      layoutMode
    );

    let nextFolders = folders;
    let handledAsFolderOp = false;

    if (target?.kind === "app") {
      const targetApp = apps.find((a) => a.id === target.id);
      // Target is guaranteed to be on currentPage by findDropTarget.
      // The dragged app may originate on any page — that's how folders
      // span multiple pages.
      if (targetApp) {
        const groupId = `group-${groupIdCounter.current++}`;
        setApps((prev) =>
          prev.map((a) =>
            a.id === home.id || a.id === targetApp.id
              ? { ...a, groupId }
              : a
          )
        );

        nextFolders = [
          ...folders,
          {
            id: groupId,
            label: `Folder ${groupIdCounter.current}`,
            x: targetApp.x,
            y: targetApp.y,
            size: iconSize,
            containerHeight,
            appIds: [home.id, targetApp.id],
            page: currentPage,
          },
        ];
        setFolders(nextFolders);
        handledAsFolderOp = true;
      }
    } else if (target?.kind === "folder") {
      const targetFolder = folders.find((f) => f.id === target.id);
      if (targetFolder) {
        setApps((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, groupId: target.id } : a
          )
        );

        nextFolders = folders.map((f) =>
          f.id === target.id ? { ...f, appIds: [...f.appIds, id] } : f
        );
        setFolders(nextFolders);
        handledAsFolderOp = true;
      }
    }

    if (!handledAsFolderOp) {
      // Free drop — commit the landing page and position.
      const finalX = Math.max(
        0,
        Math.min(width - iconSize, home.x + deltaX)
      );
      const finalY = Math.max(
        0,
        Math.min(height - 200, home.y + deltaY)
      );
      setApps((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, x: finalX, y: finalY, page: currentPage }
            : a
        )
      );
    }

    const pageOfHelper = (appId: string) => {
      const found = apps.find((a) => a.id === appId);
      return found ? found.page : 1;
    };

    const foldersSnapshot = nextFolders.map((f) => ({ appIds: f.appIds }));

    if (await isTaskSatisfied(foldersSnapshot, pageOfHelper)) {
      const log = await completeTask({
        folders: foldersSnapshot,
        targetId: String(foldersSnapshot.flatMap((f) => f.appIds).length),
        pageOf: pageOfHelper,
      });

      if (log) {
        console.log("Baseline task logged:", log);
        router.navigate("/experiment");
      }
    }

    setDraggingId(null);
    setHoverTarget(null);
    dragX.value = 0;
    dragY.value = 0;
  };

  const floatingAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
    ],
  }));

  // ---------- Page swipe ----------
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      const SWIPE_THRESHOLD = 60;
      if (e.translationX < -SWIPE_THRESHOLD) {
        runOnJS(goToPage)(page + 1);
      } else if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(goToPage)(page - 1);
      }
    });

  // ---------- Derived ----------
  // Hide unused apps per the "hide the unused apps" request, but:
  //   - decoy apps (NaN id) dragged onto page 1 must remain visible, and
  //   - the currently-dragged app must remain rendered on the destination
  //     page so the ghost has something to sit on (and so it can be dropped).
  const visibleApps = apps.filter((a) => {
    if (a.groupId) return false;

    // Layout-hidden numbered apps are hidden everywhere.
    if (isHiddenByLayout(a, page + 1, layoutMode)) return false;

    // The dragged app renders regardless of which page it currently lives
    // on — it needs to be present on the destination page to be dropped.
    if (a.id === draggingId) return true;

    if (a.page !== page + 1) return false;
    return true;
  });

  const handleReset = () => {
    setApps(
      [
        ...APPS.map((a) => ({ ...a, page: 1 })),
        ...APPS_PAGE_2.map((a) => ({ ...a, page: 2 })),
        ...APPS_PAGE_3.map((a) => ({ ...a, page: 3 })),
      ].map((a) => ({ ...a, groupId: undefined }))
    );
    setFolders([]);
    groupIdCounter.current = 0;
    setLayoutMode("grid");
    setPage(0);
    dragStartRef.current = null;
    dragHomeRef.current = null;
    setDraggingId(null);
    setHoverTarget(null);
    hasFlippedRef.current = false;
    dragX.value = 0;
    dragY.value = 0;
  };

  const visibleFolders = folders.filter((f) => f.page === page + 1);

  const draggedApp = draggingId
    ? apps.find((a) => a.id === draggingId)
    : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={swipe}>
        <View style={styles.container}>
          <Image
            source={require("../../assets/LassoToolAssets/ios_wallpaper.png")}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />

          <View style={styles.chipColumn} pointerEvents="box-none">
            {SHOW_LAYOUT_TOGGLE && page === 0 && (
              <TouchableOpacity
                style={styles.layoutToggle}
                onPress={cycleLayout}
              >
                <Text style={styles.layoutToggleText}>
                  Layout: {LAYOUT_LABEL[layoutMode]}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.layoutToggle}
              onPress={() => setShowPager((v) => !v)}
            >
              <Text style={styles.layoutToggleText}>
                Pager: {showPager ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
          </View>

          {visibleApps.map((app) => (
            <DraggableAppIcon
              key={app.id}
              app={app}
              isDragging={draggingId === app.id}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            />
          ))}

          {visibleFolders.map((folder) => (
            <FolderTile
              key={folder.id}
              folder={folder}
              apps={apps}
              onOpen={() => {
                console.log("Open folder", folder.id);
              }}
            />
          ))}

          {hoverTarget && (
            <DropHighlight
              target={hoverTarget}
              apps={apps}
              folders={folders}
            />
          )}

          {draggedApp && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.floatingIcon,
                {
                  left: draggedApp.x,
                  top: draggedApp.y,
                  width: draggedApp.size,
                  height: draggedApp.containerHeight,
                },
                floatingAnimatedStyle,
              ]}
            >
              <Image
                source={require("../../assets/LassoToolAssets/app.png")}
                style={{
                  width: draggedApp.size,
                  height: draggedApp.size,
                  borderRadius: 14,
                }}
              />
              <Text numberOfLines={1} style={styles.appLabel}>
                {draggedApp.label}
              </Text>
            </Animated.View>
          )}

          {showPager && (
            <View style={styles.pagerBar} pointerEvents="box-none">
              <View style={styles.dots}>
                {Array.from({ length: PAGE_COUNT }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, page === i && styles.dotActive]}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.resetRow} pointerEvents="box-none">
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function DropHighlight({
  target,
  apps,
  folders,
}: {
  target: { kind: "app" | "folder"; id: string };
  apps: AppIcon[];
  folders: Folder[];
}) {
  const pos =
    target.kind === "app"
      ? apps.find((a) => a.id === target.id)
      : folders.find((f) => f.id === target.id);
  if (!pos) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: pos.x - 4,
        top: pos.y - 4,
        width: pos.size + 8,
        height: pos.size + 8,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: "#007AFF",
        backgroundColor: "rgba(0,122,255,0.15)",
      }}
    />
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  app: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  appImage: {
    width: iconSize,
    height: iconSize,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  appLabel: {
    width: iconSize,
    height: labelHeight,
    lineHeight: labelHeight,
    fontSize: 12,
    textAlign: "center",
    color: "white",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  folderWrapper: { position: "absolute", alignItems: "center" },
  folderTile: {
    borderRadius: 14,
    backgroundColor: "rgba(220,220,220,0.35)",
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
    height: labelHeight,
    lineHeight: labelHeight,
    fontSize: 12,
    textAlign: "center",
    color: "white",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  floatingIcon: {
    position: "absolute",
    zIndex: 1000,
  },
  chipColumn: {
    position: "absolute",
    top: 8,
    left: 12,
    gap: 6,
    zIndex: 50,
  },
  layoutToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  layoutToggleText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  pagerBar: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    zIndex: 10,
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
  dotActive: { backgroundColor: "white" },
  resetRow: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    zIndex: 10,
  },
  resetButton: {
    backgroundColor: "black",
    opacity: 0.6,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 100,
  },
  resetButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
});