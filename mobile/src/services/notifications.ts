import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { MobileApiClient } from "../api/mobileApiClient";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let currentExpoPushToken: string | null = null;
const seenNotificationIds = new Set<number>();

export async function configureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
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

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    await configureAndroidNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    if (!Device.isDevice) {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    if (!projectId) {
      return null;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    if (token) {
      currentExpoPushToken = token;
      await MobileApiClient.fetchJson("/api/mobile/push-token", {
        method: "POST",
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          device_name: Device.modelName || Device.deviceName || "Android Device",
        }),
      });
      return token;
    }
  } catch {
    // Fallback cleanly to local notification polling
  }
  return null;
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    await MobileApiClient.fetchJson("/api/mobile/push-token", {
      method: "DELETE",
      body: JSON.stringify({ token: currentExpoPushToken || undefined }),
    });
  } catch {
    // ignore
  } finally {
    currentExpoPushToken = null;
    seenNotificationIds.clear();
  }
}

export async function syncLocalNotificationsFallback(): Promise<void> {
  try {
    await configureAndroidNotificationChannel();

    const { data } = await MobileApiClient.fetchJson<{
      notifications?: Array<{
        id: number;
        title: string;
        message: string;
        is_read: number;
        type?: string;
        broadcast_id?: number | null;
        responded_at?: string | null;
        action_buttons?: Array<{ id: string; label: string }>;
        metadata?: any;
      }>;
    }>("/api/notifications?limit=15");

    const list = data?.notifications || [];
    if (list.length === 0) return;

    const isFirstSync = seenNotificationIds.size === 0;

    for (const item of list) {
      if (seenNotificationIds.has(item.id)) continue;
      seenNotificationIds.add(item.id);

      const isUnrespondedBroadcast = item.type === "broadcast" && !item.responded_at;
      if (isFirstSync && !isUnrespondedBroadcast) continue;
      if (!isFirstSync && item.is_read && !isUnrespondedBroadcast) continue;

      let parsedMeta: Record<string, any> = {};
      try {
        parsedMeta =
          typeof item.metadata === "string"
            ? JSON.parse(item.metadata)
            : item.metadata || {};
      } catch {
        // ignore
      }

      const broadcastId = item.broadcast_id || parsedMeta.broadcast_id || null;
      const buttons = item.action_buttons || parsedMeta.action_buttons || [];
      let categoryIdentifier: string | undefined = undefined;

      if (broadcastId && Array.isArray(buttons) && buttons.length > 0) {
        categoryIdentifier = `broadcast_${broadcastId}`;
        await Notifications.setNotificationCategoryAsync(
          categoryIdentifier,
          buttons.slice(0, 3).map((btn: any) => ({
            identifier: String(btn.id),
            buttonTitle: String(btn.label),
            options: { opensAppToForeground: false },
          }))
        );
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.message,
          sound: "default",
          categoryIdentifier,
          data: {
            type: item.type || "task",
            screen: parsedMeta.lead_id ? "LeadDetail" : "Tasks",
            lead_id: parsedMeta.lead_id,
            broadcast_id: broadcastId,
          },
        },
        trigger:
          Platform.OS === "android"
            ? ({ channelId: "dreamdesk-alerts" } as any)
            : null,
      });
    }
  } catch {
    // ignore transient polling errors
  }
}
