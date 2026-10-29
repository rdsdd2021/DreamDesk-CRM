import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { MobileLead } from "../components/LeadCard";
import { AcademicHighlightsCard } from "../components/AcademicHighlightsCard";
import { RapidLoggerModal } from "../components/RapidLoggerModal";
import { PhoneCall, MessageSquare, Mail, MapPin, Sparkles, Clock } from "lucide-react-native";

export function LeadDetailScreen({ route, navigation }: any) {
  const { leadId } = route.params;
  const [lead, setLead] = useState<MobileLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispositions, setDispositions] = useState<any[]>([]);

  // Rapid Logger
  const [isRapidLoggerOpen, setIsRapidLoggerOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);
      const [leadRes, dispRes] = await Promise.all([
        MobileApiClient.fetchJson<{ lead: MobileLead }>(`/api/leads/${leadId}`),
        MobileApiClient.fetchJson<any[]>("/api/dispositions"),
      ]);

      if (leadRes.data?.lead) {
        setLead(leadRes.data.lead);
      }
      if (Array.isArray(dispRes.data)) {
        setDispositions(dispRes.data);
      }
    } catch {
      Alert.alert("Error", "Could not load student profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  const handleCall = async () => {
    if (!lead?.phone) return;
    try {
      const { data } = await MobileApiClient.fetchJson<{ dialUri: string }>(
        `/api/leads/${lead.id}/call-intent`,
        { method: "POST" }
      );
      const uri = data?.dialUri || `tel:${lead.phone}`;
      await Linking.openURL(uri);
      setTimeout(() => {
        setCallDuration(60);
        setIsRapidLoggerOpen(true);
      }, 1500);
    } catch {
      Alert.alert("Dial Error", "Could not trigger dialer");
    }
  };

  const handleWhatsApp = async () => {
    if (!lead?.id) return;
    try {
      const { data } = await MobileApiClient.fetchJson<{ launchUrl: string }>(
        `/api/leads/${lead.id}/whatsapp-intent`,
        { method: "POST" }
      );
      if (data?.launchUrl) {
        await Linking.openURL(data.launchUrl);
      }
    } catch {
      Alert.alert("WhatsApp Error", "Could not open WhatsApp");
    }
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        {/* Academic Highlights */}
        <AcademicHighlightsCard rawAttributes={lead.raw_attributes} />

        {/* Contact Information */}
        <View style={styles.infoCard}>
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

        {/* Action Logger Button */}
        <TouchableOpacity
          onPress={() => setIsRapidLoggerOpen(true)}
          style={styles.openLoggerBtn}
        >
          <Sparkles size={16} color="#fff" />
          <Text style={styles.openLoggerBtnText}>Log Call Outcome & Notes</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Fixed Sticky Footer for Calling */}
      <View style={styles.stickyFooter}>
        {lead.phone ? (
          <TouchableOpacity onPress={handleCall} style={styles.callActionBtn}>
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
        onSuccess={() => {
          fetchLeadDetails();
        }}
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
    paddingBottom: 90,
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
    paddingVertical: 13,
    gap: 8,
    marginTop: 4,
  },
  openLoggerBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
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
