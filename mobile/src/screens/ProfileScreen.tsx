import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { MobileApiClient, DEFAULT_SERVER_URL } from "../api/mobileApiClient";
import { User, LogOut, Server, Shield, Sparkles } from "lucide-react-native";

export function ProfileScreen() {
  const { currentUser, logout } = useAuth();
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [isEditingServer, setIsEditingServer] = useState(false);

  useEffect(() => {
    MobileApiClient.getServerUrl().then((url) => setServerUrl(url));
  }, []);

  const handleSaveServer = async () => {
    if (!serverUrl.trim()) return;
    await MobileApiClient.setServerUrl(serverUrl.trim());
    setIsEditingServer(false);
    Alert.alert("Server Updated", `Backend set to: ${serverUrl}`);
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(currentUser?.name || "U").charAt(0)}</Text>
        </View>
        <Text style={styles.userName}>{currentUser?.name || "Staff Member"}</Text>
        <Text style={styles.userEmail}>{currentUser?.email}</Text>

        <View style={styles.roleBadge}>
          <Shield size={12} color={Colors.primaryLight} />
          <Text style={styles.roleText}>
            {(currentUser?.role || "Counselor").replace("_", " ").toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Backend Settings */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Server size={16} color={Colors.primaryLight} />
          <Text style={styles.sectionTitle}>SERVER CONNECTIVITY</Text>
        </View>

        <Text style={styles.serverLabel}>CURRENT ENDPOINT</Text>
        {isEditingServer ? (
          <View>
            <TextInput
              style={styles.serverInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={handleSaveServer} style={styles.saveServerBtn}>
              <Text style={styles.saveServerBtnText}>Save Server URL</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.serverRow}>
            <Text style={styles.serverUrlText} numberOfLines={1}>
              {serverUrl}
            </Text>
            <TouchableOpacity onPress={() => setIsEditingServer(true)} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* App Information */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Sparkles size={16} color={Colors.primaryLight} />
          <Text style={styles.sectionTitle}>ABOUT DREAMDESK MOBILE</Text>
        </View>
        <Text style={styles.aboutText}>
          DreamDesk Native Telecaller Suite v1.0.0{"\n"}
          Optimized for low-RAM devices, 60fps gesture rendering, and direct Android telephony integration.
        </Text>
      </View>

      {/* Logout Action */}
      <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.8}>
        <LogOut size={16} color={Colors.danger} />
        <Text style={styles.logoutBtnText}>Sign Out of Session</Text>
      </TouchableOpacity>
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
  profileCard: {
    backgroundColor: Colors.cardDark,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 20,
    alignItems: "center",
    marginBottom: 14,
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
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    marginTop: 10,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  sectionCard: {
    backgroundColor: Colors.cardDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  serverLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    marginBottom: 6,
  },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 10,
    borderRadius: 10,
  },
  serverUrlText: {
    fontSize: 12,
    fontFamily: "monospace",
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.cardBorder,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  serverInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: Colors.textPrimary,
    fontFamily: "monospace",
    marginBottom: 8,
  },
  saveServerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  saveServerBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  aboutText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dangerMuted,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.danger,
  },
});
