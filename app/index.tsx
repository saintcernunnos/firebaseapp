import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import {
  firestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  getDocs,
  MESSAGES,
} from "../firebase/config";

type SessionEntry = {
  id: string;
  text: string;
  createdAtLabel: string;
};

type TemplateDoc = {
  id: string;
  name: string;
  entries: string[];
  updatedAtLabel: string;
};

const TEMPLATES_COLLECTION = "templates";

export default function Index() {
  const [draftEntry, setDraftEntry] = useState("");
  const [sessionEntries, setSessionEntries] = useState<SessionEntry[]>([]);

  const sessionColRef = useMemo(() => collection(firestore, MESSAGES), []);

  async function addSessionEntry() {
    const text = draftEntry.trim();
    if (!text) return;

    try {
      await addDoc(sessionColRef, { text, createdAt: serverTimestamp() });
      setDraftEntry("");
    } catch (e) {
      console.error("Failed to add entry", e);
    }
  }

  async function deleteSessionEntry(entryId: string) {
    try {
      await deleteDoc(doc(firestore, MESSAGES, entryId));
    } catch (e) {
      console.error("Failed to delete entry", e);
    }
  }

  async function clearSessionEntries() {
    try {
      await Promise.all(
        sessionEntries.map((e) => deleteDoc(doc(firestore, MESSAGES, e.id)))
      );
    } catch (err) {
      console.error("Failed to clear session", err);
    }
  }

  useEffect(() => {
    const q = query(sessionColRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: SessionEntry[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const text = String(data?.text ?? "");

          const createdAt =
            data?.createdAt?.toDate?.() instanceof Date ? data.createdAt.toDate() : null;

          return {
            id: d.id,
            text,
            createdAtLabel: createdAt ? createdAt.toLocaleString() : "…",
          };
        });

        setSessionEntries(rows);
      },
      (error) => console.error("Session onSnapshot error", error)
    );

    return unsub;
  }, [sessionColRef]);

  const [templates, setTemplates] = useState<TemplateDoc[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const templatesColRef = useMemo(
    () => collection(firestore, TEMPLATES_COLLECTION),
    []
  );

  useEffect(() => {
    const q = query(templatesColRef, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: TemplateDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const entries = Array.isArray(data?.entries)
            ? data.entries.map((x: any) => String(x))
            : [];

          const updatedAt =
            data?.updatedAt?.toDate?.() instanceof Date ? data.updatedAt.toDate() : null;

          return {
            id: d.id,
            name: String(data?.name ?? "Untitled"),
            entries,
            updatedAtLabel: updatedAt ? updatedAt.toLocaleString() : "…",
          };
        });

        setTemplates(rows);
      },
      (error) => console.error("Templates onSnapshot error", error)
    );

    return unsub;
  }, [templatesColRef]);

  async function saveTemplateFromSession() {
    const name = templateName.trim();
    if (!name) return;

    const entries = sessionEntries
      .map((e) => e.text.trim())
      .filter((t) => t.length > 0);

    if (entries.length === 0) {
      Alert.alert("Nothing to save", "Add at least one entry before saving a template.");
      return;
    }

    try {
      await addDoc(templatesColRef, {
        name,
        entries,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTemplateName("");
      setSaveOpen(false);
    } catch (e) {
      console.error("Failed to save template", e);
    }
  }

  async function loadTemplateIntoSession(templateId: string) {
    try {
      const snap = await getDoc(doc(firestore, TEMPLATES_COLLECTION, templateId));
      if (!snap.exists()) {
        Alert.alert("Template not found", "It may have been deleted.");
        return;
      }

      const data = snap.data() as any;
      const entries: string[] = Array.isArray(data?.entries)
        ? data.entries.map((x: any) => String(x))
        : [];

      await clearSessionEntries();

      for (const entry of entries) {
        const text = entry.trim();
        if (!text) continue;
        await addDoc(sessionColRef, { text, createdAt: serverTimestamp() });
      }

      setTemplatesOpen(false);
    } catch (e) {
      console.error("Failed to load template", e);
    }
  }

  function confirmDeleteTemplate(templateId: string) {
    Alert.alert("Delete template?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(firestore, TEMPLATES_COLLECTION, templateId));
          } catch (e) {
            console.error("Failed to delete template", e);
          }
        },
      },
    ]);
  }

  // Helper: wipe all templates
  async function clearAllTemplates() {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert("Delete ALL templates?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Delete all", style: "destructive", onPress: () => resolve(true) },
      ]);
    });

    if (!ok) return;

    try {
      const snap = await getDocs(templatesColRef);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (e) {
      console.error("Failed to clear templates", e);
    }
  }

  const canSaveTemplate = sessionEntries.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout Session</Text>

      <View style={styles.row}>
        <TextInput
          value={draftEntry}
          onChangeText={setDraftEntry}
          placeholder="Add exercise (e.g. Bench Press)"
          style={styles.input}
          onSubmitEditing={addSessionEntry}
          returnKeyType="done"
        />
        <View style={styles.rowBtn}>
          <Button title="Add" onPress={addSessionEntry} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowBtn}>
          <Button title="Templates" onPress={() => setTemplatesOpen(true)} />
        </View>
        <View style={styles.rowBtn}>
          <Button
            title="Save template"
            onPress={() => setSaveOpen(true)}
            disabled={!canSaveTemplate}
          />
        </View>
        <View style={styles.rowBtn}>
          <Button title="Clear session" onPress={clearSessionEntries} />
        </View>
      </View>

      <FlatList
        data={sessionEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No entries yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.entryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryText}>{item.text}</Text>
              <Text style={styles.meta}>{item.createdAtLabel}</Text>
            </View>
            <View style={styles.rowBtn}>
              <Button title="Done" onPress={() => deleteSessionEntry(item.id)} />
            </View>
          </View>
        )}
      />

      {/* Templates Modal */}
      <Modal
        visible={templatesOpen}
        animationType="slide"
        onRequestClose={() => setTemplatesOpen(false)}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Templates</Text>

          <FlatList
            data={templates}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={<Text style={styles.empty}>No templates yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.templateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateName}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.entries.length} entries • updated {item.updatedAtLabel}
                  </Text>
                </View>

                <Pressable
                  style={styles.pill}
                  onPress={() => loadTemplateIntoSession(item.id)}
                >
                  <Text>Load</Text>
                </Pressable>

                <Pressable
                  style={styles.pillDanger}
                  onPress={() => confirmDeleteTemplate(item.id)}
                >
                  <Text style={{ color: "white" }}>Delete</Text>
                </Pressable>
              </View>
            )}
          />

          <View style={styles.row}>
            <View style={styles.rowBtn}>
              <Button title="Close" onPress={() => setTemplatesOpen(false)} />
            </View>
            <View style={styles.rowBtn}>
              <Button title="Clear templates (dev)" onPress={clearAllTemplates} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Save Template Modal */}
      <Modal
        visible={saveOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.modalTitle}>Save template</Text>

            <TextInput
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="Template name (e.g. Chest Workout)"
              style={styles.input}
              autoFocus
            />

            <View style={styles.row}>
              <View style={styles.rowBtn}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setTemplateName("");
                    setSaveOpen(false);
                  }}
                />
              </View>
              <View style={styles.rowBtn}>
                <Button title="Save" onPress={saveTemplateFromSession} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 12 },

  row: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  rowBtn: { marginLeft: 8 },

  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10 },

  listContent: { paddingTop: 8, paddingBottom: 24 },
  empty: { marginTop: 12, opacity: 0.7 },

  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  entryText: { fontSize: 16 },
  meta: { fontSize: 12, opacity: 0.7, marginTop: 2 },

  modal: { flex: 1, padding: 16, paddingTop: 48 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },

  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  templateName: { fontSize: 16, fontWeight: "600" },

  pill: {
    marginLeft: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 999,
  },
  pillDanger: {
    marginLeft: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#c0392b",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  dialog: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
  },
});
