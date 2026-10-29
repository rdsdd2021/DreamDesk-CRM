import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { Colors } from "../theme/colors";
import { X, Filter, RotateCcw, Check } from "lucide-react-native";

export interface MobileFilterState {
  status?: string;
  calling_recency?: string;
  stream?: string;
  school?: string;
  city?: string;
}

interface FilterModalProps {
  visible: boolean;
  filters: MobileFilterState;
  onClose: () => void;
  onApply: (filters: MobileFilterState) => void;
  onReset: () => void;
}

const STAGES = [
  "New",
  "Contacted",
  "Interested",
  "Follow-up",
  "Admitted",
  "Not Interested",
  "Unreachable",
];

const RECENCY_OPTIONS = [
  { label: "Uncalled Today", value: "uncalled_today" },
  { label: "Called Today", value: "called_today" },
  { label: "Never Called", value: "never_called" },
  { label: "Needs Retry", value: "needs_retry" },
];

const COMMON_STREAMS = ["Science", "Commerce", "Arts", "Engineering", "Medical", "Management"];

export function FilterModal({
  visible,
  filters,
  onClose,
  onApply,
  onReset,
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<MobileFilterState>(filters);

  const toggleStatus = (st: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      status: prev.status === st ? undefined : st,
    }));
  };

  const toggleRecency = (rec: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      calling_recency: prev.calling_recency === rec ? undefined : rec,
    }));
  };

  const toggleStream = (str: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      stream: prev.stream === str ? undefined : str,
    }));
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({});
    onReset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Filter size={18} color={Colors.primaryLight} />
              <Text style={styles.headerTitle}>Filter Leads</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Stage / Status Filter */}
            <Text style={styles.sectionHeader}>LEAD STAGE</Text>
            <View style={styles.pillContainer}>
              {STAGES.map((st) => {
                const isSelected = localFilters.status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => toggleStatus(st)}
                    style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                      {st}
                    </Text>
                    {isSelected && <Check size={12} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Calling Recency */}
            <Text style={styles.sectionHeader}>CALLING RECENCY</Text>
            <View style={styles.pillContainer}>
              {RECENCY_OPTIONS.map((rec) => {
                const isSelected = localFilters.calling_recency === rec.value;
                return (
                  <TouchableOpacity
                    key={rec.value}
                    onPress={() => toggleRecency(rec.value)}
                    style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                      {rec.label}
                    </Text>
                    {isSelected && <Check size={12} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Academic Stream */}
            <Text style={styles.sectionHeader}>ACADEMIC STREAM</Text>
            <View style={styles.pillContainer}>
              {COMMON_STREAMS.map((str) => {
                const isSelected = localFilters.stream === str;
                return (
                  <TouchableOpacity
                    key={str}
                    onPress={() => toggleStream(str)}
                    style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                      {str}
                    </Text>
                    {isSelected && <Check size={12} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* School / College Input Filter */}
            <Text style={styles.sectionHeader}>SCHOOL / COLLEGE NAME</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. DPS, St. Xavier's, KV..."
              placeholderTextColor={Colors.textMuted}
              value={localFilters.school || ""}
              onChangeText={(txt) =>
                setLocalFilters((prev) => ({ ...prev, school: txt.trim() || undefined }))
              }
            />

            {/* City / Region Input Filter */}
            <Text style={styles.sectionHeader}>CITY / LOCATION</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Delhi, Patna, Kolkata..."
              placeholderTextColor={Colors.textMuted}
              value={localFilters.city || ""}
              onChangeText={(txt) =>
                setLocalFilters((prev) => ({ ...prev, city: txt.trim() || undefined }))
              }
            />
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
              <RotateCcw size={15} color={Colors.textSecondary} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleApply} style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
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
  modalContent: {
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
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
  },
  body: {
    marginVertical: 12,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 10,
  },
  pillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 5,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  textInput: {
    backgroundColor: Colors.cardDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  applyBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
