import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
import { PhoneCall, MessageSquare, Mail, MapPin, Sparkles, History } from "lucide-react-native";

interface ActivityItem {
  id: number;
  title: string;
  description?: string;
  performed_by_name?: string;
  created_at: string;
}

const STAGES = ["New", "Contacted", "Interested", "Follow-up", "Admitted", "Unreachable"];

export function LeadDetailScreen({ route }: any) {
  const { leadId } = route.params;
  const [lead, setLead] = useState<MobileLead | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dispositions, setDispositions] = useState<any[]>([]);

  // Rapid Logger
  const [isRapidLoggerOpen, setIsRapidLoggerOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  const { startCall } = useCallTracker((_id, _name, durationSec) => {
    setCallDuration(durationSec);
    setIsRapidLoggerOpen(true);
  });

  const fetchLeadDetails = useCallback(async (isPull = false) => {
    try {
      if (!isPull && !lead) setLoading(true);
      const [leadRes, dispRes, actRes] = await Promise.all([
        MobileApiClient.fetchJson<{ lead: MobileLead }>(`/api/leads/${leadId}`),
        MobileApiClient.fetchJson<any[]>("/api/dispositions"),
        MobileApiClient.fetchJson<{ activities: ActivityItem[] }>(`/api/leads/${leadId}/activities`),
      ]);

      if (leadRes.data?.lead) {
        setLead(leadRes.data.lead);
      }
      if (Array.isArray(dispRes.data)) {
        setDispositions(dispRes.data);
      }
      if (Array.isArray(actRes.data?.activities)) {
        setActivities(actRes.data.activities);
      }
    } catch {
      Alert.alert("Error", "Could not load student profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLeadDetails();
  }, [fetchLeadDetails]);

  const handleStageChange = async (newStage: string) => {
    if (!lead || lead.status === newStage) return;
    const prevStage = lead.status;
    setLead({ ...lead, status: newStage });
    const { error } = await MobileApiClient.fetchJson(`/api/leads/${lead.id}/field`, {
      method: "PATCH",
      body: JSON.stringify({ field: "status", value: newStage }),
    });
    if (error) {
      setLead((curr) => (curr ? { ...curr, status: prevStage } : curr));
      Alert.alert("Update Failed", error.message);
    } else {
      fetchLeadDetails(true);
    }
  };

  const handleWhatsApp = () => {
    if (!lead?.id) return;
    setIsWhatsAppOpen(true);
  };

  if (loading || !lead) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Fetching student profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchLeadDetails(true);
            }}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(lead.name || "S").charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{lead.name || "Unnamed Student"}</Text>
          <Text style={styles.code}>{lead.lead_code}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.stageBadge}>
              <Text style={styles.stageText}>{lead.status}</Text>
            </View>
            {lead.disposition_name && (
              <View
                style={[
                  styles.dispBadge,
                  { backgroundColor: `${lead.disposition_color || Colors.primary}20` },
                ]}
              >
                <Text
                  style={[
                    styles.dispText,
                    { color: lead.disposition_color || Colors.primaryLight },
                  ]}
                >
                  {lead.disposition_name}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Inline Stage Switcher */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>LEAD STAGE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageChipsRow}>
            {STAGES.map((st) => {
              const active = lead.status === st;
              return (
                <TouchableOpacity
                  key={st}
                  onPress={() => handleStageChange(st)}
                  style={[styles.stageChip, active && styles.stageChipActive]}
                >
                  <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>
                    {st}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Academic Highlights right before Call Outcome & Rapid Logger */}
        <AcademicHighlightsCard rawAttributes={lead.raw_attributes} />

        {/* Call Outcome & Rapid Logger Trigger */}
        <TouchableOpacity
          onPress={() => {
            setCallDuration(0);
            setIsRapidLoggerOpen(true);
          }}
          style={styles.openLoggerBtn}
        >
          <Sparkles size={16} color="#fff" />
          <Text style={styles.openLoggerBtnText}>Call Outcome & Rapid Logger</Text>
        </TouchableOpacity>

        {/* Contact Information */}
        <View style={[styles.infoCard, { marginTop: 12 }]}>
          <Text style={styles.infoCardTitle}>CONTACT DETAILS</Text>

          {lead.phone && (
            <View style={styles.infoRow}>
              <PhoneCall size={14} color={Colors.textMuted} />
              <Text style={styles.infoText}>{lead.phone}</Text>
            </View>
          )}

          {lead.email && (
            <View style={styles.infoRow}>
              <Mail size={14} color={Colors.textMuted} />
              <Text style={styles.infoText}>{lead.email}</Text>
            </View>
          )}

          {lead.raw_attributes?.city && (
            <View style={styles.infoRow}>
              <MapPin size={14} color={Colors.textMuted} />
              <Text style={styles.infoText}>{String(lead.raw_attributes.city)}</Text>
            </View>
          )}
        </View>

        {/* Interaction Timeline */}
        <View style={styles.infoCard}>
          <View style={styles.timelineHeader}>
            <History size={14} color={Colors.primaryLight} />
            <Text style={[styles.infoCardTitle, { marginBottom: 0 }]}>
              INTERACTION TIMELINE ({activities.length})
            </Text>
          </View>

          {activities.length === 0 ? (
            <Text style={styles.emptyTimelineText}>No recorded calls or activities yet.</Text>
          ) : (
            activities.slice(0, 15).map((act) => (
              <View key={act.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>{act.title}</Text>
                  {act.description ? (
                    <Text style={styles.timelineDesc}>{act.description}</Text>
                  ) : null}
                  <Text style={styles.timelineMeta}>
                    {act.performed_by_name ? `${act.performed_by_name} • ` : ""}
                    {new Date(act.created_at).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Fixed Sticky Footer for Calling */}
      <View style={styles.stickyFooter}>
        {lead.phone ? (
          <TouchableOpacity
            onPress={() => startCall(lead.id, lead.name, lead.phone)}
            style={styles.callActionBtn}
          >
            <PhoneCall size={16} color="#fff" />
            <Text style={styles.callActionBtnText}>Call Student</Text>
          </TouchableOpacity>
        ) : null}

        {lead.phone ? (
          <TouchableOpacity onPress={handleWhatsApp} style={styles.whatsAppActionBtn}>
            <MessageSquare size={16} color="#10b981" />
            <Text style={styles.whatsAppActionBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Rapid Logger Modal */}
      <RapidLoggerModal
        visible={isRapidLoggerOpen}
        leadId={lead.id}
        studentName={lead.name}
        dispositions={dispositions}
        initialDurationSeconds={callDuration}
        onClose={() => {
          setIsRapidLoggerOpen(false);
          setCallDuration(0);
        }}
        onSuccess={(updatedLead) => {
          if (updatedLead?.id) {
            setLead((prev) => (prev ? { ...prev, ...updatedLead } : updatedLead));
          }
          // Silently refresh timeline in background without blocking
          MobileApiClient.fetchJson<{ activities: ActivityItem[] }>(
            `/api/leads/${lead.id}/activities`
          ).then(({ data }) => {
            if (Array.isArray(data?.activities)) {
              setActivities(data.activities);
            }
          });
        }}
      />

      <WhatsAppChatModal
        visible={isWhatsAppOpen}
        leadId={lead.id}
        leadName={lead.name}
        onClose={() => setIsWhatsAppOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
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
  profileCard: {
    backgroundColor: Colors.cardDark,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.primaryLight,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  code: {
    fontSize: 12,
    fontFamily: "monospace",
    color: Colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  stageBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  stageText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  dispBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dispText: {
    fontSize: 11,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: Colors.cardDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  stageChipsRow: {
    gap: 8,
  },
  stageChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stageChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryLight,
  },
  stageChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  stageChipTextActive: {
    color: Colors.primaryLight,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  openLoggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 2,
  },
  openLoggerBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  emptyTimelineText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  timelineItem: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 12,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryLight,
    marginTop: 5,
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  timelineDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  timelineMeta: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 14,
    backgroundColor: Colors.cardDark,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    gap: 10,
  },
  callActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  callActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  whatsAppActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.successMuted,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  whatsAppActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10b981",
  },
});
