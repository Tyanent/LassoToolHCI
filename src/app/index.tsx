import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import { Path, Svg } from "react-native-svg";

const height = 900
const width = 380
type Point = { x: number; y: number };

export default function Index() {
  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  

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
        if (prev.length >= 2) {
          setPaths((old) => [...old, prev]);
        }
        return [];
      });
    },
  });

  const handleClearButtonClick = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/LassoToolAssets/ios_wallpaper.png")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
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
          onPress={handleClearButtonClick}
        >
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  clearButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
});