import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { usePasswordStore } from "@/contexts/password-store";

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 32;

type PasswordOptions = {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

type StrengthLevel = {
  label: "Zayıf" | "Orta" | "Güçlü";
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
    return "En az bir kategori seç";
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
  if (password === "En az bir kategori seç") {
    return { label: "Zayıf", score: 10, color: "#ff697a" };
  }

  let score = 0;

  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  if (password.length >= 16) score += 20;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;

  const normalized = Math.min(score, 100);

  if (normalized >= 75) {
    return { label: "Güçlü", score: normalized, color: "#2af5b3" };
  }
  if (normalized >= 45) {
    return { label: "Orta", score: normalized, color: "#ffc96b" };
  }
  return { label: "Zayıf", score: normalized, color: "#ff697a" };
}

export default function HomeScreen() {
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonGlow = useRef(new Animated.Value(0)).current;
  const passwordPulse = useRef(new Animated.Value(1)).current;
  const copyToastOpacity = useRef(new Animated.Value(0)).current;
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { addGeneratedPassword, savePassword } = usePasswordStore();

  const [passwordLength, setPasswordLength] = useState(12);
  const [password, setPassword] = useState("PulseGenerate_2026!");
  const [animatedPassword, setAnimatedPassword] = useState(
    "PulseGenerate_2026!",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyText, setCopyText] = useState("Copy");
  const [saveText, setSaveText] = useState("Kaydet");
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
    };
  }, []);

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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

    const generated = buildPassword(passwordLength, options);
    setPassword(generated);
    revealPassword(generated);

    if (generated !== "En az bir kategori seç") {
      setHasGenerated(true);
      addGeneratedPassword(generated);
      setSaveText("Kaydet");
    }
  };

  const onSavePassword = async () => {
    if (!hasGenerated || !password || password === "En az bir kategori seç") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    savePassword(password);
    setSaveText("Kaydedildi");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (saveResetTimer.current) {
      clearTimeout(saveResetTimer.current);
    }

    saveResetTimer.current = setTimeout(() => {
      setSaveText("Kaydet");
    }, 1200);
  };

  const onCopyPassword = async () => {
    if (!password || password === "En az bir kategori seç") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    await Clipboard.setStringAsync(password);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setCopyText("Copied!");
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
      setCopyText("Copy");
    });
  };

  const glowColor = buttonGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(54, 232, 196, 0.25)", "rgba(54, 232, 196, 0.6)"],
  });

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Quantum Key Forge</Text>

        <Animated.View
          style={[
            styles.passwordCard,
            { transform: [{ scale: passwordPulse }] },
          ]}
        >
          <View style={styles.passwordHeaderRow}>
            <Text style={styles.passwordLabel}>Your Password</Text>
            <View style={styles.actionButtonsWrap}>
              <Pressable
                style={styles.copyButton}
                onPress={() => {
                  void onCopyPassword();
                }}
              >
                <Text style={styles.copyButtonText}>{copyText}</Text>
              </Pressable>
              <Pressable
                style={styles.saveButton}
                onPress={() => {
                  void onSavePassword();
                }}
              >
                <Text style={styles.saveButtonText}>{saveText}</Text>
              </Pressable>
            </View>
          </View>
          <Text
            style={styles.passwordText}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {animatedPassword || "..."}
          </Text>
          <View style={styles.strengthWrap}>
            <View style={styles.strengthTrack}>
              <View
                style={[
                  styles.strengthFill,
                  {
                    width: `${strength.score}%`,
                    backgroundColor: strength.color,
                  },
                ]}
              />
            </View>
            <Text style={[styles.strengthText, { color: strength.color }]}>
              Güç: {strength.label}
            </Text>
          </View>
          <Animated.View
            style={[styles.copyToast, { opacity: copyToastOpacity }]}
          >
            <Text style={styles.copyToastText}>Panoya kopyalandı</Text>
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
          <Pressable
            style={styles.generateButton}
            onPress={() => {
              void onGenerate();
            }}
            disabled={isGenerating}
          >
            <Text style={styles.generateButtonText}>
              {isGenerating ? "Generating..." : "Generate Password"}
            </Text>
          </Pressable>
        </Animated.View>

        <View style={styles.optionsCard}>
          <Text style={styles.sectionTitle}>Password Rules</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>Büyük Harf</Text>
            <Switch
              value={options.uppercase}
              onValueChange={() => {
                void toggleOption("uppercase");
              }}
              trackColor={{ false: "#2d3848", true: "#18e7c6" }}
              thumbColor="#dffbf4"
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>Küçük Harf</Text>
            <Switch
              value={options.lowercase}
              onValueChange={() => {
                void toggleOption("lowercase");
              }}
              trackColor={{ false: "#2d3848", true: "#18e7c6" }}
              thumbColor="#dffbf4"
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>Sayı</Text>
            <Switch
              value={options.numbers}
              onValueChange={() => {
                void toggleOption("numbers");
              }}
              trackColor={{ false: "#2d3848", true: "#18e7c6" }}
              thumbColor="#dffbf4"
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionText}>Sembol</Text>
            <Switch
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
              {enabledCount} kategori aktif
            </Text>
          </View>

          <View style={styles.lengthRow}>
            <Text style={styles.optionText}>Karakter Uzunluğu</Text>
            <View style={styles.lengthControl}>
              <Pressable
                style={styles.lengthButton}
                onPress={() => {
                  void changeLength(-1);
                }}
              >
                <Text style={styles.lengthButtonText}>-</Text>
              </Pressable>
              <Text style={styles.lengthValue}>{passwordLength}</Text>
              <Pressable
                style={styles.lengthButton}
                onPress={() => {
                  void changeLength(1);
                }}
              >
                <Text style={styles.lengthButtonText}>+</Text>
              </Pressable>
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
    paddingTop: 14,
    paddingBottom: 18,
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
    marginBottom: 4,
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
    fontSize: 14,
    marginBottom: 8,
    letterSpacing: 1,
  },
  passwordHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  copyButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(127, 251, 226, 0.65)",
    backgroundColor: "rgba(24, 232, 198, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  actionButtonsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  copyButtonText: {
    color: "#d8fff8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  saveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(103, 204, 255, 0.65)",
    backgroundColor: "rgba(64, 144, 245, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  saveButtonText: {
    color: "#deefff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  passwordText: {
    color: "#f2fffc",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  strengthWrap: {
    marginTop: 12,
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
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    color: "#c5d9ff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  optionText: {
    color: "#ecf8ff",
    fontSize: 16,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lengthControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lengthButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(127, 251, 226, 0.65)",
    backgroundColor: "rgba(24, 232, 198, 0.16)",
  },
  lengthButtonText: {
    color: "#d8fff8",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
  },
  lengthValue: {
    minWidth: 28,
    textAlign: "center",
    color: "#ecf8ff",
    fontSize: 18,
    fontWeight: "700",
  },
});
