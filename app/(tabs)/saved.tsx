import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { usePasswordStore } from "@/contexts/password-store";

export default function SavedPasswordsScreen() {
  const { savedPasswords, removeSavedPassword } = usePasswordStore();

  const onDeletePassword = async (password: string) => {
    removeSavedPassword(password);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
            <View key={`${item}-${index}`} style={styles.passwordCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderText}>Kayıt {index + 1}</Text>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => {
                    void onDeletePassword(item);
                  }}
                >
                  <Text style={styles.deleteButtonText}>Sil</Text>
                </Pressable>
              </View>
              <Text style={styles.passwordText}>{item}</Text>
            </View>
          ))
        )}
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
    paddingTop: 18,
    paddingBottom: 24,
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
  orderText: {
    color: "#91ddff",
    fontSize: 12,
    fontWeight: "700",
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
