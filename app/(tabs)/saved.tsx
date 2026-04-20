import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DeleteConfirmBubble } from "@/components/ui/delete-confirm-bubble";
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

export default function SavedPasswordsScreen() {
  const { savedPasswords, removeSavedPassword, renameSavedPassword } =
    usePasswordStore();
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const hideSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const sounds = useRef<{
    save: Audio.Sound | null;
    delete: Audio.Sound | null;
  }>({
    save: null,
    delete: null,
  });

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  useEffect(() => {
    setNameDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const item of savedPasswords) {
        next[item.id] = prev[item.id] ?? item.name;
      }
      return next;
    });
  }, [savedPasswords]);

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
      Object.values(hideSaveTimers.current).forEach((timer) => {
        clearTimeout(timer);
      });
      hideSaveTimers.current = {};

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

  const onDeletePasswordConfirmed = async (id: string) => {
    void playSound("delete");
    removeSavedPassword(id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingDeleteId(null);
  };

  const onSaveName = async (id: string) => {
    const normalizedName = (nameDrafts[id] ?? "").slice(0, 15);
    void playSound("save");
    renameSavedPassword(id, normalizedName);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (hideSaveTimers.current[id]) {
      clearTimeout(hideSaveTimers.current[id]);
    }

    setJustSaved((prev) => ({
      ...prev,
      [id]: true,
    }));

    hideSaveTimers.current[id] = setTimeout(() => {
      setJustSaved((prev) => ({
        ...prev,
        [id]: false,
      }));
      delete hideSaveTimers.current[id];
    }, 900);
  };

  const formatDate = (isoDate: string) =>
    dateFormatter.format(new Date(isoDate));

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <Text style={styles.header}>Kaydedilenler</Text>
        <Text style={styles.subHeader}>Maksimum 30 kayıt tutulur</Text>

        {savedPasswords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Henüz kaydedilen yok</Text>
            <Text style={styles.emptyText}>
              Ana Menüde şifreyi ürettikten sonra Kaydet ile buraya eklenir.
            </Text>
          </View>
        ) : (
          savedPasswords.map((item, index) => (
            <View key={item.id} style={styles.passwordCard}>
              <View style={styles.cardHeader}>
                <TextInput
                  value={nameDrafts[item.id] ?? ""}
                  onChangeText={(text) => {
                    setNameDrafts((prev) => ({
                      ...prev,
                      [item.id]: text.slice(0, 15),
                    }));
                  }}
                  maxLength={15}
                  placeholder={`Kayıt ${index + 1}`}
                  placeholderTextColor="#91ddff"
                  style={styles.orderInput}
                />
                <Text style={styles.timeText}>{formatDate(item.savedAt)}</Text>
                {((nameDrafts[item.id] ?? "") !== item.name ||
                  justSaved[item.id]) && (
                  <Pressable
                    style={styles.saveButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      void onSaveName(item.id);
                    }}
                  >
                    <Text style={styles.saveButtonText}>
                      {justSaved[item.id] ? "Kaydedildi" : "Kaydet"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => {
                    setPendingDeleteId(item.id);
                  }}
                >
                  <Text style={styles.deleteButtonText}>Sil</Text>
                </Pressable>
              </View>

              <Text style={styles.passwordText}>{item.password}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <DeleteConfirmBubble
        visible={pendingDeleteId !== null}
        message="Bu sifreyi silmek istediginize emin misiniz?"
        onCancel={() => {
          setPendingDeleteId(null);
        }}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }
          void onDeletePasswordConfirmed(pendingDeleteId);
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
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(68, 141, 255, 0.2)",
    top: -70,
    right: -60,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(24, 232, 198, 0.15)",
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
    borderColor: "rgba(111, 183, 255, 0.4)",
    backgroundColor: "rgba(5, 21, 36, 0.95)",
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderInput: {
    minWidth: 90,
    maxWidth: 130,
    borderWidth: 1,
    borderColor: "rgba(95, 156, 210, 0.55)",
    backgroundColor: "rgba(7, 24, 40, 0.7)",
    borderRadius: 8,
    color: "#e5f6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  timeText: {
    color: "#8eb6d2",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginRight: 8,
  },
  saveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(69, 225, 174, 0.8)",
    backgroundColor: "rgba(45, 197, 149, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  passwordText: {
    color: "#f2fffc",
    fontSize: 16,
    fontWeight: "600",
  },
});
