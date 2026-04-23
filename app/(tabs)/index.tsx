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

type PasswordOptions = {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

type StrengthLevel = {
  level: "veryWeak" | "weak" | "medium" | "strong" | "veryStrong";
  score: number;
  color: string;
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
    return { level: "veryWeak", score: 6, color: "#ff4f65" };
  }

  let score = 0;

  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  if (password.length >= 16) score += 20;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;
  if (password.length >= 20) score += 10;

  const normalized = Math.min(score, 100);

  if (normalized >= 90 && password.length >= 16) {
    return { level: "veryStrong", score: normalized, color: "#52f8ff" };
  }

  if (normalized >= 75) {
    return { level: "strong", score: normalized, color: "#2af5b3" };
  }
  if (normalized >= 45) {
    return { level: "medium", score: normalized, color: "#ffc96b" };
  }
  if (normalized >= 25) {
    return { level: "weak", score: normalized, color: "#ff8a7a" };
  }

  return { level: "veryWeak", score: normalized, color: "#ff4f65" };
}

async function warmupSound(sound: Audio.Sound) {
  try {
    await sound.setStatusAsync({ volume: 0 });
    await sound.playFromPositionAsync(0);
    await sound.pauseAsync();
    await sound.setPositionAsync(0);
    await sound.setStatusAsync({ volume: 1 });
  } catch {
    // Warmup baÅŸarÄ±sÄ±z olsa da normal kullanÄ±m devam eder.
  }
}

