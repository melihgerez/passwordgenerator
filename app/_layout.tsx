import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";
import { Stack } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import "react-native-reanimated";

import { PasswordStoreProvider } from "@/contexts/password-store";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const appBackgroundColor = isDark ? "#081421" : "#f4f9ff";
  const lockBackgroundColor = isDark ? "#020914" : "#eaf3fb";
  const lockTextColor = isDark ? "#e6f7ff" : "#16314d";
  const lockSubTextColor = isDark ? "#8bc4e8" : "#4f718f";
  const lockButtonBackgroundColor = isDark
    ? "rgba(30, 132, 167, 0.45)"
    : "rgba(46, 126, 188, 0.16)";
  const lockButtonBorderColor = isDark
    ? "rgba(88, 228, 255, 0.7)"
    : "rgba(46, 126, 188, 0.35)";
  const [isLocked, setIsLocked] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");
  const isAuthInProgress = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const shouldAuthOnActiveRef = useRef(false);
  const appOpacity = useRef(new Animated.Value(0.72)).current;
  const appScale = useRef(new Animated.Value(0.975)).current;

  usePreventScreenCapture();

  const requestAuthentication = useCallback(async () => {
    if (isAuthInProgress.current) {
      return;
    }

    isAuthInProgress.current = true;
    setIsAuthenticating(true);

    try {
      const isIOS = Platform.OS === "ios";

      const primaryResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "PassGen Generator kilidi",
        fallbackLabel: "",
        cancelLabel: "Vazgeç",
        disableDeviceFallback: isIOS,
        biometricsSecurityLevel: "weak",
      });

      const shouldTryPasscodeFallback =
        isIOS &&
        !primaryResult.success &&
        primaryResult.error !== "user_cancel" &&
        primaryResult.error !== "system_cancel" &&
        primaryResult.error !== "app_cancel";

      const result = shouldTryPasscodeFallback
        ? await LocalAuthentication.authenticateAsync({
            promptMessage: "Cihaz şifresi ile devam et",
            fallbackLabel: "Şifre kullan",
            cancelLabel: "Vazgeç",
            disableDeviceFallback: false,
            biometricsSecurityLevel: "weak",
          })
        : primaryResult;

      if (result.success) {
        setAuthError("");
        setIsLocked(false);
      } else {
        setIsLocked(true);

        if (
          result.error === "user_cancel" ||
          result.error === "system_cancel"
        ) {
          setAuthError("Devam etmek için doğrulama gerekli.");
        } else {
          setAuthError("Kimlik doğrulama başarısız. Tekrar deneyin.");
        }
      }
    } catch {
      setIsLocked(true);
      setAuthError("Doğrulama sırasında bir hata oluştu.");
    } finally {
      setIsAuthenticating(false);
      isAuthInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isLocked) {
      Animated.parallel([
        Animated.timing(appOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(appScale, {
          toValue: 1,
          friction: 8,
          tension: 95,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    appOpacity.setValue(0.72);
    appScale.setValue(0.975);
  }, [appOpacity, appScale, isLocked]);

  useEffect(() => {
    void requestAuthentication();
  }, [requestAuthentication]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (isAuthInProgress.current) {
        return;
      }

      if (nextState !== "active") {
        if (nextState === "background") {
          shouldAuthOnActiveRef.current = true;
          if (!isLocked) {
            setIsLocked(true);
          }
        }
        return;
      }

      if (
        (previousState === "inactive" || previousState === "background") &&
        isLocked &&
        shouldAuthOnActiveRef.current
      ) {
        shouldAuthOnActiveRef.current = false;
        void requestAuthentication();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isLocked, requestAuthentication]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <PasswordStoreProvider>
        <View style={[styles.root, { backgroundColor: appBackgroundColor }]}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: appBackgroundColor,
              opacity: appOpacity,
              transform: [{ scale: appScale }],
            }}
          >
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
            </Stack>
          </Animated.View>

          {isLocked && (
            <View
              style={[
                styles.lockOverlay,
                { backgroundColor: lockBackgroundColor },
              ]}
            >
              <Text style={[styles.lockTitle, { color: lockTextColor }]}>
                Uygulama Kilitli
              </Text>
              <Text
                style={[styles.lockDescription, { color: lockSubTextColor }]}
              >
                Parmak izi, Face ID veya cihaz şifresiyle devam edin.
              </Text>
              {authError ? (
                <Text
                  style={[
                    styles.lockError,
                    { color: isDark ? "#ff8c99" : "#c05060" },
                  ]}
                >
                  {authError}
                </Text>
              ) : null}
              <Pressable
                style={[
                  styles.unlockButton,
                  {
                    backgroundColor: lockButtonBackgroundColor,
                    borderColor: lockButtonBorderColor,
                  },
                  isAuthenticating && styles.unlockButtonDisabled,
                ]}
                onPress={() => {
                  void requestAuthentication();
                }}
                disabled={isAuthenticating}
              >
                <Text style={styles.unlockButtonText}>
                  {isAuthenticating ? "Doğrulanıyor..." : "Kilidi Aç"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </PasswordStoreProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020914",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 10,
  },
  lockTitle: {
    color: "#e6f7ff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  lockDescription: {
    marginTop: 10,
    color: "#8bc4e8",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 21,
  },
  lockError: {
    marginTop: 10,
    color: "#ff8c99",
    textAlign: "center",
    fontSize: 14,
  },
  unlockButton: {
    marginTop: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(88, 228, 255, 0.7)",
    backgroundColor: "rgba(30, 132, 167, 0.45)",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  unlockButtonDisabled: {
    opacity: 0.6,
  },
  unlockButtonText: {
    color: "#ddf8ff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
