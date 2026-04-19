import { ScrollView, StyleSheet, Text, View } from "react-native";

import { usePasswordStore } from "@/contexts/password-store";

export default function RecentPasswordsScreen() {
  const { recentPasswords } = usePasswordStore();

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Son Kayıtlar</Text>
        <Text style={styles.subHeader}>
          En son üretilen 15 şifre listelenir
        </Text>

        {recentPasswords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Henüz kayıt yok</Text>
            <Text style={styles.emptyText}>
              Ana Menü sayfasında şifre üretince burada görünecek.
            </Text>
          </View>
        ) : (
          recentPasswords.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.passwordCard}>
              <Text style={styles.orderText}>#{index + 1}</Text>
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
  orderText: {
    color: "#7cdcff",
    fontSize: 12,
    fontWeight: "700",
  },
  passwordText: {
    color: "#f2fffc",
    fontSize: 16,
    fontWeight: "600",
  },
});
