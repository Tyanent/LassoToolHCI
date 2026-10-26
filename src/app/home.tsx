import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import { Path, Svg } from "react-native-svg";

//SVG container dimensions
const height = 900 
const width = 380

type Point = { x: number; y: number };
type AppIcon = { 
  id: string; 
  label: string; 
  x: number; 
  y: number; 
  size: number;
  groupId?: string;
 };

// const Xspacing = 100; // Spacing between app icons center
// const Yspacing = 110; // Spacing between app icons center
// const iconSize = 64; // Size of each app icon
// const numColumns = 3; // Number of columns in the grid (4 icons per row)
// const numRows = 5; // Number of rows in the grid (6 icons per column)


// const APPS: AppIcon[] = [
//   { id: "1", label: "Mail", x: 40, y: 120, size: iconSize },
//   { id: "2", label: "Photos", x: 140, y: 120, size: iconSize },
//   { id: "3", label: "Music", x: 240, y: 120, size: iconSize },
//   { id: "4", label: "Maps", x: 40, y: 230, size: iconSize },
//   { id: "5", label: "Camera", x: 140, y: 230, size: iconSize },
//   { id: "6", label: "Notes", x: 240, y: 230, size: iconSize },
//   { id: "7", label: "Clock", x: 40, y: 340, size: iconSize },
//   { id: "8", label: "Weather", x: 140, y: 340, size: iconSize },
//   { id: "9", label: "Settings", x: 240, y: 340, size: iconSize },
//   { id: "10", label: "Phone", x: 40, y: 440, size: iconSize },
// ];

//Dynamic Adjustment for icon positions based on the number of columns and rows
const startX = 15;
const startY = 40;
const iconSize = 64;
const Xspacing = 100;
const Yspacing = 100;
const numColumns = 4;

var labels = ["Mail","Photos","Music","Maps","Camera","Notes","Clock","Weather","Settings","Phone"];

const APPS: AppIcon[] = labels.map((label, i) => {
  const col = i % numColumns;
  const row = Math.floor(i / numColumns);
  return {
    id: String(i + 1),
    label,
    x: startX + col * Xspacing,
    y: startY + row * Yspacing,
    size: iconSize,
  };
});

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


type JigglingAppIconProps = {
  app: AppIcon;
  selected: boolean;
};

// JigglingAppIcon component to animate the app icons when selected
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
        styles.app, // Apply the app style
        {
          left: app.x,
          top: app.y,
          width: app.size,
          height: app.size,
          shadowColor: "#000",
          shadowOffset: selected
            ? { width: 0, height: 2 }
            : { width: 0, height: 0 },
          shadowOpacity: selected ? 0.8 : 0.3,
          shadowRadius: selected ? 4 : 2,
          elevation: 5,
          transform: [{ rotate }],
        },
      ]}
    >
      <Image
        source={require("../../assets/LassoToolAssets/app.png")}
        style={{ width: "100%", height: "100%" }}
      />
    </Animated.View>
  );
}


export default function Index() {
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [apps, setApps] = useState<AppIcon[]>(APPS);
  const groupIdCounter = useRef(0); // Counter to generate unique group IDs


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
    onDeactivate: () => {   // user stops dragging
     setCurrentPath((prev) => {

        if (prev.length >= 3) {
          // Test each app's center against the lasso polygon
          const inside = apps.filter((app) => !app.groupId).filter((app) =>
            pointInPolygon(
              { x: app.x + app.size / 2, y: app.y + app.size / 2 },
              prev
            )
          ).map((app) => app.id);

          console.log("Selected app IDs:", selectedIds);
          
          // setSelectedIds(inside);
          setSelectedIds((prev) => [...new Set([...prev, ...inside])]);
          setPaths((old) => [...old, prev]);
          setPaths([]); // Clear the selection path after selection
        }
        return [];
      });
    }
  });
//Clear selected
  const handleClearButtonClick = () => {
    setPaths([]);
    setCurrentPath([]);
    setSelectedIds([]);
  };
//Group selected apps
  const groupSelectedApps = () => {
      const selectedApps = apps.filter((app) => selectedIds.includes(app.id));
      if (selectedApps.length <= 1){
        console.log("Not enough apps selected to form a group.");
        return;
      } 

      const groupId = `group-${groupIdCounter.current++}`; // groupID increments from 1
      console.log(`Created group ${groupId} with`, selectedIds);

      setApps((prev) =>
        prev.map((app) =>
          selectedIds.includes(app.id) ? { ...app, groupId } : app
        )
      );
      setSelectedIds([]);
      
    };
//Reset apps
  const ungroupSelectedApps = () => {
    setApps((prev) =>
      prev.map((app) => ({ ...app, groupId: undefined }))
    );
    setSelectedIds([]);
    groupIdCounter.current = 0; // Reset the group ID counter
  }
  //Rendering the app icons and the lasso selection path
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/LassoToolAssets/ios_wallpaper.png")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />

        {/* Placeholder app icons */}
        {apps
          .filter((app) => !app.groupId)
          .map((app) => (
            <JigglingAppIcon
              key={app.id}
              app={app}
              selected={selectedIds.includes(app.id)}
            />
          ))} 
        {/* {APPS.map((app) => {
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
                  shadowColor: "#000",
                  shadowOffset: selected? { width: 0, height: 2 }: { width: 0, height: 0 },
                  shadowOpacity: selected ? 0.8 : 0.3,
                  shadowRadius: selected ? 4 : 2,
                  elevation: 5          
                },
              ]}
            >
            <Image source={require("../../assets/LassoToolAssets/app.png")}  style ={{ width: "100%", height: "100%" }}/>
            </View>
          );
        })} */}

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
        {/* Buttons */}
        <View style = {{ flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 20, marginTop: 10 }}>
          <TouchableOpacity 
          style={styles.Button} 
          onPress={handleClearButtonClick}>
          <Text style={styles.ButtonText}>Clear Selection</Text>
          </TouchableOpacity>
          <TouchableOpacity 
          style={styles.Button} 
          onPress={() => groupSelectedApps()}>
          <Text style={styles.ButtonText}>Group Selected</Text>
          </TouchableOpacity>
          <TouchableOpacity 
          style={styles.Button} 
          onPress={() => ungroupSelectedApps()}>
          <Text style={styles.ButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
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
  Button: {
    marginTop: 10,
    backgroundColor: "black",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: "center",
    width: "30%",
  },
  ButtonText: { 
    color: "white", 
    fontSize: 16, 
    fontWeight: "bold" ,
    textAlign: "center",
  },
 app: {
    position: "absolute",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: require("../../assets/LassoToolAssets/app.png"),
  },
  // groupButton: {
  //   marginTop: 10,
  //   backgroundColor: "black",
  //   paddingVertical: 20,
  //   paddingHorizontal: 20,
  //   borderRadius: 5,
  //   alignItems: "center",
  // },
  // groupButtonText: {
  //   color: "white",
  //   fontSize: 16,
  //   fontWeight: "bold",
  // },
  
});