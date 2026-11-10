import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
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
const startX = 15;
const startY = 40;
const iconSize = 64;
const Xspacing = 100;
const Yspacing = 100;
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
};

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
    containerHeight,
  };
});

// Every app is on "page 1" in this single-page build; kept so the
// task validators in experimentSession receive a valid pageOf callback.
const PAGE_OF = (_id: string): number => 1;

// ---------- Helpers ----------
function findDropTarget(
  draggedCenterX: number,
  draggedCenterY: number,
  apps: AppIcon[],
  folders: Folder[],
  draggedId: string,
  maxDistance: number = 60
): { kind: "app"; id: string } | { kind: "folder"; id: string } | null {
  let best: { kind: "app" | "folder"; id: string } | null = null;
  let bestDist = maxDistance;

  // Folders take priority when close enough
  for (const f of folders) {
    const cx = f.x + f.size / 2;
    const cy = f.y + f.size / 2;
    const d = Math.hypot(cx - draggedCenterX, cy - draggedCenterY);
    if (d < bestDist) {
      bestDist = d;
      best = { kind: "folder", id: f.id };
    }
  }
  // Only check apps if no folder is closer
  for (const a of apps) {
    if (a.id === draggedId) continue;
    if (a.groupId) continue;
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
      // Safety: if the gesture is cancelled, still end the drag
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
  const [apps, setApps] = useState<AppIcon[]>(APPS);
  const [folders, setFolders] = useState<Folder[]>([]);
  const groupIdCounter = useRef(0);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverTarget, setHoverTarget] = useState<
    { kind: "app" | "folder"; id: string } | null
  >(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(
    null
  );
  const dragStartRef = useRef<{ absX: number; absY: number } | null>(null);

  // ---------- Drag handlers ----------
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

    // Center of the dragged icon in container space
    const centerX = dragged.x + dragged.size / 2 + deltaX;
    const centerY = dragged.y + dragged.size / 2 + deltaY;

    const target = findDropTarget(centerX, centerY, apps, folders, id);
    setHoverTarget(target);
  };

  const handleDragEnd = async (id: string, absX: number, absY: number) => {
    const start = dragStartRef.current;
    const dragged = apps.find((a) => a.id === id);
    dragStartRef.current = null;

    if (start && dragged && absX >= 0 && absY >= 0) {
      const centerX = dragged.x + dragged.size / 2 + (absX - start.absX);
      const centerY = dragged.y + dragged.size / 2 + (absY - start.absY);

      const target = findDropTarget(centerX, centerY, apps, folders, id);

      let nextFolders = folders;

      if (target?.kind === "app") {
        const targetApp = apps.find((a) => a.id === target.id);
        if (targetApp) {
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
            },
          ];
          setFolders(nextFolders);
        }
      } else if (target?.kind === "folder") {
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

      // ---- Completion check (task-aware) ----
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

  // ---------- Derived ----------
  const visibleApps = apps.filter((a) => !a.groupId);
  const draggedApp = draggingId
    ? apps.find((a) => a.id === draggingId)
    : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/LassoToolAssets/ios_wallpaper.png")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />

        {/* Home screen: ungrouped apps */}
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

        {/* Home screen: folders */}
        {folders.map((folder) => (
          <FolderTile
            key={folder.id}
            folder={folder}
            apps={apps}
            onOpen={() => {
              console.log("Open folder", folder.id);
            }}
          />
        ))}

        {/* Highlight the current drop target */}
        {hoverTarget && (
          <DropHighlight
            target={hoverTarget}
            apps={apps}
            folders={folders}
          />
        )}

        {/* Floating dragged icon following the finger */}
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
      </View>
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
});