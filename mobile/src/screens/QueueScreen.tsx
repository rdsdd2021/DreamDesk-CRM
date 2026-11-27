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
  RefreshControl,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { MobileLead } from "../components/LeadCard";
import { AcademicHighlightsCard } from "../components/AcademicHighlightsCard";
import { RapidLoggerModal } from "../components/RapidLoggerModal";
import { WhatsAppChatModal } from "../components/WhatsAppChatModal";
import { useCallTracker } from "../hooks/useCallTracker";
import { MobileCache } from "../utils/cache";
import { PhoneCall, Sparkles, CheckCircle2, ChevronRight, MessageSquare, Eye } from "lucide-react-native";

export function QueueScreen({ navigation }: any) {
  const [queueLeads, setQueueLeads] = useState<MobileLead[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dispositions, setDispositions] = useState<any[]>([]);

  // Rapid Logger Modal
  const [isRapidLoggerOpen, setIsRapidLoggerOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  const { startCall } = useCallTracker((_leadId, _leadName, durationSec) => {
    setCallDuration(durationSec);
    setIsRapidLoggerOpen(true);
  });

  const loadQueue = useCallback(async (isPull = false) => {
    try {
      if (!isPull && queueLeads.length === 0) setLoading(true);
      const [leadsRes, dispRes] = await Promise.all([
        MobileApiClient.fetchJson<{ leads: MobileLead[] }>("/api/leads?calling_recency=uncalled_today&limit=50"),
        MobileApiClient.fetchJson<any[]>("/api/dispositions"),
      ]);

      if (leadsRes.data?.leads) {
        setQueueLeads(leadsRes.data.leads);
        setCurrentIndex(0);
        MobileCache.set("queue_leads", leadsRes.data.leads);
      }
      if (Array.isArray(dispRes.data)) {
        setDispositions(dispRes.data);
        MobileCache.set("dispositions", dispRes.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    MobileCache.get<MobileLead[]>("queue_leads").then((cached) => {
      if (cached && cached.length > 0) {
        setQueueLeads(cached);
        setLoading(false);
      }
    });
    loadQueue();
  }, [loadQueue]);

  const currentLead = queueLeads[currentIndex];

  const handleTriggerWhatsApp = () => {
    if (!currentLead) return;
    setIsWhatsAppOpen(true);
  };

  const handleNextLead = (logged = false) => {
    if (logged) setCompletedCount((c) => c + 1);
    if (currentIndex < queueLeads.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      Alert.alert("Queue Finished", "You have reviewed all uncalled leads in today's queue!");
      setCurrentIndex(queueLeads.length);
    }
  };

  if (loading && queueLeads.length === 0) {
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
        <TouchableOpacity onPress={() => loadQueue()} style={styles.reloadBtn}>
          <Text style={styles.reloadBtnText}>Check for New Leads</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const remainingCount = Math.max(0, queueLeads.length - currentIndex);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadQueue(true);
          }}
          tintColor={Colors.primary}
        />
      }
    >
      {/* KPI Summary Strip */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{remainingCount}</Text>
          <Text style={styles.kpiLabel}>REMAINING</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: Colors.success }]}>{completedCount}</Text>
          <Text style={styles.kpiLabel}>LOGGED</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: Colors.primaryLight }]}>{queueLeads.length}</Text>
          <Text style={styles.kpiLabel}>TODAY QUEUE</Text>
        </View>
      </View>

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

        {/* Call + WhatsApp Action Row */}
        {currentLead.phone ? (
          <View style={styles.primaryActionsRow}>
            <TouchableOpacity
              onPress={() => startCall(currentLead.id, currentLead.name, currentLead.phone)}
              style={styles.bigCallBtn}
              activeOpacity={0.8}
            >
              <PhoneCall size={18} color="#fff" />
              <Text style={styles.bigCallBtnText}>Call ({currentLead.phone})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTriggerWhatsApp}
              style={styles.waBtn}
              activeOpacity={0.8}
            >
              <MessageSquare size={20} color="#10b981" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noPhoneBox}>
            <Text style={styles.noPhoneText}>No phone number available for this student</Text>
          </View>
        )}

        {/* Secondary Actions */}
        <View style={styles.skipRow}>
          <TouchableOpacity
            onPress={() => {
              setCallDuration(0);
              setIsRapidLoggerOpen(true);
            }}
            style={styles.logWithoutCallBtn}
          >
            <Text style={styles.logWithoutCallText}>Log Outcome</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("LeadDetail", { leadId: currentLead.id })}
            style={styles.logWithoutCallBtn}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Eye size={13} color={Colors.textSecondary} />
              <Text style={styles.logWithoutCallText}>Profile</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleNextLead(false)} style={styles.nextLeadBtn}>
            <Text style={styles.nextLeadBtnText}>Skip</Text>
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
          handleNextLead(true);
        }}
      />

      <WhatsAppChatModal
        visible={isWhatsAppOpen}
        leadId={currentLead.id}
        leadName={currentLead.name}
        onClose={() => setIsWhatsAppOpen(false)}
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
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.cardDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 10,
    alignItems: "center",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.6,
  },
  progressHeader: {
    marginBottom: 14,
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
  primaryActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  bigCallBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.success,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  bigCallBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  waBtn: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.successMuted,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderRadius: 16,
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
    gap: 8,
  },
  logWithoutCallBtn: {
    paddingVertical: 9,
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
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginLeft: "auto",
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
