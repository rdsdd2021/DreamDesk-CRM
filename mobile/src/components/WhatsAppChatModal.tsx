import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { X, Send, MessageSquare } from "lucide-react-native";

interface WhatsAppChatModalProps {
  visible: boolean;
  leadId: number | null;
  leadName?: string;
  onClose: () => void;
}

export function WhatsAppChatModal({
  visible,
  leadId,
  leadName,
  onClose,
}: WhatsAppChatModalProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");

  const loadConversation = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const { data, error } = await MobileApiClient.fetchJson<{
        conversation?: { id: number };
        messages?: any[];
      }>(`/api/whatsapp/conversations?lead_id=${leadId}`);
      if (!error && data) {
        setConversationId(data.conversation?.id || null);
        setMessages(data.messages || []);
      }
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (visible && leadId) {
      loadConversation();
    } else {
      setMessages([]);
      setText("");
      setConversationId(null);
    }
  }, [visible, leadId, loadConversation]);

  const handleSend = async () => {
    if (!leadId || !text.trim()) return;
    setSending(true);
    try {
      const { data, error } = await MobileApiClient.fetchJson<{ message?: any; conversation?: any }>(
        "/api/whatsapp/send",
        {
          method: "POST",
          body: JSON.stringify({
            lead_id: leadId,
            conversation_id: conversationId || undefined,
            message_type: "text",
            body: text.trim(),
          }),
        }
      );
      if (error) {
        Alert.alert("WhatsApp Error", error.message);
        return;
      }
      setText("");
      if (data?.conversation?.id) setConversationId(data.conversation.id);
      if (data?.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MessageSquare size={18} color="#10b981" />
              <Text style={styles.title} numberOfLines={1}>
                WhatsApp · {leadName || `Lead #${leadId}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#10b981" />
              <Text style={styles.emptyText}>Loading Kapso chat...</Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>
                    No messages yet. Send an integrated WhatsApp message below.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isOutbound = item.direction === "outbound";
                return (
                  <View style={[styles.bubble, isOutbound ? styles.bubbleOut : styles.bubbleIn]}>
                    <Text style={styles.bubbleText}>{item.body}</Text>
                    <Text style={styles.bubbleMeta}>
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isOutbound ? ` · ${item.status}` : ""}
                    </Text>
                  </View>
                );
              }}
            />
          )}

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Message via Kapso WhatsApp..."
              placeholderTextColor={Colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={sending || !text.trim()}
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.backgroundDark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: "78%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  listContent: {
    padding: 14,
    gap: 10,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  bubbleOut: {
    alignSelf: "flex-end",
    backgroundColor: "#059669",
  },
  bubbleIn: {
    alignSelf: "flex-start",
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  bubbleText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    textAlign: "right",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    backgroundColor: Colors.cardDark,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: 13,
    maxHeight: 90,
  },
  sendBtn: {
    backgroundColor: "#059669",
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
