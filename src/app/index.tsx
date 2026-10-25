import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import { Path, Svg } from "react-native-svg";

const height = 900
const width = 380
type Point = { x: number; y: number };
type AppIcon = { id: string; label: string; x: number; y: number; size: number };

const APPS: AppIcon[] = [
  { id: "1", label: "Mail", x: 40, y: 120, size: 64 },
  { id: "2", label: "Photos", x: 140, y: 120, size: 64 },
  { id: "3", label: "Music", x: 240, y: 120, size: 64 },
  { id: "4", label: "Maps", x: 40, y: 230, size: 64 },
  { id: "5", label: "Camera", x: 140, y: 230, size: 64 },
  { id: "6", label: "Notes", x: 240, y: 230, size: 64 },
  { id: "7", label: "Clock", x: 40, y: 340, size: 64 },
  { id: "8", label: "Weather", x: 140, y: 340, size: 64 },
  { id: "9", label: "Settings", x: 240, y: 340, size: 64 },
  { id: "10", label: "Phone", x: 40, y: 440, size: 64 },
];

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function Index() {
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toSvgPath = (points: Point[]) =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(0)},${p.y.toFixed(0)}`)
      .join(" ");

  const drag = usePanGesture({ // dragging gesture to draw the path
    onBegin: (e) => {
      setCurrentPath([{ x: e.x, y: e.y }]);
    },
    onUpdate: (e) => {
      setCurrentPath((prev) => [...prev, { x: e.x, y: e.y }]);
    },
    onDeactivate: () => {   // 
     setCurrentPath((prev) => {
        // Need at least 3 points to form a closed shape
        if (prev.length >= 3) {
          // Test each app's center against the lasso polygon
          const inside = APPS.filter((app) =>
            pointInPolygon(
              { x: app.x + app.size / 2, y: app.y + app.size / 2 },
              prev
            )
          ).map((app) => app.id);

          console.log("Selected app IDs:", selectedIds);

          // setSelectedIds(inside);
          setSelectedIds((prev) => [...new Set([...prev, ...inside])]);
          setPaths((old) => [...old, prev]);
          setPaths([]);
        }
        return [];
      });
    }
  });

  const handleClearButtonClick = () => {
    setPaths([]);
    setCurrentPath([]);
    setSelectedIds([]);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/LassoToolAssets/ios_wallpaper.png")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />

        {/* Placeholder app icons */}
        {APPS.map((app) => {
          const selected = selectedIds.includes(app.id);
          return (
            <View
              key={app.id}
              style={[
                styles.app,
                {
                  left: app.x,
                  top: app.y,
                  width: app.size,
                  height: app.size,
                  backgroundColor: selected ? "#007AFF" : "#E0E0E0",
                },
              ]}
            >
            </View>
          );
        })}

        <GestureDetector gesture={drag}>
          <View style={styles.svgContainer}>
            <Svg height={height * 0.7} width={width}>
              {paths.map((path, index) => (
                <Path
                  key={`path-${index}`}
                  d={`${toSvgPath(path)} Z`}
                  stroke="black"
                  fill="rgba(255,0,0,0.1)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={[4, 4]}
                />
                
              ))}
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
        <TouchableOpacity 
        style={styles.clearButton} 
        onPress={handleClearButtonClick}>
        <Text style={styles.clearButtonText}>Clear Selection</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    alignItems: "center"
  },
  svgContainer: {
    height: height * 0.7,
    width,
    borderColor: "black",
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  clearButton: {
    marginTop: 10,
    backgroundColor: "black",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: "center",
  },
  clearButtonText: { 
    color: "white", 
    fontSize: 16, 
    fontWeight: "bold" 
  },
 app: {
    position: "absolute",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: require("../../assets/LassoToolAssets/app.png"),
  },
  
});