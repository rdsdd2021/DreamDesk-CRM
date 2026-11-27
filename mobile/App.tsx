import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView, WebViewNavigation } from "react-native-webview";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

const CRM_URL = "https://dreamdesk.assistt.in";
const CRM_HOST = "dreamdesk.assistt.in";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("dreamdesk-alerts", {
        name: "DreamDesk CRM Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4f46e5",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted" || !Device.isDevice) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;
    if (!projectId) return null;

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenRes.data || null;
  } catch {
    return null;
  }
}

function DreamDeskWebShell() {
  const webViewRef = useRef<any>(null);
  const WebViewComponent = WebView as unknown as React.ComponentType<any>;
  const [canGoBack, setCanGoBack] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(CRM_URL);
  const tokenRegisteredRef = useRef(false);

  useEffect(() => {
    setupPushToken().then((token) => {
      if (token) setPushToken(token);
    });
  }, []);

  // Android hardware back button navigates within the WebView first
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [canGoBack]);

  // Handle notification taps & Android notification-bar action buttons
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as any;
      const actionId = response.actionIdentifier;

      if (
        actionId &&
        actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER &&
        data?.broadcast_id
      ) {
        const js = `
          (function() {
            try {
              fetch('/api/broadcasts/' + ${JSON.stringify(String(data.broadcast_id))} + '/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_id: ${JSON.stringify(String(actionId))} })
              }).catch(function(){});
            } catch (e) {}
          })();
          true;
        `;
        webViewRef.current?.injectJavaScript(js);
        try {
          await Notifications.dismissNotificationAsync(response.notification.request.identifier);
        } catch {
          // ignore
        }
        return;
      }

      if (data?.lead_id) {
        const target = `${CRM_URL}/?leadId=${encodeURIComponent(String(data.lead_id))}`;
        webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(target)}; true;`);
      }
    });
    return () => sub.remove();
  }, []);

  const registerTokenInWebView = useCallback(
    (url: string) => {
      if (!pushToken || tokenRegisteredRef.current) return;
      if (!url.includes(CRM_HOST) || url.includes("/login")) return;

      const deviceName = Device.modelName || Device.deviceName || "Android Device";
      const js = `
        (function() {
          try {
            if (window.__dreamdeskPushSent) return;
            window.__dreamdeskPushSent = true;
            fetch('/api/mobile/push-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: ${JSON.stringify(pushToken)},
                platform: ${JSON.stringify(Platform.OS)},
                device_name: ${JSON.stringify(deviceName)}
              })
            }).catch(function() { window.__dreamdeskPushSent = false; });
          } catch (e) {}
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
      tokenRegisteredRef.current = true;
    },
    [pushToken]
  );

  useEffect(() => {
    if (pushToken && currentUrl) {
      registerTokenInWebView(currentUrl);
    }
  }, [pushToken, currentUrl, registerTokenInWebView]);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (navState.url) {
      setCurrentUrl(navState.url);
      if (navState.url.includes("/login")) {
        tokenRegisteredRef.current = false;
      } else {
        registerTokenInWebView(navState.url);
      }
    }
  };

  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    const { url } = request;
    if (!url) return false;

    // Allow internal CRM navigation and about:blank / blob / data URLs
    if (
      url.startsWith("about:") ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    ) {
      return true;
    }

    // Open dialer, mail, SMS, WhatsApp, or external domains in native Android apps
    const isExternalScheme =
      url.startsWith("tel:") ||
      url.startsWith("mailto:") ||
      url.startsWith("sms:") ||
      url.startsWith("whatsapp:") ||
      url.startsWith("intent:");

    if (isExternalScheme) {
      Linking.openURL(url).catch(() => {});
      return false;
    }

    try {
      const parsed = new URL(url);
      if (parsed.hostname && parsed.hostname !== CRM_HOST && !parsed.hostname.endsWith(`.${CRM_HOST}`)) {
        Linking.openURL(url).catch(() => {});
        return false;
      }
    } catch {
      return true;
    }

    return true;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <WebViewComponent
        ref={webViewRef}
        source={{ uri: CRM_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowFileAccess
        pullToRefreshEnabled
        allowsBackForwardNavigationGestures
        mediaPlaybackRequiresUserAction={false}
        onLoadEnd={() => {
          setInitialLoading(false);
          setHasError(false);
          registerTokenInWebView(currentUrl);
        }}
        onError={() => {
          setInitialLoading(false);
          setHasError(true);
        }}
        onHttpError={(e: any) => {
          if (e.nativeEvent.statusCode >= 500) {
            setInitialLoading(false);
          }
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
      />

      {initialLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading DreamDesk CRM...</Text>
        </View>
      )}

      {hasError && (
        <View style={styles.overlay}>
          <Text style={styles.errorTitle}>Unable to Connect</Text>
          <Text style={styles.errorSubtitle}>
            Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              setInitialLoading(true);
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DreamDeskWebShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  webview: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#09090b",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "500",
  },
  errorTitle: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorSubtitle: {
    color: "#a1a1aa",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
