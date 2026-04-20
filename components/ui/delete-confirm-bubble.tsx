import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

type DeleteConfirmBubbleProps = {
  visible: boolean;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmBubble({
  visible,
  message,
  cancelLabel = "Iptal",
  confirmLabel = "Sil",
  onCancel,
  onConfirm,
}: DeleteConfirmBubbleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 7,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 14,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <Animated.View
        style={[styles.bubble, { opacity, transform: [{ translateY }] }]}
      >
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={onConfirm}>
            <Text style={styles.deleteText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 8, 18, 0.58)",
  },
  bubble: {
    width: "86%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94, 181, 255, 0.55)",
    backgroundColor: "rgba(7, 21, 36, 0.96)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#2aa9ff",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  message: {
    color: "#dff4ff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  cancelButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(149, 182, 209, 0.7)",
    backgroundColor: "rgba(84, 115, 143, 0.22)",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  cancelText: {
    color: "#d3e6f5",
    fontSize: 12,
    fontWeight: "700",
  },
  deleteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 113, 144, 0.9)",
    backgroundColor: "rgba(255, 82, 121, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  deleteText: {
    color: "#ffdbe4",
    fontSize: 12,
    fontWeight: "800",
  },
});
