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
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { MobileCache } from "../utils/cache";
import {
  Clock,
  CheckCircle2,
  PhoneCall,
  AlertTriangle,
  Calendar,
  Repeat,
  Timer,
  Link2,
  BellRing,
  Plus,
  X,
} from "lucide-react-native";

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

export interface MobileWorkTask {
  id: number;
  title: string;
  description?: string | null;
  task_type: "one_time" | "recurring" | "timed";
  recurrence_rule?: "daily" | "weekdays" | "weekly" | "monthly" | null;
  time_limit_minutes?: number | null;
  started_at?: string | null;
  due_at?: string | null;
  status: "todo" | "in_progress" | "done";
  progress_pct: number;
  assigned_user_name?: string | null;
  depends_on?: {
    id: number;
    title: string;
    status: string;
    assigned_user_name?: string | null;
  } | null;
  is_blocked?: boolean;
  completion_count?: number;
}

export function TasksScreen({ navigation }: any) {
  const [taskMode, setTaskMode] = useState<"calling" | "work">("calling");

  // Calling tasks state
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "today" | "completed">("today");

  // Work tasks state
  const [workTasks, setWorkTasks] = useState<MobileWorkTask[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Broadcast alerts state
  const [broadcastAlerts, setBroadcastAlerts] = useState<any[]>([]);
  const [respondingBroadcastKey, setRespondingBroadcastKey] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"one_time" | "recurring" | "timed">("one_time");
  const [newTimeLimit, setNewTimeLimit] = useState("30");
  const [creating, setCreating] = useState(false);

  const loadTasks = useCallback(async (isPull = false) => {
    try {
      if (!isPull && tasks.length === 0) setLoading(true);
      const { data } = await MobileApiClient.fetchJson<{
        tasks?: MobileTask[];
        overdue?: any[];
        today?: any[];
        upcoming?: any[];
        completed?: any[];
      }>("/api/tasks");

      const normalize = (t: any, completedFlag?: boolean): MobileTask => ({
        ...t,
        is_completed:
          completedFlag !== undefined
            ? completedFlag
              ? 1
              : 0
            : t.status === "completed" || Boolean(t.is_completed)
            ? 1
            : 0,
      });

      let merged: MobileTask[] = [];
      if (Array.isArray(data?.tasks)) {
        merged = data.tasks.map((t) => normalize(t));
      } else if (data) {
        const seen = new Set<number>();
        const pushList = (arr: any[] | undefined, done: boolean) => {
          for (const item of arr || []) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(normalize(item, done));
            }
          }
        };
        pushList(data.overdue, false);
        pushList(data.today, false);
        pushList(data.upcoming, false);
        pushList(data.completed, true);
      }

      setTasks(merged);
      MobileCache.set("tasks_list", merged);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadWorkTasks = useCallback(async (isPull = false) => {
    try {
      if (!isPull && workTasks.length === 0) setWorkLoading(true);
      const { data } = await MobileApiClient.fetchJson<{ tasks: MobileWorkTask[] }>("/api/work-tasks");
      if (Array.isArray(data?.tasks)) {
        setWorkTasks(data.tasks);
        MobileCache.set("work_tasks_list", data.tasks);
      }
    } catch {
      // ignore
    } finally {
      setWorkLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadBroadcastAlerts = useCallback(async () => {
    try {
      const { data } = await MobileApiClient.fetchJson<{ notifications?: any[] }>(
        "/api/notifications?limit=15"
      );
      const alerts = (data?.notifications || []).filter(
        (n) => n.type === "broadcast" && n.broadcast_id && !n.responded_at && Array.isArray(n.action_buttons) && n.action_buttons.length > 0
      );
      setBroadcastAlerts(alerts);
    } catch {
      // ignore
    }
  }, []);

  const handleRespondBroadcast = async (alertItem: any, actionId: string) => {
    const key = `${alertItem.broadcast_id}:${actionId}`;
    setRespondingBroadcastKey(key);
    try {
      const { error } = await MobileApiClient.fetchJson(
        `/api/broadcasts/${alertItem.broadcast_id}/respond`,
        {
          method: "POST",
          body: JSON.stringify({ action_id: actionId }),
        }
      );
      if (!error) {
        setBroadcastAlerts((prev) =>
          prev.filter((a) => a.broadcast_id !== alertItem.broadcast_id)
        );
      }
    } finally {
      setRespondingBroadcastKey(null);
    }
  };

  useEffect(() => {
    MobileCache.get<MobileTask[]>("tasks_list").then((cached) => {
      if (cached && cached.length > 0) {
        setTasks(cached);
        setLoading(false);
      }
    });
    MobileCache.get<MobileWorkTask[]>("work_tasks_list").then((cached) => {
      if (cached && cached.length > 0) {
        setWorkTasks(cached);
      }
    });
    loadTasks();
    loadWorkTasks();
    loadBroadcastAlerts();
  }, [loadTasks, loadWorkTasks, loadBroadcastAlerts]);

  const handleToggleComplete = async (task: MobileTask) => {
    const nextVal = task.is_completed ? 0 : 1;
    const nextStatus = nextVal ? "completed" : "pending";
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_completed: nextVal } : t))
      );
      const { error } = await MobileApiClient.fetchJson(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (error) {
        throw new Error(error.message);
      }
    } catch {
      loadTasks(true);
    }
  };

  const handlePatchWorkTask = async (taskId: number, payload: Record<string, any>) => {
    // Instant optimistic UI update for 0ms responsiveness
    if (!payload.remind_dependency) {
      setWorkTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const nextStatus =
            payload.status ??
            (payload.progress_pct >= 100
              ? "done"
              : payload.progress_pct > 0 && t.status === "todo"
              ? "in_progress"
              : t.status);
          const nextPct =
            payload.progress_pct !== undefined
              ? payload.progress_pct
              : payload.status === "done"
              ? 100
              : payload.status === "todo"
              ? 0
              : t.progress_pct;
          return { ...t, status: nextStatus, progress_pct: nextPct };
        })
      );
    }

    const { data, error } = await MobileApiClient.fetchJson<{ task: MobileWorkTask }>(
      `/api/work-tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
    if (error) {
      Alert.alert("Update Failed", error.message);
      loadWorkTasks(true);
      return;
    }
    if (data?.task) {
      setWorkTasks((prev) => {
        const next = prev.map((t) => (t.id === taskId ? data.task : t));
        MobileCache.set("work_tasks_list", next);
        return next;
      });
    }
    if (payload.remind_dependency) {
      Alert.alert("Reminder Sent", "The linked task owner has been notified.");
    }
  };

  const handleCreateWorkTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Title Required", "Please enter a task title.");
      return;
    }
    try {
      setCreating(true);
      const { data, error } = await MobileApiClient.fetchJson<{ task: MobileWorkTask }>(
        "/api/work-tasks",
        {
          method: "POST",
          body: JSON.stringify({
            title: newTitle.trim(),
            task_type: newType,
            recurrence_rule: newType === "recurring" ? "daily" : null,
            time_limit_minutes: newType === "timed" ? parseInt(newTimeLimit, 10) || 30 : null,
          }),
        }
      );
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      if (data?.task) {
        setWorkTasks((prev) => [data.task, ...prev]);
      }
      setNewTitle("");
      setIsCreateOpen(false);
    } finally {
      setCreating(false);
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
      {/* Top Mode Switcher: Call Tasks vs Work Tasks */}
      <View style={styles.modeBar}>
        <TouchableOpacity
          onPress={() => setTaskMode("calling")}
          style={[styles.modeBtn, taskMode === "calling" && styles.modeBtnActive]}
        >
          <PhoneCall size={13} color={taskMode === "calling" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.modeText, taskMode === "calling" && styles.modeTextActive]}>
            Call Tasks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTaskMode("work")}
          style={[styles.modeBtn, taskMode === "work" && styles.modeBtnActive]}
        >
          <Repeat size={13} color={taskMode === "work" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.modeText, taskMode === "work" && styles.modeTextActive]}>
            Daily & Work Tasks
          </Text>
        </TouchableOpacity>

        {taskMode === "work" && (
          <TouchableOpacity onPress={() => setIsCreateOpen(true)} style={styles.addBtn}>
            <Plus size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {taskMode === "calling" ? (
        <>
          {/* Calling Sub-Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              onPress={() => setActiveTab("today")}
              style={[styles.tabBtn, activeTab === "today" && styles.tabBtnActive]}
            >
              <Clock size={13} color={activeTab === "today" ? "#fff" : Colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === "today" && styles.tabTextActive]}>
                Today
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
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {broadcastAlerts.length > 0 && (
            <View style={styles.broadcastBannerWrap}>
              {broadcastAlerts.slice(0, 3).map((b) => (
                <View key={b.id} style={styles.broadcastCard}>
                  <View style={styles.broadcastHeader}>
                    <BellRing size={14} color={Colors.primaryLight} />
                    <Text style={styles.broadcastTitle} numberOfLines={1}>
                      {b.title}
                    </Text>
                  </View>
                  <Text style={styles.broadcastBody} numberOfLines={3}>
                    {b.message}
                  </Text>
                  <View style={styles.broadcastActions}>
                    {(b.action_buttons || []).map((btn: any) => {
                      const key = `${b.broadcast_id}:${btn.id}`;
                      return (
                        <TouchableOpacity
                          key={btn.id}
                          disabled={respondingBroadcastKey !== null}
                          onPress={() => handleRespondBroadcast(b, btn.id)}
                          style={styles.broadcastActionBtn}
                        >
                          <Text style={styles.broadcastActionText}>
                            {respondingBroadcastKey === key ? "Saving..." : btn.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          {loading && tasks.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading call schedule...</Text>
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
                  <Text style={styles.emptyTitle}>No call tasks in this tab</Text>
                  <Text style={styles.emptySubtitle}>You are caught up with callbacks.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    if (item.lead_id) navigation.navigate("LeadDetail", { leadId: item.lead_id });
                  }}
                  style={styles.taskCard}
                >
                  <View style={styles.cardHeader}>
                    <TouchableOpacity
                      onPress={() => handleToggleComplete(item)}
                      style={styles.checkCircle}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                  </View>

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
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : workLoading && workTasks.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading work tasks...</Text>
        </View>
      ) : (
        <FlatList
          data={workTasks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadWorkTasks(true);
              }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Repeat size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No daily or team tasks</Text>
              <Text style={styles.emptySubtitle}>Tap + above to create a task.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isDone = item.status === "done";
            return (
              <View style={[styles.taskCard, isDone && styles.taskCardDone]}>
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    onPress={() =>
                      handlePatchWorkTask(item.id, { status: isDone ? "todo" : "done" })
                    }
                    style={styles.checkCircle}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={22} color={Colors.success} />
                    ) : (
                      <View style={styles.uncheckCircle} />
                    )}
                  </TouchableOpacity>

                  <View style={styles.taskTitleBlock}>
                    <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
                      {item.title}
                    </Text>

                    <View style={styles.badgeRow}>
                      {item.task_type === "recurring" && (
                        <View style={styles.typePill}>
                          <Repeat size={10} color={Colors.primaryLight} />
                          <Text style={styles.typePillText}>
                            {item.recurrence_rule || "daily"}
                          </Text>
                        </View>
                      )}
                      {item.task_type === "timed" && item.time_limit_minutes && (
                        <View style={styles.typePill}>
                          <Timer size={10} color={Colors.accentPurple} />
                          <Text style={[styles.typePillText, { color: Colors.accentPurple }]}>
                            {item.time_limit_minutes}m limit
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {item.depends_on && (
                  <View style={styles.depBanner}>
                    <View style={styles.depLeft}>
                      <Link2 size={12} color={item.is_blocked ? Colors.warning : Colors.success} />
                      <Text style={styles.depText} numberOfLines={1}>
                        {item.is_blocked ? "Waiting on: " : "Ready: "}
                        {item.depends_on.title}
                      </Text>
                    </View>
                    {item.is_blocked && (
                      <TouchableOpacity
                        onPress={() => handlePatchWorkTask(item.id, { remind_dependency: true })}
                        style={styles.remindBtn}
                      >
                        <BellRing size={11} color={Colors.warning} />
                        <Text style={styles.remindBtnText}>Remind</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Progress Bar + Quick % Buttons */}
                <View style={styles.progressFooter}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${item.progress_pct}%`,
                          backgroundColor: isDone ? Colors.success : Colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.pctText}>{item.progress_pct}%</Text>
                  {[25, 50, 75].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      onPress={() => handlePatchWorkTask(item.id, { progress_pct: pct })}
                      style={[
                        styles.pctChip,
                        item.progress_pct === pct && styles.pctChipActive,
                      ]}
                    >
                      <Text style={styles.pctChipText}>{pct}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Quick Create Work Task Modal */}
      <Modal visible={isCreateOpen} animationType="slide" transparent onRequestClose={() => setIsCreateOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Daily / Work Task</Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Submit daily call summary"
                placeholderTextColor={Colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.fieldLabel}>TYPE</Text>
              <View style={styles.typeRow}>
                {[
                  { id: "one_time", label: "One-Time" },
                  { id: "recurring", label: "Daily" },
                  { id: "timed", label: "Timed" },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setNewType(opt.id as any)}
                    style={[styles.typeOpt, newType === opt.id && styles.typeOptActive]}
                  >
                    <Text
                      style={[styles.typeOptText, newType === opt.id && styles.typeOptTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {newType === "timed" && (
                <>
                  <Text style={styles.fieldLabel}>TIME LIMIT (MINUTES)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={newTimeLimit}
                    onChangeText={setNewTimeLimit}
                  />
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={handleCreateWorkTask}
              disabled={creating}
              style={styles.createBtn}
            >
              {creating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.createBtnText}>Create Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  modeBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    alignItems: "center",
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardDark,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  modeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  modeTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardDark,
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryLight,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primaryLight,
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
  taskCardDone: {
    borderColor: "rgba(16, 185, 129, 0.3)",
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
    width: 22,
    height: 22,
    borderRadius: 11,
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
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.primaryMuted,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primaryLight,
    textTransform: "capitalize",
  },
  depBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.warningMuted,
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
    gap: 8,
  },
  depLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  depText: {
    fontSize: 11,
    color: Colors.textPrimary,
    flex: 1,
  },
  remindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  remindBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.warning,
  },
  progressFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  pctText: {
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
    color: Colors.textSecondary,
    width: 32,
  },
  pctChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pctChipActive: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primaryMuted,
  },
  pctChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.backgroundDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.cardDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    height: 44,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeOpt: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  typeOptActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryLight,
  },
  typeOptText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  typeOptTextActive: {
    color: Colors.primaryLight,
    fontWeight: "700",
  },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  broadcastBannerWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
  },
  broadcastCard: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  broadcastHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  broadcastTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  broadcastBody: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  broadcastActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  broadcastActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  broadcastActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
