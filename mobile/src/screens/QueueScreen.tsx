import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { MobileLead } from "../components/LeadCard";
import { AcademicHighlightsCard } from "../components/AcademicHighlightsCard";
import { RapidLoggerModal } from "../components/RapidLoggerModal";
import { PhoneCall, Sparkles, CheckCircle2, ChevronRight, MessageSquare, Clock } from "lucide-react-native";

export function QueueScreen({ navigation }: any) {
  const [queueLeads, setQueueLeads] = useState<MobileLead[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dispositions, setDispositions] = useState<any[]>([]);

  // Rapid Logger Modal
  const [isRapidLoggerOpen, setIsRapidLoggerOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      const [leadsRes, dispRes] = await Promise.all([
        MobileApiClient.fetchJson<{ leads: MobileLead[] }>("/api/leads?calling_recency=uncalled_today&limit=50"),
        MobileApiClient.fetchJson<any[]>("/api/dispositions"),
      ]);

      if (leadsRes.data?.leads) {
        setQueueLeads(leadsRes.data.leads);
        setCurrentIndex(0);
      }
      if (Array.isArray(dispRes.data)) {
        setDispositions(dispRes.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const currentLead = queueLeads[currentIndex];

  const handleDialCurrentLead = async () => {
    if (!currentLead) return;
    try {
      setCallStartTime(Date.now());
      const { data } = await MobileApiClient.fetchJson<{ dialUri: string }>(
        `/api/leads/${currentLead.id}/call-intent`,
        { method: "POST" }
      );

      const dialTarget = data?.dialUri || (currentLead.phone ? `tel:${currentLead.phone}` : null);
      if (dialTarget) {
        await Linking.openURL(dialTarget);
        setTimeout(() => {
          if (callStartTime) {
            const secs = Math.max(1, Math.round((Date.now() - callStartTime) / 1000));
            setCallDuration(secs);
          } else {
            setCallDuration(45);
          }
          setIsRapidLoggerOpen(true);
        }, 1500);
      }
    } catch {
      Alert.alert("Dial Error", "Could not trigger phone dialer");
    }
  };

  const handleNextLead = () => {
    if (currentIndex < queueLeads.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      Alert.alert("Queue Finished", "You have reviewed all uncalled leads in today's queue!");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading telecaller dialing queue...</Text>
      </View>
    );
  }

  if (!currentLead) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <CheckCircle2 size={44} color={Colors.success} />
        </View>
        <Text style={styles.emptyTitle}>Dialing Queue Complete!</Text>
        <Text style={styles.emptySubtitle}>
          You have contacted all leads assigned for today. Excellent outreach velocity!
        </Text>
        <TouchableOpacity onPress={loadQueue} style={styles.reloadBtn}>
          <Text style={styles.reloadBtnText}>Check for New Leads</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Queue Progress Header */}
      <View style={styles.progressHeader}>
        <View style={styles.badgeRow}>
          <View style={styles.queueBadge}>
            <Sparkles size={12} color={Colors.primaryLight} />
            <Text style={styles.queueBadgeText}>DIALING QUEUE FOCUS</Text>
          </View>
          <Text style={styles.progressCounter}>
            Lead {currentIndex + 1} of {queueLeads.length}
          </Text>
        </View>

        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((currentIndex + 1) / queueLeads.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Hero Student Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(currentLead.name || "S").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.heroNameBlock}>
            <Text style={styles.studentName} numberOfLines={1}>
              {currentLead.name || "Unnamed Student"}
            </Text>
            <Text style={styles.leadCode}>{currentLead.lead_code}</Text>
          </View>
          <View style={styles.stagePill}>
            <Text style={styles.stageText}>{currentLead.status}</Text>
          </View>
        </View>

        {/* Academic Highlights */}
        <AcademicHighlightsCard rawAttributes={currentLead.raw_attributes} />

        {/* Huge Call Now Action Button */}
        {currentLead.phone ? (
          <TouchableOpacity
            onPress={handleDialCurrentLead}
            style={styles.bigCallBtn}
            activeOpacity={0.8}
          >
            <PhoneCall size={20} color="#fff" />
            <Text style={styles.bigCallBtnText}>Call Now ({currentLead.phone})</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noPhoneBox}>
            <Text style={styles.noPhoneText}>No phone number available for this student</Text>
          </View>
        )}

        {/* Skip / Next Actions */}
        <View style={styles.skipRow}>
          <TouchableOpacity
            onPress={() => setIsRapidLoggerOpen(true)}
            style={styles.logWithoutCallBtn}
          >
            <Text style={styles.logWithoutCallText}>Manual Outcome</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNextLead} style={styles.nextLeadBtn}>
            <Text style={styles.nextLeadBtnText}>Skip / Next</Text>
            <ChevronRight size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Rapid Logger Modal */}
      <RapidLoggerModal
        visible={isRapidLoggerOpen}
        leadId={currentLead.id}
        studentName={currentLead.name}
        dispositions={dispositions}
        initialDurationSeconds={callDuration}
        onClose={() => {
          setIsRapidLoggerOpen(false);
          setCallDuration(0);
        }}
        onSuccess={() => {
          handleNextLead();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    padding: 16,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  progressHeader: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  queueBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  progressCounter: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
  heroCard: {
    backgroundColor: Colors.cardDark,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 18,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primaryLight,
  },
  heroNameBlock: {
    flex: 1,
  },
  studentName: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  leadCode: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Colors.textMuted,
    marginTop: 2,
  },
  stagePill: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  bigCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.success,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    marginTop: 6,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bigCallBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  noPhoneBox: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginTop: 6,
  },
  noPhoneText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  skipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  logWithoutCallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  logWithoutCallText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  nextLeadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  nextLeadBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.successMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  reloadBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  reloadBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
