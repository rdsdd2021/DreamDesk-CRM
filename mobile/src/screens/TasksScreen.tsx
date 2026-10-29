import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { Clock, CheckCircle2, PhoneCall, AlertTriangle, Calendar } from "lucide-react-native";

export interface MobileTask {
  id: number;
  lead_id: number;
  lead_name?: string;
  lead_code?: string;
  lead_phone?: string;
  title: string;
  due_date: string;
  is_completed: number;
  priority: "high" | "medium" | "low";
  notes?: string;
}

export function TasksScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "today" | "completed">("today");

  const loadTasks = useCallback(async (isPull = false) => {
    try {
      if (!isPull) setLoading(true);
      const { data } = await MobileApiClient.fetchJson<{ tasks: MobileTask[] }>("/api/tasks");
      if (Array.isArray(data?.tasks)) {
        setTasks(data.tasks);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggleComplete = async (task: MobileTask) => {
    try {
      const nextVal = task.is_completed ? 0 : 1;
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_completed: nextVal } : t))
      );
      await MobileApiClient.fetchJson(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_completed: nextVal }),
      });
    } catch {
      loadTasks();
    }
  };

  const handleCallStudent = (phone?: string) => {
    if (!phone) {
      Alert.alert("No Phone", "No phone number available for this task lead.");
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === "completed") return Boolean(t.is_completed);
    if (t.is_completed) return false;

    const taskDate = t.due_date ? t.due_date.split("T")[0] : "";
    if (activeTab === "today") return taskDate === todayStr;
    if (activeTab === "pending") return taskDate < todayStr || !t.due_date;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab("today")}
          style={[styles.tabBtn, activeTab === "today" && styles.tabBtnActive]}
        >
          <Clock size={13} color={activeTab === "today" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === "today" && styles.tabTextActive]}>
            Today's Callbacks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("pending")}
          style={[styles.tabBtn, activeTab === "pending" && styles.tabBtnActive]}
        >
          <AlertTriangle
            size={13}
            color={activeTab === "pending" ? "#fff" : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === "pending" && styles.tabTextActive]}>
            Overdue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("completed")}
          style={[styles.tabBtn, activeTab === "completed" && styles.tabBtnActive]}
        >
          <CheckCircle2
            size={13}
            color={activeTab === "completed" ? "#fff" : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === "completed" && styles.tabTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading task schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadTasks(true);
              }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Calendar size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No tasks in this agenda</Text>
              <Text style={styles.emptySubtitle}>You are all caught up with your callbacks.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.taskCard}>
              <View style={styles.cardHeader}>
                <TouchableOpacity
                  onPress={() => handleToggleComplete(item)}
                  style={styles.checkCircle}
                >
                  {item.is_completed ? (
                    <CheckCircle2 size={20} color={Colors.success} />
                  ) : (
                    <View style={styles.uncheckCircle} />
                  )}
                </TouchableOpacity>

                <View style={styles.taskTitleBlock}>
                  <Text
                    style={[
                      styles.taskTitle,
                      item.is_completed ? styles.taskTitleDone : undefined,
                    ]}
                  >
                    {item.title}
                  </Text>
                  {item.lead_name && (
                    <Text style={styles.studentSub}>
                      Student: <Text style={styles.bold}>{item.lead_name}</Text> ({item.lead_code})
                    </Text>
                  )}
                </View>

                {item.priority === "high" && (
                  <View style={styles.highPriorityBadge}>
                    <Text style={styles.highPriorityText}>Urgent</Text>
                  </View>
                )}
              </View>

              {/* Due Date & Call Action */}
              <View style={styles.cardFooter}>
                <View style={styles.dueDateRow}>
                  <Clock size={12} color={Colors.textMuted} />
                  <Text style={styles.dueDateText}>
                    {item.due_date
                      ? new Date(item.due_date).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "No due date"}
                  </Text>
                </View>

                {item.lead_phone && !item.is_completed && (
                  <TouchableOpacity
                    onPress={() => handleCallStudent(item.lead_phone)}
                    style={styles.quickCallBtn}
                  >
                    <PhoneCall size={12} color="#fff" />
                    <Text style={styles.quickCallText}>Call Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardDark,
    borderRadius: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  taskCard: {
    backgroundColor: Colors.cardDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkCircle: {
    marginRight: 10,
    marginTop: 2,
  },
  uncheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.cardBorderHover,
  },
  taskTitleBlock: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: Colors.textMuted,
  },
  studentSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  bold: {
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  highPriorityBadge: {
    backgroundColor: Colors.dangerMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  highPriorityText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.danger,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  dueDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dueDateText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  quickCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickCallText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
