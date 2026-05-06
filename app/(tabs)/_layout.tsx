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

import { getI18n } from "@/constants/i18n";

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
    label: keyof ReturnType<typeof getI18n>["strings"]["tabs"];
    icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  }
> = {
  index: {
    label: "home",
    icon: "rocket-launch-outline",
  },
  recent: {
    label: "recent",
    icon: "timeline-clock-outline",
  },
  saved: {
    label: "saved",
    icon: "shield-key-outline",
  },
};

function FuturisticTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { strings } = getI18n();
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
    <View style={styles.tabBarWrap}>
      <View
        style={[
          styles.tabBar,
          {
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
        ]}
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
                bottom: 7 + insets.bottom,
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
            label: "home",
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
                {strings.tabs[meta.label]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { strings } = getI18n();

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
          title: strings.tabs.home,
        }}
      />
      <Tabs.Screen
        name="recent"
        options={{
          title: strings.tabs.recent,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: strings.tabs.saved,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBar: {
    height: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
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
