import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
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
import { completeTask, isTaskSatisfied } from "./experimentSession";

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
};

type Folder = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  containerHeight: number;
  appIds: string[];
  page: number; // NEW — 1-based page this folder lives on
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
  };
});

// ---------- Scattered layouts (page 1) ----------
const SCATTERED_CELLS_1: Array<[row: number, col: number]> = [
  [0, 0], [0, 1], [0, 2], [0, 3],
  [1, 2], [1, 3],
  [2, 2], [2, 3],
  [3, 0], [3, 1], [3, 2], [3, 3],
  [4, 0], [4, 1], [4, 2], [4, 3],
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

export type LayoutMode = "grid" | "scattered-1" | "scattered-2" | "scattered-3";

const LAYOUT_CYCLE: LayoutMode[] = [
  "grid",
  "scattered-1",
  "scattered-2",
  "scattered-3",
];

const SCATTERED_CELLS_BY_MODE: Record<
  Exclude<LayoutMode, "grid">,
  Array<[number, number]>
> = {
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
    };
  });
}

const APPS_SCATTERED_BY_MODE: Record<
  Exclude<LayoutMode, "grid">,
  AppIcon[]
> = {
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
  "scattered-1": "Scattered 1",
  "scattered-2": "Scattered 2",
  "scattered-3": "Scattered 3",
};

const SHOW_LAYOUT_TOGGLE = true;

// ---------- Decoy pages (pages 2 & 3) ----------
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
    };
  });
}

const APPS_PAGE_2 = buildDecoyPage(PAGE_2_LABELS, 2);
const APPS_PAGE_3 = buildDecoyPage(PAGE_3_LABELS, 3);

const PAGE_OF = (id: string): number => {
  if (id.startsWith("p2-")) return 2;
  if (id.startsWith("p3-")) return 3;
  return 1;
};

