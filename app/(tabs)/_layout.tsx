import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import React from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function FuturisticTabIcon({
  icon,
  color,
  focused,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconCapsule, focused && styles.iconCapsuleActive]}>
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={focused ? "#dffbff" : color}
      />
    </View>
  );
}

const TAB_META: Record<
  string,
  {
    label: string;
    icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  }
> = {
  index: {
    label: "Ana Menu",
    icon: "rocket-launch-outline",
  },
  recent: {
    label: "Son Kayitlar",
    icon: "timeline-clock-outline",
  },
  saved: {
    label: "Kaydedilenler",
    icon: "shield-key-outline",
  },
};

function FuturisticTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = React.useState(0);
  const indicatorX = React.useRef(new Animated.Value(0)).current;
  const itemWidth = barWidth > 0 ? barWidth / state.routes.length : 0;

  React.useEffect(() => {
    if (itemWidth === 0) {
      return;
    }

    Animated.timing(indicatorX, {
      toValue: state.index * itemWidth,
      duration: 210,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [indicatorX, itemWidth, state.index]);

  return (
    <View
      style={[
        styles.tabBarWrap,
        {
          bottom: Math.max(insets.bottom + 4, 8),
        },
      ]}
    >
      <View
        style={styles.tabBar}
        onLayout={(event) => {
          setBarWidth(event.nativeEvent.layout.width);
        }}
      >
        {itemWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeTrack,
              {
                width: itemWidth,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          >
            <View style={styles.activeTrackInner} />
          </Animated.View>
        )}

        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = TAB_META[route.name] ?? {
            label: route.name,
            icon: "circle-outline",
          };

          return (
            <Pressable
              key={route.key}
              style={styles.tabButton}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (!focused) {
                  navigation.navigate(route.name);
                }
              }}
            >
              <FuturisticTabIcon
                icon={meta.icon}
                color={focused ? "#b4e3ff" : "#6f87a0"}
                focused={focused}
              />
              <Text style={[styles.label, focused && styles.labelActive]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <FuturisticTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Menü",
        }}
      />
      <Tabs.Screen
        name="recent"
        options={{
          title: "Son Kayıtlar",
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Kaydedilenler",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    position: "absolute",
    left: 12,
    right: 12,
  },
  tabBar: {
    height: 60,
    borderRadius: 20,
    borderTopWidth: 0,
    backgroundColor: "rgba(7, 21, 36, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(93, 180, 255, 0.35)",
    elevation: 0,
    flexDirection: "row",
    overflow: "hidden",
  },
  activeTrack: {
    position: "absolute",
    top: 7,
    bottom: 7,
    paddingHorizontal: 6,
    zIndex: 0,
  },
  activeTrackInner: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(99, 244, 243, 0.95)",
    backgroundColor: "rgba(46, 205, 205, 0.14)",
    shadowColor: "#3ad6f0",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  iconCapsule: {
    width: 38,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(33, 56, 79, 0.38)",
  },
  iconCapsuleActive: {
    backgroundColor: "rgba(46, 205, 205, 0.26)",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6f87a0",
    marginTop: 2,
  },
  labelActive: {
    color: "#cfffff",
  },
});
