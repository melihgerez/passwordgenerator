import { Audio } from "expo-av";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DeleteConfirmBubble } from "@/components/ui/delete-confirm-bubble";
import { getI18n } from "@/constants/i18n";
import { usePasswordStore } from "@/contexts/password-store";

const HIDDEN_PASSWORD = "••••••••••••";
const RECENT_LIMIT = 15;

function getStrengthColor(password: string) {
  let score = 0;
  if (password.length >= 6) score += 15;
  if (password.length >= 8) score += 15;
  if (password.length >= 12) score += 20;
  if (password.length >= 16) score += 20;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;

  if (score >= 90) {
    return "#2af5b3";
  }

  if (score >= 60) {
    return "#52f8ff";
  }

  if (score >= 30) {
    return "#ffc96b";
  }

  return "#ff8a7a";
}

async function warmupSound(sound: Audio.Sound) {
  try {
    await sound.setStatusAsync({ volume: 0 });
    await sound.playFromPositionAsync(0);
    await sound.pauseAsync();
    await sound.setPositionAsync(0);
    await sound.setStatusAsync({ volume: 1 });
  } catch {
    // Warmup başarısız olsa da normal kullanım devam eder.
  }
}

export default function RecentPasswordsScreen() {
  const { strings, dateLocale } = getI18n();
  const insets = useSafeAreaInsets();
  const {
    recentPasswords,
    removeRecentPassword,
    clearRecentPasswords,
    savePassword,
  } = usePasswordStore();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isClearAllPromptOpen, setIsClearAllPromptOpen] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [savedToastById, setSavedToastById] = useState<Record<string, boolean>>(
    {},
  );
  const [copiedToastById, setCopiedToastById] = useState<
    Record<string, boolean>
  >({});
  const savedToastTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const copiedToastTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const clipboardClearTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sounds = useRef<{
    save: Audio.Sound | null;
    delete: Audio.Sound | null;
    copy: Audio.Sound | null;
  }>({
    save: null,
    delete: null,
    copy: null,
  });

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(dateLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [dateLocale],
  );

  useEffect(() => {
    let isMounted = true;

    const loadSounds = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
        });

        const [{ sound: save }, { sound: del }, { sound: copy }] =
          await Promise.all([
            Audio.Sound.createAsync(require("../../assets/sounds/save.mp3"), {
              shouldPlay: false,
              volume: 1,
            }),
            Audio.Sound.createAsync(require("../../assets/sounds/delete.mp3"), {
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
            save.unloadAsync(),
            del.unloadAsync(),
            copy.unloadAsync(),
          ]);
          return;
        }

        sounds.current = {
          save,
          delete: del,
          copy,
        };

        void Promise.all([
          warmupSound(save),
          warmupSound(del),
          warmupSound(copy),
        ]);
      } catch {
        sounds.current = {
          save: null,
          delete: null,
          copy: null,
        };
      }
    };

    void loadSounds();

    return () => {
      isMounted = false;
      Object.values(savedToastTimers.current).forEach((timer) => {
        clearTimeout(timer);
      });
      savedToastTimers.current = {};
      Object.values(copiedToastTimers.current).forEach((timer) => {
        clearTimeout(timer);
      });
      copiedToastTimers.current = {};
      if (clipboardClearTimer.current) {
        clearTimeout(clipboardClearTimer.current);
      }

      void Promise.all(
        Object.values(sounds.current)
          .filter((sound): sound is Audio.Sound => sound !== null)
          .map((sound) => sound.unloadAsync()),
      );
      sounds.current = {
        save: null,
        delete: null,
        copy: null,
      };
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
      // Ses çalmazsa akışı bozmayalım.
    }
  };

  const onSaveRecent = async (id: string, password: string) => {
    void playSound("save");
    savePassword(password);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (savedToastTimers.current[id]) {
      clearTimeout(savedToastTimers.current[id]);
    }

    setSavedToastById((prev) => ({
      ...prev,
      [id]: true,
    }));

    savedToastTimers.current[id] = setTimeout(() => {
      setSavedToastById((prev) => ({
        ...prev,
        [id]: false,
      }));
      delete savedToastTimers.current[id];
    }, 850);
  };

  const onDeleteRecentConfirmed = async (id: string) => {
    void playSound("delete");
    removeRecentPassword(id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingDeleteId(null);
  };

  const onCopyRecent = async (id: string, password: string) => {
    void playSound("copy");
    await Clipboard.setStringAsync(password);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (clipboardClearTimer.current) {
      clearTimeout(clipboardClearTimer.current);
    }
    clipboardClearTimer.current = setTimeout(() => {
      void Clipboard.setStringAsync("");
      clipboardClearTimer.current = null;
    }, 60000);

    if (copiedToastTimers.current[id]) {
      clearTimeout(copiedToastTimers.current[id]);
    }

    setCopiedToastById((prev) => ({
      ...prev,
      [id]: true,
    }));

    copiedToastTimers.current[id] = setTimeout(() => {
      setCopiedToastById((prev) => ({
        ...prev,
        [id]: false,
      }));
      delete copiedToastTimers.current[id];
    }, 850);
  };

  const onClearAllRecentConfirmed = async () => {
    void playSound("delete");
    clearRecentPasswords();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsClearAllPromptOpen(false);
  };

  const formatDate = (isoDate: string) =>
    dateFormatter.format(new Date(isoDate));

  const toggleVisible = (id: string) => {
    setRevealedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    void Haptics.selectionAsync();
  };

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
        <Text style={styles.header}>{strings.recent.title}</Text>
        <Text style={styles.subHeader}>{strings.recent.subtitle}</Text>

        {recentPasswords.length > 0 && (
          <View style={styles.topActionRow}>
            <Text
              style={styles.countText}
            >{`${recentPasswords.length}/${RECENT_LIMIT}`}</Text>
            <Pressable
              style={styles.deleteAllButton}
              onPress={() => {
                setIsClearAllPromptOpen(true);
              }}
            >
              <Text style={styles.deleteAllButtonText}>
                {strings.recent.clearAll}
              </Text>
            </Pressable>
          </View>
        )}

        {recentPasswords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{strings.recent.emptyTitle}</Text>
            <Text style={styles.emptyText}>{strings.recent.emptyText}</Text>
          </View>
        ) : (
          recentPasswords.map((item, index) => (
            <View key={item.id} style={styles.passwordCard}>
              <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                  <Text
                    style={[
                      styles.orderText,
                      { color: getStrengthColor(item.password) },
                    ]}
                  >
                    #{index + 1}
                  </Text>
                  <Pressable
                    style={styles.inlineShowButton}
                    onPress={() => {
                      toggleVisible(item.id);
                    }}
                  >
                    <Text style={styles.saveButtonText}>
                      {revealedIds[item.id]
                        ? strings.common.hide
                        : strings.common.show}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.timeText}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>
              <Pressable onPress={() => toggleVisible(item.id)}>
                <Text
                  style={[
                    revealedIds[item.id]
                      ? styles.passwordText
                      : styles.passwordHiddenText,
                    revealedIds[item.id]
                      ? { color: getStrengthColor(item.password) }
                      : { color: "#cfeff6" },
                  ]}
                >
                  {revealedIds[item.id] ? item.password : HIDDEN_PASSWORD}
                </Text>
              </Pressable>
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.copyButton}
                  disabled={Boolean(copiedToastById[item.id])}
                  onPress={() => {
                    if (copiedToastById[item.id]) {
                      return;
                    }
                    void onCopyRecent(item.id, item.password);
                  }}
                >
                  <Text style={styles.copyButtonText}>
                    {copiedToastById[item.id]
                      ? strings.common.copied
                      : strings.common.copy}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.saveButton}
                  disabled={Boolean(savedToastById[item.id])}
                  onPress={() => {
                    if (savedToastById[item.id]) {
                      return;
                    }
                    void onSaveRecent(item.id, item.password);
                  }}
                >
                  <Text style={styles.saveButtonText}>
                    {savedToastById[item.id]
                      ? strings.common.saved
                      : strings.common.save}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => {
                    setPendingDeleteId(item.id);
                  }}
                >
                  <Text style={styles.deleteButtonText}>
                    {strings.common.delete}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <DeleteConfirmBubble
        visible={pendingDeleteId !== null}
        message={strings.recent.deleteConfirm}
        cancelLabel={strings.common.cancel}
        confirmLabel={strings.common.delete}
        onCancel={() => {
          setPendingDeleteId(null);
        }}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }
          void onDeleteRecentConfirmed(pendingDeleteId);
        }}
      />

      <DeleteConfirmBubble
        visible={isClearAllPromptOpen}
        message={strings.recent.deleteAllConfirm}
        cancelLabel={strings.common.cancel}
        confirmLabel={strings.common.deleteAll}
        onCancel={() => {
          setIsClearAllPromptOpen(false);
        }}
        onConfirm={() => {
          void onClearAllRecentConfirmed();
        }}
      />
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
    paddingTop: 58,
    paddingBottom: 32,
    gap: 10,
  },
  bgOrbTop: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(31, 198, 255, 0.18)",
    top: -70,
    right: -60,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(24, 232, 198, 0.17)",
    bottom: -60,
    left: -60,
  },
  header: {
    color: "#e1f4ff",
    textAlign: "center",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  subHeader: {
    color: "#9fc2da",
    textAlign: "center",
    fontSize: 15,
    marginBottom: 4,
  },
  topActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  deleteAllButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 121, 146, 0.9)",
    backgroundColor: "rgba(255, 85, 119, 0.16)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  deleteAllButtonText: {
    color: "#ffdce3",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(118, 171, 255, 0.45)",
    backgroundColor: "rgba(7, 24, 40, 0.92)",
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    color: "#dff3ff",
    fontSize: 17,
    fontWeight: "700",
  },
  emptyText: {
    color: "#9ec1d8",
    fontSize: 14,
    textAlign: "center",
  },
  passwordCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(108, 180, 255, 0.4)",
    backgroundColor: "rgba(5, 21, 36, 0.95)",
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderText: {
    color: "#7cdcff",
    fontSize: 13,
    fontWeight: "700",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineShowButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(69, 225, 174, 0.7)",
    backgroundColor: "rgba(45, 197, 149, 0.12)",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  timeText: {
    color: "#8eb6d2",
    fontSize: 13,
    fontWeight: "500",
  },
  passwordText: {
    color: "#f2fffc",
    fontSize: 17,
    fontWeight: "600",
  },
  passwordHiddenText: {
    fontSize: 20,
    letterSpacing: 6,
    fontWeight: "700",
    color: "#cfeff6",
  },
  countText: {
    color: "#9ec1d8",
    fontSize: 13,
    fontWeight: "700",
    marginRight: 8,
    alignSelf: "center",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  saveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(69, 225, 174, 0.8)",
    backgroundColor: "rgba(45, 197, 149, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  saveButtonText: {
    color: "#ddfff4",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  copyButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(127, 251, 226, 0.7)",
    backgroundColor: "rgba(24, 232, 198, 0.16)",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  copyButtonText: {
    color: "#d8fff8",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  deleteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 121, 146, 0.8)",
    backgroundColor: "rgba(255, 85, 119, 0.16)",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  deleteButtonText: {
    color: "#ffdce3",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