// ---------- Helpers ----------
function findDropTarget(
  draggedCenterX: number,
  draggedCenterY: number,
  apps: AppIcon[],
  folders: Folder[],
  draggedId: string,
  currentPage: number,
  maxDistance: number = 60
): { kind: "app"; id: string } | { kind: "folder"; id: string } | null {
  let best: { kind: "app" | "folder"; id: string } | null = null;
  let bestDist = maxDistance;

  // Only folders that live on the current page are eligible.
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

  // Only apps on the current page are eligible.
  for (const a of apps) {
    if (a.id === draggedId) continue;
    if (a.groupId) continue;
    if (PAGE_OF(a.id) !== currentPage) continue;
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
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const pan = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((e) => {
      startXRef.current = e.absoluteX;
      startYRef.current = e.absoluteY;
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

  // ---------- Layout mode (page 1 only) ----------
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");

  const cycleLayout = () => {
    if (page !== 0) return;

    const next =
      LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(layoutMode) + 1) % LAYOUT_CYCLE.length];
    setLayoutMode(next);

    const positions = appsForMode(next);
    const posById = new Map(positions.map((a) => [a.id, a]));

    setApps((prev) =>
      prev.map((app) => {
        const pos = posById.get(app.id);
        return pos ? { ...app, x: pos.x, y: pos.y } : app;
      })
    );

    if (next !== "grid") {
      const limit = SCATTERED_CELLS_BY_MODE[next].length;
      const hidden = (id: string) => {
        const n = Number(id);
        return !Number.isNaN(n) && n > limit;
      };

      // Drop folders that would become orphaned by hidden apps.
      setFolders((prev) =>
        prev.filter(
          (f) => f.page !== 1 || f.appIds.every((id) => !hidden(id))
        )
      );
      setApps((prev) =>
        prev.map((app) =>
          hidden(app.id) ? { ...app, groupId: undefined } : app
        )
      );
    }
  };

  // ---------- Drag handlers ----------
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverTarget, setHoverTarget] = useState<
    { kind: "app" | "folder"; id: string } | null
  >(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(
    null
  );
  const dragStartRef = useRef<{ absX: number; absY: number } | null>(null);

  const handleDragStart = (id: string, absX: number, absY: number) => {
    dragStartRef.current = { absX, absY };
    setDraggingId(id);
    setHoverTarget(null);
    setDragDelta({ x: 0, y: 0 });
  };

  const handleDragMove = (id: string, absX: number, absY: number) => {
    const start = dragStartRef.current;
    if (!start) return;

    const deltaX = absX - start.absX;
    const deltaY = absY - start.absY;
    setDragDelta({ x: deltaX, y: deltaY });

    const dragged = apps.find((a) => a.id === id);
    if (!dragged) return;

    const centerX = dragged.x + dragged.size / 2 + deltaX;
    const centerY = dragged.y + dragged.size / 2 + deltaY;

    const target = findDropTarget(
      centerX,
      centerY,
      apps,
      folders,
      id,
      page + 1
    );
    setHoverTarget(target);
  };

  const handleDragEnd = async (id: string, absX: number, absY: number) => {
    const start = dragStartRef.current;
    const dragged = apps.find((a) => a.id === id);
    dragStartRef.current = null;

    if (start && dragged && absX >= 0 && absY >= 0) {
      // All folder creation is page-scoped — this works on any page now.
      const currentPage = page + 1;
      const centerX = dragged.x + dragged.size / 2 + (absX - start.absX);
      const centerY = dragged.y + dragged.size / 2 + (absY - start.absY);

      const target = findDropTarget(
        centerX,
        centerY,
        apps,
        folders,
        id,
        currentPage
      );

      let nextFolders = folders;

      if (target?.kind === "app") {
        const targetApp = apps.find((a) => a.id === target.id);
        // Page checks are belt-and-braces — findDropTarget already filters.
        if (
          targetApp &&
          PAGE_OF(dragged.id) === currentPage &&
          PAGE_OF(targetApp.id) === currentPage
        ) {
          const groupId = `group-${groupIdCounter.current++}`;
          setApps((prev) =>
            prev.map((a) =>
              a.id === dragged.id || a.id === targetApp.id
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
              appIds: [dragged.id, targetApp.id],
              page: currentPage, // NEW — folder remembers its page
            },
          ];
          setFolders(nextFolders);
        }
      } else if (target?.kind === "folder") {
        const targetFolder = folders.find((f) => f.id === target.id);
        if (
          targetFolder &&
          targetFolder.page === currentPage &&
          PAGE_OF(dragged.id) === currentPage
        ) {
          setApps((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, groupId: target.id } : a
            )
          );

          nextFolders = folders.map((f) =>
            f.id === target.id
              ? { ...f, appIds: [...f.appIds, id] }
              : f
          );
          setFolders(nextFolders);
        }
      }

      const foldersSnapshot = nextFolders.map((f) => ({ appIds: f.appIds }));

      if (await isTaskSatisfied(foldersSnapshot, PAGE_OF)) {
        const log = await completeTask({
          folders: foldersSnapshot,
          targetId: String(foldersSnapshot.flatMap((f) => f.appIds).length),
          pageOf: PAGE_OF,
        });

        if (log) {
          console.log("Baseline task logged:", log);
          router.navigate("/experiment");
        }
      }
    }

    setDraggingId(null);
    setDragDelta(null);
    setHoverTarget(null);
  };

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
  const visibleApps = apps.filter((a) => {
    if (a.groupId) return false;
    const p = PAGE_OF(a.id);
    if (p !== page + 1) return false;

    if (page === 0) {
      const limit = scatteredAppCountFor(layoutMode);
      if (limit !== undefined) {
        const n = Number(a.id) - 1;
        if (Number.isNaN(n) || n >= limit) return false;
      }
    }
    return true;
  });
  
//Reset Button
  const handleReset = () => { 
  setApps(
    [...APPS, ...APPS_PAGE_2, ...APPS_PAGE_3].map((a) => ({
      ...a,
      groupId: undefined,
    }))
  );
  setFolders([]);
  groupIdCounter.current = 0;
  setLayoutMode("grid");
  setPage(0);
  dragStartRef.current = null;
  setDraggingId(null);
  setDragDelta(null);
  setHoverTarget(null);
};

  // Only folders that live on the current page render.
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

          {/* Test-only chips */}
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

          {/* Ungrouped apps on the current page only */}
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

          {/* Folders on the current page only */}
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

          {/* Drop highlight on the current page */}
          {hoverTarget && (
            <DropHighlight
              target={hoverTarget}
              apps={apps}
              folders={folders}
            />
          )}

          {/* Floating drag ghost */}
          {draggedApp && dragDelta && (
            <View
              pointerEvents="none"
              style={[
                styles.floatingIcon,
                {
                  left: draggedApp.x + dragDelta.x,
                  top: draggedApp.y + dragDelta.y,
                  width: draggedApp.size,
                  height: draggedApp.containerHeight,
                },
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
            </View>
          )}

          {/* Pager bar */}
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

// Highlight ring drawn around the drop target
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
  pageButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pageButtonDisabled: { opacity: 0.35 },
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