import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Linking, Alert } from "react-native";
import { MobileApiClient } from "../api/mobileApiClient";

interface CallSession {
  leadId: number;
  leadName: string;
  startTime: number;
}

/**
 * Tracks outgoing phone dialer launches via AppState so that when the counselor
 * returns from the native phone app, we compute the exact elapsed call duration
 * and immediately open the Rapid Outcome Logger.
 */
export function useCallTracker(
  onCallEnded: (leadId: number, leadName: string, durationSeconds: number) => void
) {
  const activeCallRef = useRef<CallSession | null>(null);
  const appStateRef = useRef<string>(AppState.currentState || "active");
  const callbackRef = useRef(onCallEnded);
  callbackRef.current = onCallEnded;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // User returned to DreamDesk from background (dialer/call screen)
      if (
        (prevState === "background" || prevState === "inactive") &&
        nextState === "active" &&
        activeCallRef.current
      ) {
        const session = activeCallRef.current;
        activeCallRef.current = null;
        const elapsedSec = Math.max(1, Math.round((Date.now() - session.startTime) / 1000));
        callbackRef.current(session.leadId, session.leadName, elapsedSec);
      }
    });

    return () => subscription.remove();
  }, []);

  const startCall = async (leadId: number, leadName: string, fallbackPhone?: string) => {
    try {
      const { data } = await MobileApiClient.fetchJson<{ dialUri: string }>(
        `/api/leads/${leadId}/call-intent`,
        { method: "POST" }
      );
      const dialTarget = data?.dialUri || (fallbackPhone ? `tel:${fallbackPhone}` : null);
      if (!dialTarget) {
        Alert.alert("No Phone", "No phone number is available for this student.");
        return;
      }

      activeCallRef.current = {
        leadId,
        leadName,
        startTime: Date.now(),
      };
      await Linking.openURL(dialTarget);
    } catch {
      activeCallRef.current = null;
      Alert.alert("Dialer Error", "Could not open the device phone dialer.");
    }
  };

  return { startCall };
}
