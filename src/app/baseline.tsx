import { Image } from "expo-image";
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

// ---------- Helpers ----------
function rectContains(
  rect: { x: number; y: number; size: number },
  px: number,
  py: number
) {
  return (
    px >= rect.x &&
    px <= rect.x + rect.size &&
    py >= rect.y &&
    py <= rect.y + rect.size
  );
}

// Find the folder or ungrouped app under a point, excluding the dragged app
function findDropTarget(
  px: number,
  py: number,
  apps: AppIcon[],
  folders: Folder[],
  draggedId: string
): { kind: "app"; id: string } | { kind: "folder"; id: string } | null {
  // Folders take priority (they sit on top)
  for (const f of folders) {
    if (rectContains({ x: f.x, y: f.y, size: f.size }, px, py)) {
      return { kind: "folder", id: f.id };
    }
  }
  for (const a of apps) {
    if (a.id === draggedId) continue;
    if (a.groupId) continue; // hidden apps can't be targets
    if (rectContains({ x: a.x, y: a.y, size: a.size }, px, py)) {
      return { kind: "app", id: a.id };
    }
  }
  return null;
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
  onDragStart: (id: string) => void;
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
      runOnJS(onDragStart)(app.id);
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
  const [apps, setApps] = useState<AppIcon[]>(APPS);
  const [folders, setFolders] = useState<Folder[]>([]);
  const groupIdCounter = useRef(0);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverTarget, setHoverTarget] = useState<
    { kind: "app" | "folder"; id: string } | null
  >(null);

  // ---------- Drag handlers ----------
  const handleDragStart = (id: string) => {
    setDraggingId(id);
    setHoverTarget(null);
  };

  const handleDragMove = (id: string, absX: number, absY: number) => {
    setDragPos({ x: absX, y: absY });

    // Use the finger position (not the icon top-left) as the hit point
    const target = findDropTarget(
      absX,
      absY,
      apps,
      folders,
      id
    );
    setHoverTarget(target);
  };

  const handleDragEnd = (id: string, absX: number, absY: number) => {
    if (absX >= 0 && absY >= 0) {
      const target = findDropTarget(absX, absY, apps, folders, id);

      if (target?.kind === "app") {
        // Create a new folder containing both apps, at the target's position
        const targetApp = apps.find((a) => a.id === target.id);
        const dragged = apps.find((a) => a.id === id);
        if (targetApp && dragged) {
          const groupId = `group-${groupIdCounter.current++}`;
          setApps((prev) =>
            prev.map((a) =>
              a.id === dragged.id || a.id === targetApp.id
                ? { ...a, groupId }
                : a
            )
          );
          setFolders((prev) => [
            ...prev,
            {
              id: groupId,
              label: `Folder ${groupIdCounter.current}`,
              x: targetApp.x,
              y: targetApp.y,
              size: iconSize,
              containerHeight,
              appIds: [dragged.id, targetApp.id],
            },
          ]);
        }
      } else if (target?.kind === "folder") {
        // Add the dragged app to the existing folder
        setApps((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, groupId: target.id } : a
          )
        );
        setFolders((prev) =>
          prev.map((f) =>
            f.id === target.id
              ? { ...f, appIds: [...f.appIds, id] }
              : f
          )
        );
      }
      // If target is null, the app snaps back to its original position
      // (we haven't changed its x/y, so nothing to undo)
    }

    setDraggingId(null);
    setDragPos(null);
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
              // Placeholder: add a modal later
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
        {draggedApp && dragPos && (
          <View
            pointerEvents="none"
            style={[
              styles.floatingIcon,
              {
                left: dragPos.x - draggedApp.size / 2,
                top: dragPos.y - draggedApp.size / 2,
                width: draggedApp.size,
                height: draggedApp.size,
              },
            ]}
          >
            <Image
              source={require("../../assets/LassoToolAssets/app.png")}
              style={{ width: "100%", height: "100%", borderRadius: 14 }}
            />
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