export default function HomeScreen() {
  const { strings } = getI18n();
  const insets = useSafeAreaInsets();
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonGlow = useRef(new Animated.Value(0)).current;
  const passwordPulse = useRef(new Animated.Value(1)).current;
  const copyToastOpacity = useRef(new Animated.Value(0)).current;
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const [passwordLength, setPasswordLength] = useState(12);
  const [password, setPassword] = useState(strings.home.initialPassword);
  const [animatedPassword, setAnimatedPassword] = useState(
    strings.home.initialPassword,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
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

  const enabledCount = useMemo(
    () => Object.values(options).filter(Boolean).length,
    [options],
  );
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
      if (typingTimer.current) {
        clearInterval(typingTimer.current);
      }
      if (saveResetTimer.current) {
        clearTimeout(saveResetTimer.current);
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
      // Sessizce devam et: ses Ã§almazsa Ã¼retim akÄ±ÅŸÄ±nÄ± bozmayalÄ±m.
    }
  };

  const revealPassword = (nextPassword: string) => {
    if (typingTimer.current) {
      clearInterval(typingTimer.current);
    }

    setAnimatedPassword("");
    setIsGenerating(true);

    let index = 0;
    typingTimer.current = setInterval(() => {
      index += 1;
      setAnimatedPassword(nextPassword.slice(0, index));

      if (index >= nextPassword.length) {
        if (typingTimer.current) {
          clearInterval(typingTimer.current);
          typingTimer.current = null;
        }
        setIsGenerating(false);
        generateLockRef.current = false;
      }
    }, 28);
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const generated = buildPassword(passwordLength, options);
    const generatedStrength = calculateStrength(generated);

    if (generated === NO_RULES_SENTINEL) {
      void playSound("error");
    } else if (
      generatedStrength.level === "strong" ||
      generatedStrength.level === "veryStrong"
    ) {
      void playSound("strong");
    } else {
      void playSound("success");
    }

    Animated.parallel([
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 0.94,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          friction: 4,
          tension: 180,
          useNativeDriver: false,
        }),
      ]),
      Animated.sequence([
        Animated.timing(passwordPulse, {
          toValue: 0.95,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(passwordPulse, {
          toValue: 1,
          friction: 5,
          tension: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    setPassword(generated);
    revealPassword(generated);

    if (generated === NO_RULES_SENTINEL) {
      setHasGenerated(false);
      return;
    }

    setHasGenerated(true);
    addGeneratedPassword(generated);
    setSaveText(strings.common.save);
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

  const strengthLabel =
    strength.level === "veryStrong"
      ? strings.home.strengthVeryStrong
      : strength.level === "veryWeak"
        ? strings.home.strengthVeryWeak
        : strength.level === "strong"
          ? strings.home.strengthStrong
          : strength.level === "medium"
            ? strings.home.strengthMedium
            : strings.home.strengthWeak;
  const strengthText = hasGenerated
    ? `${strings.home.strength}: ${strengthLabel}`
    : `${strings.home.strength}: `;
  const visibleStrengthScore = hasGenerated ? strength.score : 0;
  const visiblePassword =
    animatedPassword === NO_RULES_SENTINEL
      ? strings.home.noRulesError
      : animatedPassword;
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
        <Text style={styles.header}>{strings.home.title}</Text>

        <Animated.View
          style={[
            styles.passwordCard,
            { transform: [{ scale: passwordPulse }] },
          ]}
        >
          <View style={styles.passwordHeaderRow}>
            <Text style={styles.passwordLabel}>
              {strings.home.passwordLabel}
            </Text>
            <View style={styles.actionButtonsWrap}>
              <Pressable
                style={styles.copyButton}
                disabled={isCopyingPassword || !hasGenerated}
                onPress={() => {
                  void onCopyPassword();
                }}
              >
                <Text style={styles.copyButtonText}>{copyText}</Text>
              </Pressable>
              <Pressable
                style={styles.saveButton}
                disabled={isSavingPassword || !hasGenerated}
                onPress={() => {
                  void onSavePassword();
                }}
              >
                <Text style={styles.saveButtonText}>{saveText}</Text>
              </Pressable>
            </View>
          </View>
          <Text
            style={[
              styles.passwordText,
              shouldWrapPassword && styles.passwordTextMultiline,
            ]}
            numberOfLines={shouldWrapPassword ? 4 : 1}
            adjustsFontSizeToFit={!shouldWrapPassword}
            minimumFontScale={0.68}
          >
            {visiblePassword || "..."}
          </Text>
          <View style={styles.strengthWrap}>
            <View style={styles.strengthTrack}>
              <View
                style={[
                  styles.strengthFill,
                  {
                    width: `${visibleStrengthScore}%`,
                    backgroundColor: strength.color,
                  },
                ]}
              />
            </View>
            <Text style={[styles.strengthText, { color: strength.color }]}>
              {strengthText}
            </Text>
          </View>
          <Animated.View
            style={[styles.copyToast, { opacity: copyToastOpacity }]}
          >
            <Text style={styles.copyToastText}>{strings.home.copiedToast}</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.buttonOuter,
            {
              shadowColor: "#36e8c4",
              shadowOpacity: 0.9,
              shadowRadius: 18,
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
            <Text style={styles.generateButtonText}>
              {isGenerating ? strings.home.generating : strings.home.generate}
            </Text>
          </Pressable>
        </Animated.View>

        <View style={styles.optionsCard}>
          <Text style={styles.sectionTitle}>{strings.home.passwordRules}</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>{strings.home.uppercase}</Text>
            <Switch
              style={styles.ruleSwitch}
              value={options.uppercase}
              onValueChange={() => {
                void toggleOption("uppercase");
              }}
              trackColor={{ false: "#2d3848", true: "#18e7c6" }}
              thumbColor="#dffbf4"
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>{strings.home.lowercase}</Text>
            <Switch
              style={styles.ruleSwitch}
              value={options.lowercase}
              onValueChange={() => {
                void toggleOption("lowercase");
              }}
              trackColor={{ false: "#2d3848", true: "#18e7c6" }}
              thumbColor="#dffbf4"
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>{strings.home.numbers}</Text>
            <Switch
              style={styles.ruleSwitch}
              value={options.numbers}
              onValueChange={() => {
                void toggleOption("numbers");
              }}
              trackColor={{ false: "#2d3848", true: "#18e7c6" }}
              thumbColor="#dffbf4"
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>{strings.home.symbols}</Text>
            <Switch
              style={styles.ruleSwitch}
              value={options.symbols}
              onValueChange={() => {
                void toggleOption("symbols");
              }}
              trackColor={{ false: "#2d3848", true: "#18e7c6" }}
              thumbColor="#dffbf4"
            />
          </View>

          <View style={styles.ruleSummary}>
            <Text style={styles.ruleSummaryText}>
              {strings.home.activeRules(enabledCount)}
            </Text>
          </View>

          <View style={styles.lengthRow}>
            <View style={styles.lengthHeaderRow}>
              <Text style={styles.optionText}>{strings.home.length}</Text>
              <View style={styles.lengthBadge}>
                <Text
                  style={styles.lengthBadgeText}
                >{`${passwordLength}`}</Text>
              </View>
            </View>

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
    paddingTop: 42,
    paddingBottom: 32,
    gap: 10,
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
    color: "#d5f6ef",
    textAlign: "center",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
  },
  passwordCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(84, 255, 224, 0.45)",
    backgroundColor: "rgba(4, 20, 34, 0.92)",
  },
  passwordLabel: {
    color: "#77d9c9",
    fontSize: 13,
    marginBottom: 0,
    marginRight: 6,
    minWidth: 86,
    flexShrink: 0,
    letterSpacing: 1,
  },
  passwordHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  copyButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(127, 251, 226, 0.65)",
    backgroundColor: "rgba(24, 232, 198, 0.16)",
    paddingHorizontal: Platform.OS === "android" ? 11 : 16,
    paddingVertical: Platform.OS === "android" ? 6 : 8,
  },
  actionButtonsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    alignSelf: "auto",
    flexShrink: 0,
    gap: Platform.OS === "android" ? 8 : 12,
    flexWrap: "nowrap",
    marginTop: 0,
    marginLeft: 6,
  },
  copyButtonText: {
    color: "#d8fff8",
    fontSize: Platform.OS === "android" ? 13 : 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  saveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(103, 204, 255, 0.65)",
    backgroundColor: "rgba(64, 144, 245, 0.2)",
    paddingHorizontal: Platform.OS === "android" ? 11 : 16,
    paddingVertical: Platform.OS === "android" ? 6 : 8,
  },
  saveButtonText: {
    color: "#deefff",
    fontSize: Platform.OS === "android" ? 13 : 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  passwordText: {
    color: "#f2fffc",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  passwordTextMultiline: {
    fontSize: 18,
    lineHeight: 23,
    textAlign: "left",
    paddingHorizontal: 6,
  },
  strengthWrap: {
    marginTop: 16,
    gap: 7,
  },
  strengthTrack: {
    height: 7,
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(226, 238, 255, 0.16)",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 999,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  copyToast: {
    marginTop: 8,
    alignSelf: "center",
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
  buttonOuter: {
    marginTop: 2,
    marginBottom: 6,
    borderRadius: 30,
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
    borderRadius: 34,
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
    borderRadius: 31,
    backgroundColor: "rgba(56, 255, 217, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(56, 255, 217, 0.38)",
    elevation: 5,
  },
  generateButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    paddingVertical: 16,
    backgroundColor: "#0f334f",
    borderWidth: 1,
    borderColor: "#38ffd9",
  },
  generateButtonText: {
    color: "#dffcf5",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  optionsCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(116, 167, 255, 0.4)",
    backgroundColor: "rgba(8, 25, 42, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: Platform.OS === "ios" ? 8 : 4,
  },
  sectionTitle: {
    color: "#c5d9ff",
    fontSize: 17,
    fontWeight: Platform.OS === "ios" ? "700" : "800",
    letterSpacing: Platform.OS === "ios" ? 0 : 0.25,
    marginBottom: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Platform.OS === "ios" ? 6 : 2,
  },
  optionText: {
    color: "#ecf8ff",
    fontSize: 16,
    fontWeight: Platform.OS === "ios" ? "600" : "700",
    letterSpacing: Platform.OS === "ios" ? 0 : 0.2,
  },
  ruleSwitch: {
    transform:
      Platform.OS === "android"
        ? [{ scaleX: 1.14 }, { scaleY: 1.14 }]
        : [{ scaleX: 1 }, { scaleY: 1 }],
    marginLeft: Platform.OS === "android" ? 0 : 0,
  },
  ruleSummary: {
    marginTop: 3,
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(24, 232, 198, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(24, 232, 198, 0.4)",
  },
  ruleSummaryText: {
    color: "#86ffe8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  lengthRow: {
    marginTop: 6,
    gap: 9,
  },
  lengthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lengthBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(83, 255, 227, 0.5)",
    backgroundColor: "rgba(26, 239, 204, 0.16)",
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  lengthBadgeText: {
    color: "#8efde8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.35,
  },
  lengthSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sliderOuterGlow: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: "rgba(63, 255, 228, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(63, 255, 228, 0.3)",
    shadowColor: "#52f8ff",
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  lengthSliderTrack: {
    width: "100%",
    height: 24,
    transform: Platform.OS === "android" ? [{ scaleY: 1.1 }] : undefined,
  },
  lengthSliderWrap: {
    position: "relative",
    justifyContent: "center",
    width: "100%",
    minHeight: 28,
  },
  lengthButtonsInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lengthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(127, 251, 226, 0.65)",
    backgroundColor: "rgba(24, 232, 198, 0.16)",
  },
  lengthButtonText: {
    color: "#d8fff8",
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "700",
  },
});
