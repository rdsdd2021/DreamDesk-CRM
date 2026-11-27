import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { MobileApiClient } from "../api/mobileApiClient";

// Screens
import { LoginScreen } from "../screens/LoginScreen";
import { LeadsScreen } from "../screens/LeadsScreen";
import { TasksScreen } from "../screens/TasksScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { LeadDetailScreen } from "../screens/LeadDetailScreen";

// Icons
import { Users, CalendarCheck, User } from "lucide-react-native";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Leads"
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.backgroundDark,
          borderBottomWidth: 1,
          borderBottomColor: Colors.cardBorder,
        },
        headerTitleStyle: {
          color: Colors.textPrimary,
          fontSize: 16,
          fontWeight: "700",
        },
        headerTintColor: Colors.textPrimary,
        tabBarStyle: {
          backgroundColor: Colors.cardDark,
          borderTopColor: Colors.cardBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.primaryLight,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="Leads"
        component={LeadsScreen}
        options={{
          title: "My Leads",
          tabBarIcon: ({ color, size }) => <Users size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size - 2} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export const navigationRef = createNavigationContainerRef<any>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as any;
      const actionId = response.actionIdentifier;

      // Handle direct Android notification-bar action button tap (e.g., Acknowledge)
      if (
        actionId &&
        actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER &&
        data?.broadcast_id
      ) {
        try {
          await MobileApiClient.fetchJson(`/api/broadcasts/${data.broadcast_id}/respond`, {
            method: "POST",
            body: JSON.stringify({ action_id: actionId }),
          });
          await Notifications.dismissNotificationAsync(
            response.notification.request.identifier
          );
        } catch {
          // ignore
        }
        return;
      }

      if (!navigationRef.isReady() || !isAuthenticated) return;
      if (data?.lead_id) {
        navigationRef.navigate("LeadDetail", { leadId: Number(data.lead_id) });
      } else if (data?.screen === "Tasks" || data?.type === "broadcast") {
        navigationRef.navigate("Main", { screen: "Tasks" });
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.backgroundDark,
          },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: {
            color: Colors.textPrimary,
            fontSize: 16,
            fontWeight: "700",
          },
          contentStyle: {
            backgroundColor: Colors.backgroundDark,
          },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LeadDetail"
              component={LeadDetailScreen}
              options={{ title: "Student Profile" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
  },
});
