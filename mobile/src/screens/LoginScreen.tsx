import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { MobileApiClient, DEFAULT_SERVER_URL } from "../api/mobileApiClient";
import { ShieldCheck, Server, Lock, Mail } from "lucide-react-native";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [showServerConfig, setShowServerConfig] = useState(false);

  React.useEffect(() => {
    MobileApiClient.getServerUrl().then((url) => setServerUrl(url));
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      if (serverUrl !== DEFAULT_SERVER_URL) {
        await MobileApiClient.setServerUrl(serverUrl);
      }
      const res = await login(email.trim(), password);
      if (!res.success) {
        Alert.alert("Login Failed", res.error || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <ShieldCheck size={36} color="#fff" />
          </View>
          <Text style={styles.brandTitle}>DreamDesk CRM</Text>
          <Text style={styles.brandSubtitle}>Admissions Outreach & Telephony Suite</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Staff Sign In</Text>

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <Mail size={16} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Official Staff Email"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <Lock size={16} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Account Password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In to Workspace</Text>
            )}
          </TouchableOpacity>

          {/* Server Config Accordion Toggle */}
          <TouchableOpacity
            onPress={() => setShowServerConfig(!showServerConfig)}
            style={styles.serverToggle}
          >
            <Server size={12} color={Colors.textMuted} />
            <Text style={styles.serverToggleText}>
              {showServerConfig ? "Hide Server URL" : "Configure Backend Server"}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverConfigBox}>
              <Text style={styles.serverBoxLabel}>API HOST URL</Text>
              <TextInput
                style={styles.serverInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
              />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.cardDark,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  serverToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  serverToggleText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  serverConfigBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  serverBoxLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    marginBottom: 4,
  },
  serverInput: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Colors.textSecondary,
  },
});
