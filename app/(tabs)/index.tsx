import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getI18n } from "@/constants/i18n";
import { usePasswordStore } from "@/contexts/password-store";

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 64;
const NO_RULES_SENTINEL = "__NO_RULES__";
const DEFAULT_PASSWORD_LENGTH = 16;

type PasswordOptions = {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

type StrengthLevel = {
  level: "weak" | "fair" | "good" | "strong";
  score: number;
  color: string;
  bars: number;
};

const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};

const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?/",
};

function randomChar(source: string) {
  return source.charAt(Math.floor(Math.random() * source.length));
}

function shuffle(text: string) {
  const chars = text.split("");
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function buildPassword(length: number, options: PasswordOptions) {
  const enabledKeys = (
    Object.keys(options) as (keyof PasswordOptions)[]
  ).filter((key) => options[key]);

  if (enabledKeys.length === 0) {
    return NO_RULES_SENTINEL;
  }

  let pool = "";
  for (const key of enabledKeys) {
    pool += CHARSETS[key];
  }

  let password = "";
  for (const key of enabledKeys) {
    password += randomChar(CHARSETS[key]);
  }

  while (password.length < length) {
    password += randomChar(pool);
  }

  return shuffle(password);
}

function calculateStrength(password: string): StrengthLevel {
  if (password === NO_RULES_SENTINEL) {
    return { level: "weak", score: 0, color: "#ff4f65", bars: 1 };
  }

  let score = 0;
  if (password.length >= 6) score += 15;
  if (password.length >= 8) score += 15;
  if (password.length >= 12) score += 20;
  if (password.length >= 16) score += 20;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;

  const normalized = Math.min(score, 100);

  if (normalized >= 90) {
    return { level: "strong", score: normalized, color: "#2af5b3", bars: 4 };
  }
  if (normalized >= 60) {
    return { level: "good", score: normalized, color: "#52f8ff", bars: 3 };
  }
  if (normalized >= 30) {
    return { level: "fair", score: normalized, color: "#ffc96b", bars: 2 };
  }
  return { level: "weak", score: normalized, color: "#ff8a7a", bars: 1 };
}

async function warmupSound(sound: Audio.Sound) {
  try {
    await sound.setStatusAsync({ volume: 0 });
    await sound.playFromPositionAsync(0);
    await sound.pauseAsync();
    await sound.setPositionAsync(0);
    await sound.setStatusAsync({ volume: 1 });
  } catch {
    // ignore
  }
}

export default function HomeScreen() {
  const { strings } = getI18n();
  const insets = useSafeAreaInsets();
  const buttonScale = useRef(new Animated.Value(1)).current;
  const outputScale = useRef(new Animated.Value(1)).current;
  const buttonGlow = useRef(new Animated.Value(0)).current;
  const copyToastOpacity = useRef(new Animated.Value(0)).current;
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardClearTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sounds = useRef<{
    success: Audio.Sound | null;
    strong: Audio.Sound | null;
    save: Audio.Sound | null;
    error: Audio.Sound | null;
    copy: Audio.Sound | null;
  }>({
    success: null,
    strong: null,
    save: null,
    error: null,
    copy: null,
  });

  const { addGeneratedPassword, savePassword } = usePasswordStore();

  const initialGeneratedPassword = useMemo(
    () => buildPassword(DEFAULT_PASSWORD_LENGTH, DEFAULT_PASSWORD_OPTIONS),
    [],
  );
  const [passwordLength, setPasswordLength] = useState(DEFAULT_PASSWORD_LENGTH);
  const [password, setPassword] = useState(initialGeneratedPassword);
  const [animatedPassword, setAnimatedPassword] = useState(
    initialGeneratedPassword,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(true);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isCopyingPassword, setIsCopyingPassword] = useState(false);
  const [copyText, setCopyText] = useState(strings.common.copy);
  const [saveText, setSaveText] = useState(strings.common.save);
  const lastSliderHapticLength = useRef(passwordLength);
  const generateLockRef = useRef(false);
  const saveLockRef = useRef(false);
  const copyLockRef = useRef(false);
  const [options, setOptions] = useState<PasswordOptions>({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  const visiblePassword =
    animatedPassword === NO_RULES_SENTINEL
      ? strings.home.noRulesError
      : animatedPassword;

  const strength = useMemo(() => calculateStrength(password), [password]);

  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonGlow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(buttonGlow, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );

    glowLoop.start();
    return () => glowLoop.stop();
  }, [buttonGlow]);

  useEffect(() => {
    return () => {
      if (saveResetTimer.current) {
        clearTimeout(saveResetTimer.current);
      }
      if (clipboardClearTimer.current) {
        clearTimeout(clipboardClearTimer.current);
      }
      void Promise.all(
        Object.values(sounds.current)
          .filter((sound): sound is Audio.Sound => sound !== null)
          .map((sound) => sound.unloadAsync()),
      );
      sounds.current = {
        success: null,
        strong: null,
        save: null,
        error: null,
        copy: null,
      };
    };
  }, [sounds]);

  useEffect(() => {
    let isMounted = true;

    const loadSounds = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
        });

        const [
          { sound: success },
          { sound: strong },
          { sound: save },
          { sound: error },
          { sound: copy },
        ] = await Promise.all([
          Audio.Sound.createAsync(require("../../assets/sounds/success.mp3"), {
            shouldPlay: false,
            volume: 1,
          }),
          Audio.Sound.createAsync(require("../../assets/sounds/strong.mp3"), {
            shouldPlay: false,
            volume: 1,
          }),
          Audio.Sound.createAsync(require("../../assets/sounds/save.mp3"), {
            shouldPlay: false,
            volume: 1,
          }),
          Audio.Sound.createAsync(require("../../assets/sounds/error.mp3"), {
            shouldPlay: false,
            volume: 1,
          }),
          Audio.Sound.createAsync(require("../../assets/sounds/copy.mp3"), {
            shouldPlay: false,
            volume: 1,
          }),
        ]);

        if (!isMounted) {
          await Promise.all([
            success.unloadAsync(),
            strong.unloadAsync(),
            save.unloadAsync(),
            error.unloadAsync(),
            copy.unloadAsync(),
          ]);
          return;
        }

        sounds.current = {
          success,
          strong,
          save,
          error,
          copy,
        };

        void Promise.all([
          warmupSound(success),
          warmupSound(strong),
          warmupSound(save),
          warmupSound(error),
          warmupSound(copy),
        ]);
      } catch {
        sounds.current = {
          success: null,
          strong: null,
          save: null,
          error: null,
          copy: null,
        };
      }
    };

    void loadSounds();

    return () => {
      isMounted = false;
    };
  }, []);

  const playSound = async (type: keyof typeof sounds.current) => {
    const sound = sounds.current[type];

    if (!sound) {
      return;
    }

    try {
      await sound.replayAsync();
    } catch {
      // ignore
    }
  };

  const toggleOption = async (key: keyof PasswordOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    await Haptics.selectionAsync();
  };

  const changeLength = async (delta: number) => {
    setPasswordLength((prev) => {
      const nextValue = Math.max(
        MIN_PASSWORD_LENGTH,
        Math.min(MAX_PASSWORD_LENGTH, prev + delta),
      );
      return nextValue;
    });
    await Haptics.selectionAsync();
  };

  const onGenerate = async () => {
    if (generateLockRef.current) {
      return;
    }

    generateLockRef.current = true;
    setIsGenerating(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const generated = buildPassword(passwordLength, options);
      const generatedStrength = calculateStrength(generated);

      if (generated === NO_RULES_SENTINEL) {
        void playSound("error");
      } else if (generatedStrength.level === "strong") {
        void playSound("strong");
      } else {
        void playSound("success");
      }

      setPassword(generated);
      setAnimatedPassword(generated);

      buttonScale.setValue(1);
      outputScale.setValue(1);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(buttonScale, {
            toValue: 0.97,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(buttonScale, {
            toValue: 1,
            duration: 110,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(outputScale, {
            toValue: 0.985,
            duration: 70,
            useNativeDriver: true,
          }),
          Animated.timing(outputScale, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      if (generated === NO_RULES_SENTINEL) {
        setHasGenerated(false);
        return;
      }

      setHasGenerated(true);
      addGeneratedPassword(generated);
      setSaveText(strings.common.save);
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  const onSavePassword = async () => {
    if (
      saveLockRef.current ||
      !hasGenerated ||
      !password ||
      password === NO_RULES_SENTINEL
    ) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    saveLockRef.current = true;
    setIsSavingPassword(true);
    savePassword(password);
    setSaveText(strings.common.saved);
    void playSound("save");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (saveResetTimer.current) {
      clearTimeout(saveResetTimer.current);
    }

    saveResetTimer.current = setTimeout(() => {
      setSaveText(strings.common.save);
      setIsSavingPassword(false);
      saveLockRef.current = false;
    }, 1200);
  };

  const onCopyPassword = async () => {
    if (
      copyLockRef.current ||
      !hasGenerated ||
      !password ||
      password === NO_RULES_SENTINEL
    ) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    copyLockRef.current = true;
    setIsCopyingPassword(true);
    void playSound("copy");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(password);

    setCopyText(strings.common.copied);
    if (clipboardClearTimer.current) {
      clearTimeout(clipboardClearTimer.current);
    }
    clipboardClearTimer.current = setTimeout(() => {
      void Clipboard.setStringAsync("");
      clipboardClearTimer.current = null;
    }, 60000);
    Animated.sequence([
      Animated.timing(copyToastOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.delay(700),
      Animated.timing(copyToastOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCopyText(strings.common.copy);
      setIsCopyingPassword(false);
      copyLockRef.current = false;
    });
  };

  const shouldWrapPassword = hasGenerated && visiblePassword.length >= 28;

  const glowColor = buttonGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(54, 232, 196, 0.25)", "rgba(54, 232, 196, 0.6)"],
  });
  const androidGlowOpacity = buttonGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.62],
  });
  const androidGlowScale = buttonGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(124, 100 + insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ bottom: Math.max(110, 88 + insets.bottom) }}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.header}>{strings.home.title}</Text>
          <Text style={styles.subHeader}>{strings.home.subtitle}</Text>
        </View>

        <Animated.View
          style={[styles.outputCard, { transform: [{ scale: outputScale }] }]}
        >
          <Text style={styles.outputLabel}>{strings.home.outputLabel}</Text>

          <Animated.Text
            style={[
              styles.passwordText,
              shouldWrapPassword && styles.passwordTextMultiline,
            ]}
            numberOfLines={shouldWrapPassword ? 4 : 1}
            adjustsFontSizeToFit={!shouldWrapPassword}
            minimumFontScale={0.68}
          >
            {visiblePassword || "..."}
          </Animated.Text>

          <View style={styles.strengthWrap}>
            <View style={styles.strengthSegments}>
              {Array.from({ length: 4 }).map((_, index) => {
                const filled = index < strength.bars;
                return (
                  <View
                    key={`segment-${index}`}
                    style={[
                      styles.strengthSegment,
                      filled && [
                        styles.strengthSegmentFilled,
                        { backgroundColor: strength.color },
                      ],
                    ]}
                  />
                );
              })}
            </View>
            <Text style={[styles.strengthText, { color: strength.color }]}>
              {strength.level === "weak"
                ? strings.home.strengthWeak
                : strength.level === "fair"
                  ? strings.home.strengthFair
                  : strength.level === "good"
                    ? strings.home.strengthGood
                    : strings.home.strengthStrong}
            </Text>
          </View>

          <View style={styles.outputActionRow}>
            <Pressable
              style={styles.outputActionButton}
              disabled={isCopyingPassword || !hasGenerated}
              onPress={() => {
                void onCopyPassword();
              }}
            >
              <MaterialCommunityIcons
                name="content-copy"
                size={18}
                color="#14dff0"
              />
              <Text style={[styles.outputActionText, styles.copyAccent]}>
                {copyText.toUpperCase()}
              </Text>
            </Pressable>

            <View style={styles.outputDivider} />

            <Pressable
              style={styles.outputActionButton}
              disabled={isSavingPassword || !hasGenerated}
              onPress={() => {
                void onSavePassword();
              }}
            >
              <MaterialCommunityIcons
                name="bookmark-outline"
                size={18}
                color="#23ef77"
              />
              <Text style={[styles.outputActionText, styles.saveAccent]}>
                {saveText.toUpperCase()}
              </Text>
            </Pressable>
          </View>
          <Animated.View
            style={[styles.copyToast, { opacity: copyToastOpacity }]}
          >
            <Text style={styles.copyToastText}>{strings.home.copiedToast}</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.generateOuter,
            {
              shadowColor: "#1eff55",
              shadowOpacity: 0.8,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 0 },
              backgroundColor: glowColor,
              transform: [{ scale: buttonScale }],
            },
          ]}
        >
          {Platform.OS === "android" && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.androidGlow,
                  {
                    opacity: androidGlowOpacity,
                    backgroundColor: glowColor,
                    transform: [{ scale: androidGlowScale }],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.androidGlowInner,
                  {
                    opacity: androidGlowOpacity,
                    backgroundColor: glowColor,
                  },
                ]}
              />
            </>
          )}
          <Pressable
            style={styles.generateButton}
            onPress={() => {
              void onGenerate();
            }}
            disabled={isGenerating}
          >
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={26}
              color="#1bff61"
            />
            <Text style={styles.generateButtonText}>
              {strings.home.generate.toUpperCase()}
            </Text>
          </Pressable>
        </Animated.View>

        <View style={styles.optionsCard}>
          <View style={styles.rulesHeaderRow}>
            <Text style={styles.sectionTitle}>
              {strings.home.passwordRules}
            </Text>
            <View style={styles.lengthBadge}>
              <Text
                style={styles.lengthBadgeText}
              >{`LEN ${passwordLength}`}</Text>
            </View>
          </View>

          <View style={styles.lengthRow}>
            <View style={styles.lengthSliderRow}>
              <View style={styles.sliderOuterGlow}>
                <View style={styles.lengthSliderWrap}>
                  <Slider
                    style={styles.lengthSliderTrack}
                    minimumValue={MIN_PASSWORD_LENGTH}
                    maximumValue={MAX_PASSWORD_LENGTH}
                    step={1}
                    value={passwordLength}
                    minimumTrackTintColor="rgba(82, 248, 255, 0.95)"
                    maximumTrackTintColor="rgba(197, 224, 255, 0.16)"
                    thumbTintColor="#d6ffff"
                    onValueChange={(value) => {
                      const next = Math.round(value);
                      setPasswordLength(next);

                      if (
                        Math.abs(next - lastSliderHapticLength.current) >= 3
                      ) {
                        lastSliderHapticLength.current = next;
                        void Haptics.selectionAsync();
                      }
                    }}
                    onSlidingStart={() => {
                      lastSliderHapticLength.current = passwordLength;
                    }}
                    onSlidingComplete={() => {
                      void Haptics.selectionAsync();
                    }}
                  />
                </View>
              </View>

              <View style={styles.lengthButtonsInline}>
                <Pressable
                  style={styles.lengthButton}
                  onPress={() => {
                    void changeLength(-1);
                  }}
                >
                  <Text style={styles.lengthButtonText}>-</Text>
                </Pressable>
                <Pressable
                  style={styles.lengthButton}
                  disabled={isGenerating}
                  onPress={() => {
                    void changeLength(1);
                  }}
                >
                  <Text style={styles.lengthButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.rulesGrid}>
            <Pressable
              style={styles.ruleTile}
              onPress={() => {
                void toggleOption("uppercase");
              }}
            >
              <Text style={styles.ruleTileText}>{strings.home.uppercase}</Text>
              <Switch
                style={styles.ruleSwitch}
                value={options.uppercase}
                onValueChange={() => {
                  void toggleOption("uppercase");
                }}
                trackColor={{ false: "#2d3848", true: "#18e7c6" }}
                thumbColor="#dffbf4"
              />
            </Pressable>

            <Pressable
              style={styles.ruleTile}
              onPress={() => {
                void toggleOption("lowercase");
              }}
            >
              <Text style={styles.ruleTileText}>{strings.home.lowercase}</Text>
              <Switch
                style={styles.ruleSwitch}
                value={options.lowercase}
                onValueChange={() => {
                  void toggleOption("lowercase");
                }}
                trackColor={{ false: "#2d3848", true: "#18e7c6" }}
                thumbColor="#dffbf4"
              />
            </Pressable>

            <Pressable
              style={styles.ruleTile}
              onPress={() => {
                void toggleOption("numbers");
              }}
            >
              <Text style={styles.ruleTileText}>{strings.home.numbers}</Text>
              <Switch
                style={styles.ruleSwitch}
                value={options.numbers}
                onValueChange={() => {
                  void toggleOption("numbers");
                }}
                trackColor={{ false: "#2d3848", true: "#18e7c6" }}
                thumbColor="#dffbf4"
              />
            </Pressable>

            <Pressable
              style={styles.ruleTile}
              onPress={() => {
                void toggleOption("symbols");
              }}
            >
              <Text style={styles.ruleTileText}>{strings.home.symbols}</Text>
              <Switch
                style={styles.ruleSwitch}
                value={options.symbols}
                onValueChange={() => {
                  void toggleOption("symbols");
                }}
                trackColor={{ false: "#2d3848", true: "#18e7c6" }}
                thumbColor="#dffbf4"
              />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#081421",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 32,
    gap: 8,
  },
  bgOrbTop: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(24, 232, 198, 0.18)",
    top: -80,
    right: -50,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(44, 106, 255, 0.2)",
    bottom: -70,
    left: -60,
  },
  header: {
    color: "#f7fbff",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 2,
  },
  subHeader: {
    marginTop: 4,
    color: "#14dff0",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.4,
    textAlign: "center",
  },
  heroBlock: {
    alignItems: "center",
    marginBottom: 12,
  },
  outputCard: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(17, 228, 250, 0.38)",
    backgroundColor: "#171722",
    shadowColor: "#11e4fa",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  outputLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 3.8,
    marginBottom: 12,
  },
  passwordText: {
    color: "#f2fffc",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "left",
    marginTop: 0,
    letterSpacing: 0.2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    textShadowColor: "rgba(255,255,255,0.12)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  passwordTextMultiline: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: "left",
    paddingHorizontal: 6,
  },
  strengthWrap: {
    marginTop: 18,
    gap: 8,
  },
  strengthSegments: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  strengthSegment: {
    flex: 1,
    height: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  strengthSegmentFilled: {
    shadowOpacity: 0,
  },
  strengthText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    textAlign: "right",
  },
  copyToast: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(94, 248, 221, 0.5)",
    backgroundColor: "rgba(24, 232, 198, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  copyToastText: {
    color: "#c7fff5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  outputActionRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 8,
    paddingBottom: 0,
  },
  outputActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 2,
  },
  outputActionText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  copyAccent: {
    color: "#12ddef",
  },
  saveAccent: {
    color: "#18f370",
  },
  newAccent: {
    color: "#ffd53a",
  },
  outputDivider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  generateOuter: {
    marginTop: 2,
    marginBottom: 6,
    borderRadius: 18,
    padding: 2,
    position: "relative",
    overflow: "visible",
  },
  androidGlow: {
    position: "absolute",
    top: -9,
    left: -5,
    right: -5,
    bottom: -9,
    borderRadius: 18,
    backgroundColor: "rgba(56, 255, 217, 0.24)",
    borderWidth: 1,
    borderColor: "rgba(56, 255, 217, 0.5)",
    elevation: 8,
  },
  androidGlowInner: {
    position: "absolute",
    top: -4,
    left: -2,
    right: -2,
    bottom: -4,
    borderRadius: 18,
    backgroundColor: "rgba(56, 255, 217, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(56, 255, 217, 0.38)",
    elevation: 5,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: "#0f1d12",
    borderWidth: 2,
    borderColor: "#1bff61",
  },
  generateButtonText: {
    color: "#1bff61",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2.4,
  },
  optionsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(16, 16, 22, 0.96)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  sectionTitle: {
    color: "#f7fbff",
    fontSize: 14,
    fontWeight: Platform.OS === "ios" ? "700" : "800",
    letterSpacing: Platform.OS === "ios" ? 0 : 2,
    marginBottom: 0,
  },
  rulesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  rulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ruleTile: {
    width: "48.5%",
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 194, 229, 0.5)",
    backgroundColor: "rgba(10, 23, 34, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  ruleTileText: {
    flex: 1,
    color: "#f7fbff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  ruleSwitch: {
    transform:
      Platform.OS === "android"
        ? [{ scaleX: 0.95 }, { scaleY: 0.95 }]
        : [{ scaleX: 0.95 }, { scaleY: 0.95 }],
    marginLeft: Platform.OS === "android" ? 0 : 0,
  },
  ruleSummary: {
    marginTop: 2,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(24, 232, 198, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(24, 232, 198, 0.35)",
  },
  ruleSummaryText: {
    color: "#86ffe8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  lengthRow: {
    marginTop: 0,
    gap: 4,
  },
  lengthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lengthBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(17, 228, 250, 0.4)",
    backgroundColor: "rgba(17, 228, 250, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lengthBadgeText: {
    color: "#86e8ff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  lengthSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sliderOuterGlow: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: "rgba(17, 228, 250, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(17, 228, 250, 0.26)",
    shadowColor: "#52f8ff",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  lengthSliderTrack: {
    width: "100%",
    height: 24,
    transform: Platform.OS === "android" ? [{ scaleY: 1 }] : undefined,
  },
  lengthSliderWrap: {
    position: "relative",
    justifyContent: "center",
    width: "100%",
    minHeight: 18,
  },
  lengthButtonsInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lengthButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(17, 228, 250, 0.42)",
    backgroundColor: "rgba(17, 228, 250, 0.08)",
  },
  lengthButtonText: {
    color: "#f7fbff",
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "700",
  },
});
