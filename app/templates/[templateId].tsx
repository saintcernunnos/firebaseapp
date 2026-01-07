import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function TemplateDetails() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Template</Text>
      <Text>templateId: {templateId}</Text>
      <Text style={styles.note}>
        This screen is optional. Your template save/load/delete now works from /app/index.tsx.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  note: { marginTop: 12, opacity: 0.7 },
});
