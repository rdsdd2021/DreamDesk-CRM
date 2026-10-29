import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

// Screens
import { LoginScreen } from "../screens/LoginScreen";
import { QueueScreen } from "../screens/QueueScreen";
import { LeadsScreen } from "../screens/LeadsScreen";
import { TasksScreen } from "../screens/TasksScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { LeadDetailScreen } from "../screens/LeadDetailScreen";

// Icons
import { PhoneCall, Users, CalendarCheck, User } from "lucide-react-native";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
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
        name="Queue"
        component={QueueScreen}
        options={{
          title: "Dial Queue",
          tabBarIcon: ({ color, size }) => <PhoneCall size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="Leads"
        component={LeadsScreen}
        options={{
          title: "Leads",
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

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
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
