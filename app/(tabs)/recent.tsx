import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DeleteConfirmBubble } from "@/components/ui/delete-confirm-bubble";
import { getI18n } from "@/constants/i18n";
import { usePasswordStore } from "@/contexts/password-store";

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
  const [savedToastById, setSavedToastById] = useState<Record<string, boolean>>(
    {},
  );
  const savedToastTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const sounds = useRef<{
    save: Audio.Sound | null;
    delete: Audio.Sound | null;
  }>({
    save: null,
    delete: null,
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

        const [{ sound: save }, { sound: del }] = await Promise.all([
          Audio.Sound.createAsync(require("../../assets/sounds/save.mp3"), {
            shouldPlay: false,
            volume: 1,
          }),
          Audio.Sound.createAsync(require("../../assets/sounds/delete.mp3"), {
            shouldPlay: false,
            volume: 1,
          }),
        ]);

        if (!isMounted) {
          await Promise.all([save.unloadAsync(), del.unloadAsync()]);
          return;
        }

        sounds.current = {
          save,
          delete: del,
        };

        void Promise.all([warmupSound(save), warmupSound(del)]);
      } catch {
        sounds.current = {
          save: null,
          delete: null,
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

      void Promise.all(
        Object.values(sounds.current)
          .filter((sound): sound is Audio.Sound => sound !== null)
          .map((sound) => sound.unloadAsync()),
      );
      sounds.current = {
        save: null,
        delete: null,
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

  const onClearAllRecentConfirmed = async () => {
    void playSound("delete");
    clearRecentPasswords();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsClearAllPromptOpen(false);
  };

  const formatDate = (isoDate: string) =>
    dateFormatter.format(new Date(isoDate));

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
                <Text style={styles.orderText}>#{index + 1}</Text>
                <Text style={styles.timeText}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>
              <Text style={styles.passwordText}>{item.password}</Text>
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.saveButton}
                  onPress={() => {
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
    paddingTop: 42,
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
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  subHeader: {
    color: "#9fc2da",
    textAlign: "center",
    fontSize: 13,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteAllButtonText: {
    color: "#ffdce3",
    fontSize: 12,
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
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderText: {
    color: "#7cdcff",
    fontSize: 12,
    fontWeight: "700",
  },
  timeText: {
    color: "#8eb6d2",
    fontSize: 12,
    fontWeight: "500",
  },
  passwordText: {
    color: "#f2fffc",
    fontSize: 16,
    fontWeight: "600",
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
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveButtonText: {
    color: "#ddfff4",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  deleteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 121, 146, 0.8)",
    backgroundColor: "rgba(255, 85, 119, 0.16)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deleteButtonText: {
    color: "#ffdce3",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
