import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from "react-native";
import { Colors } from "../theme/colors";
import { PhoneCall, MessageSquare, ChevronRight, Clock, School } from "lucide-react-native";

export interface MobileLead {
  id: number;
  lead_code: string;
  name: string;
  phone?: string;
  email?: string;
  status: string;
  disposition_name?: string;
  disposition_color?: string;
  campaign_name?: string;
  attempt_count?: number;
  callback_at?: string;
  cooldown_until?: string;
  raw_attributes?: Record<string, any>;
}

interface LeadCardProps {
  lead: MobileLead;
  onPress: () => void;
  onPressCall: (lead: MobileLead) => void;
  onPressWhatsApp: (lead: MobileLead) => void;
}

export function LeadCard({ lead, onPress, onPressCall, onPressWhatsApp }: LeadCardProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "new":
        return { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa" };
      case "contacted":
        return { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24" };
      case "interested":
        return { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399" };
      case "admitted":
        return { bg: "rgba(139, 92, 246, 0.15)", text: "#a78bfa" };
      case "unreachable":
        return { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171" };
      default:
        return { bg: "rgba(255, 255, 255, 0.08)", text: Colors.textSecondary };
    }
  };

  const statusStyle = getStatusColor(lead.status);
  const stream = lead.raw_attributes?.stream;
  const school = lead.raw_attributes?.school;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
      {/* Top Row: Name, Code, Stage */}
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(lead.name || "S").charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {lead.name || "Unnamed Student"}
            </Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{lead.lead_code}</Text>
            </View>
          </View>

          {/* Academic Sub-line */}
          {(stream || school) && (
            <View style={styles.academicRow}>
              {stream ? <Text style={styles.streamText}>{String(stream)}</Text> : null}
              {stream && school ? <Text style={styles.dot}>•</Text> : null}
              {school ? (
                <Text style={styles.schoolText} numberOfLines={1}>
                  {String(school)}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{lead.status}</Text>
        </View>
      </View>

      {/* Middle Row: Call Disposition & Callback Pill */}
      <View style={styles.midRow}>
        {lead.disposition_name ? (
          <View
            style={[
              styles.dispPill,
              {
                backgroundColor: `${lead.disposition_color || Colors.primary}20`,
                borderColor: `${lead.disposition_color || Colors.primary}40`,
              },
            ]}
          >
            <View
              style={[
                styles.dispDot,
                { backgroundColor: lead.disposition_color || Colors.primary },
              ]}
            />
            <Text
              style={[
                styles.dispPillText,
                { color: lead.disposition_color || Colors.primaryLight },
              ]}
              numberOfLines={1}
            >
              {lead.disposition_name}
            </Text>
          </View>
        ) : (
          <Text style={styles.uncontactedText}>Uncontacted</Text>
        )}

        {lead.attempt_count && lead.attempt_count > 0 ? (
          <View style={styles.attemptBadge}>
            <Text style={styles.attemptText}>Att #{lead.attempt_count}/3</Text>
          </View>
        ) : null}

        {lead.callback_at ? (
          <View style={styles.callbackPill}>
            <Clock size={11} color={Colors.warning} />
            <Text style={styles.callbackText}>
              {new Date(lead.callback_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom Actions Row */}
      <View style={styles.bottomRow}>
        <View style={styles.phoneBlock}>
          <Text style={styles.phoneText}>{lead.phone || "No phone"}</Text>
        </View>

        <View style={styles.actionButtons}>
          {lead.phone ? (
            <TouchableOpacity
              onPress={() => onPressCall(lead)}
              style={styles.callButton}
              activeOpacity={0.8}
            >
              <PhoneCall size={13} color="#fff" />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          ) : null}

          {lead.phone ? (
            <TouchableOpacity
              onPress={() => onPressWhatsApp(lead)}
              style={styles.whatsAppButton}
              activeOpacity={0.8}
            >
              <MessageSquare size={13} color="#10b981" />
            </TouchableOpacity>
          ) : null}

          <View style={styles.detailChevron}>
            <ChevronRight size={16} color={Colors.textMuted} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 13,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nameText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  codeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  codeText: {
    fontSize: 9,
    fontFamily: "monospace",
    color: Colors.textMuted,
  },
  academicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  streamText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  dot: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  schoolText: {
    fontSize: 10,
    color: Colors.textMuted,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  midRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 9,
    flexWrap: "wrap",
  },
  dispPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  dispDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dispPillText: {
    fontSize: 10,
    fontWeight: "600",
  },
  uncontactedText: {
    fontSize: 10,
    fontStyle: "italic",
    color: Colors.textMuted,
  },
  attemptBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  attemptText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.warning,
    fontFamily: "monospace",
  },
  callbackPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  callbackText: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.warning,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 8,
  },
  phoneBlock: {
    flex: 1,
  },
  phoneText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  callButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  whatsAppButton: {
    backgroundColor: Colors.successMuted,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  detailChevron: {
    paddingLeft: 2,
  },
});
