import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { X, Clock, Check, PhoneOff, PhoneCall, Sparkles } from "lucide-react-native";

interface DispositionOption {
  id: string;
  name: string;
  color?: string;
  category?: string;
  code?: string;
}

interface RapidLoggerModalProps {
  visible: boolean;
  leadId: number;
  studentName: string;
  dispositions: DispositionOption[];
  onClose: () => void;
  onSuccess: () => void;
  initialDurationSeconds?: number;
}

export function RapidLoggerModal({
  visible,
  leadId,
  studentName,
  dispositions,
  onClose,
  onSuccess,
  initialDurationSeconds = 0,
}: RapidLoggerModalProps) {
  const [outcomeType, setOutcomeType] = useState<"connected" | "unreachable">("connected");
  const [selectedDispId, setSelectedDispId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs < 10 ? "0" : ""}${remSecs}s`;
  };

  const handleSaveOutcome = async () => {
    if (!selectedDispId) {
      Alert.alert("Disposition Required", "Please select a call disposition to log this interaction.");
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await MobileApiClient.fetchJson<{ success: boolean }>(
        `/api/leads/${leadId}/disposition`,
        {
          method: "POST",
          body: JSON.stringify({
            disposition_id: selectedDispId,
            call_outcome: outcomeType,
            notes: notes.trim(),
            call_duration_seconds: initialDurationSeconds,
          }),
        }
      );

      if (error) {
        Alert.alert("Logging Failed", error.message);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to log disposition");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDispositions = dispositions.filter((d) => {
    const isUnreach =
      d.category === "unreachable" ||
      d.code === "INVALID_NUM" ||
      ["RNR", "BUSY", "SWITCH_OFF", "INVALID_NUM"].includes(d.code || "");
    return outcomeType === "unreachable" ? isUnreach : !isUnreach;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <Sparkles size={16} color={Colors.primaryLight} />
                <Text style={styles.sheetTitle}>Log Call Outcome</Text>
              </View>
              <Text style={styles.subTitle} numberOfLines={1}>
                Student: <Text style={styles.studentNameHighlight}>{studentName}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Duration Pill */}
            {initialDurationSeconds > 0 && (
              <View style={styles.durationPill}>
                <Clock size={14} color={Colors.warning} />
                <Text style={styles.durationText}>
                  Detected Call Duration: <Text style={styles.bold}>{formatDuration(initialDurationSeconds)}</Text>
                </Text>
              </View>
            )}

            {/* Outcome Switcher */}
            <Text style={styles.sectionLabel}>STEP 1: CALL STATUS</Text>
            <View style={styles.outcomeToggleContainer}>
              <TouchableOpacity
                onPress={() => setOutcomeType("connected")}
                style={[
                  styles.outcomeBtn,
                  outcomeType === "connected" && styles.outcomeBtnConnectedActive,
                ]}
              >
                <PhoneCall
                  size={16}
                  color={outcomeType === "connected" ? "#fff" : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.outcomeBtnText,
                    outcomeType === "connected" && styles.outcomeBtnTextActive,
                  ]}
                >
                  Connected
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setOutcomeType("unreachable")}
                style={[
                  styles.outcomeBtn,
                  outcomeType === "unreachable" && styles.outcomeBtnUnreachableActive,
                ]}
              >
                <PhoneOff
                  size={16}
                  color={outcomeType === "unreachable" ? "#fff" : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.outcomeBtnText,
                    outcomeType === "unreachable" && styles.outcomeBtnTextActive,
                  ]}
                >
                  Unreachable
                </Text>
              </TouchableOpacity>
            </View>

            {/* Disposition List */}
            <Text style={styles.sectionLabel}>STEP 2: SELECT DISPOSITION</Text>
            <View style={styles.dispGrid}>
              {filteredDispositions.map((d) => {
                const isSelected = selectedDispId === d.id;
                const badgeColor = d.color || Colors.primary;
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => setSelectedDispId(d.id)}
                    style={[
                      styles.dispPill,
                      isSelected && {
                        borderColor: badgeColor,
                        backgroundColor: `${badgeColor}25`,
                      },
                    ]}
                  >
                    <View style={[styles.dispDot, { backgroundColor: badgeColor }]} />
                    <Text
                      style={[
                        styles.dispText,
                        isSelected && { color: "#fff", fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {d.name}
                    </Text>
                    {isSelected && <Check size={14} color={badgeColor} style={{ marginLeft: "auto" }} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Notes */}
            <Text style={styles.sectionLabel}>COUNSELOR CALL NOTES</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={3}
              placeholder="Record details of conversation, course preference, budget, objections..."
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
            />
          </ScrollView>

          {/* Footer Save Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSaveOutcome}
              disabled={submitting}
              style={[
                styles.saveButton,
                !selectedDispId && styles.saveButtonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Call Outcome</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: Colors.backgroundDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  subTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  studentNameHighlight: {
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
  },
  body: {
    marginVertical: 14,
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  durationText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  bold: {
    fontWeight: "700",
    color: Colors.warning,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  outcomeToggleContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  outcomeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  outcomeBtnConnectedActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  outcomeBtnUnreachableActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  outcomeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  outcomeBtnTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  dispGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  dispPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
    width: "48%",
  },
  dispDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dispText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  notesInput: {
    backgroundColor: Colors.cardDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlignVertical: "top",
    minHeight: 70,
  },
  footer: {
    paddingTop: 10,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
