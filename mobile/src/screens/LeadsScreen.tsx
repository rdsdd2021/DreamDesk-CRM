import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { LeadCard, MobileLead } from "../components/LeadCard";
import { FilterModal, MobileFilterState } from "../components/FilterModal";
import { RapidLoggerModal } from "../components/RapidLoggerModal";
import { Search, Filter, PhoneCall, RefreshCw, X } from "lucide-react-native";

export function LeadsScreen({ navigation }: any) {
  const [leads, setLeads] = useState<MobileLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters State
  const [filters, setFilters] = useState<MobileFilterState>({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Rapid Logger State
  const [activeCallLead, setActiveCallLead] = useState<MobileLead | null>(null);
  const [isRapidLoggerOpen, setIsRapidLoggerOpen] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [dispositions, setDispositions] = useState<any[]>([]);

  const fetchDispositions = async () => {
    try {
      const { data } = await MobileApiClient.fetchJson<any[]>("/api/dispositions");
      if (Array.isArray(data)) {
        setDispositions(data);
      }
    } catch {
      // ignore
    }
  };

  const fetchLeads = useCallback(
    async (pageToLoad = 1, isPullRefresh = false) => {
      try {
        if (!isPullRefresh) setLoading(true);
        const params = new URLSearchParams();
        params.append("page", String(pageToLoad));
        params.append("limit", "25");

        if (search.trim()) params.append("search", search.trim());
        if (filters.status) params.append("status", filters.status);
        if (filters.calling_recency) params.append("calling_recency", filters.calling_recency);
        if (filters.stream) params.append("facet_stream", filters.stream);
        if (filters.school) params.append("facet_school", filters.school);
        if (filters.city) params.append("facet_city", filters.city);

        const { data, error } = await MobileApiClient.fetchJson<{
          leads: MobileLead[];
          total: number;
        }>(`/api/leads?${params.toString()}`);

        if (data?.leads) {
          if (pageToLoad === 1) {
            setLeads(data.leads);
          } else {
            setLeads((prev) => [...prev, ...data.leads]);
          }
          setTotalCount(data.total || 0);
        }
      } catch (err) {
        console.error("Failed to load leads:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, filters]
  );

  useEffect(() => {
    fetchDispositions();
  }, []);

  useEffect(() => {
    setPage(1);
    fetchLeads(1);
  }, [fetchLeads]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchLeads(1, true);
  };

  const handleTriggerCall = async (lead: MobileLead) => {
    try {
      setActiveCallLead(lead);
      setCallStartTime(Date.now());

      const { data } = await MobileApiClient.fetchJson<{ dialUri: string }>(
        `/api/leads/${lead.id}/call-intent`,
        { method: "POST" }
      );

      const dialTarget = data?.dialUri || (lead.phone ? `tel:${lead.phone}` : null);
      if (dialTarget) {
        await Linking.openURL(dialTarget);

        // Auto open rapid outcome logger
        setTimeout(() => {
          if (callStartTime) {
            const secs = Math.max(1, Math.round((Date.now() - callStartTime) / 1000));
            setCallDuration(secs);
          } else {
            setCallDuration(30);
          }
          setIsRapidLoggerOpen(true);
        }, 1500);
      }
    } catch {
      Alert.alert("Dialer Error", "Could not trigger phone dialer");
    }
  };

  const handleTriggerWhatsApp = async (lead: MobileLead) => {
    try {
      const { data } = await MobileApiClient.fetchJson<{ launchUrl: string }>(
        `/api/leads/${lead.id}/whatsapp-intent`,
        { method: "POST" }
      );
      if (data?.launchUrl) {
        await Linking.openURL(data.launchUrl);
      }
    } catch {
      Alert.alert("WhatsApp Error", "Could not launch WhatsApp");
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <View style={styles.container}>
      {/* Top Search & Filter Bar */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search student, code, or phone..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <X size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => setIsFilterModalOpen(true)}
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
        >
          <Filter size={16} color={activeFilterCount > 0 ? "#fff" : Colors.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Leads Counter */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          Found <Text style={styles.countBold}>{totalCount.toLocaleString()}</Text> students
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={() => setFilters({})} style={styles.clearFiltersBtn}>
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Virtualized Leads List */}
      {loading && page === 1 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching student database...</Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <LeadCard
              lead={item}
              onPress={() => navigation.navigate("LeadDetail", { leadId: item.id })}
              onPressCall={handleTriggerCall}
              onPressWhatsApp={handleTriggerWhatsApp}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No matching students</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search query or filters.</Text>
            </View>
          }
        />
      )}

      {/* Filter Bottom Sheet Modal */}
      <FilterModal
        visible={isFilterModalOpen}
        filters={filters}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={(newFilters) => setFilters(newFilters)}
        onReset={() => setFilters({})}
      />

      {/* Rapid Logger Modal */}
      {activeCallLead && (
        <RapidLoggerModal
          visible={isRapidLoggerOpen}
          leadId={activeCallLead.id}
          studentName={activeCallLead.name}
          dispositions={dispositions}
          initialDurationSeconds={callDuration}
          onClose={() => {
            setIsRapidLoggerOpen(false);
            setActiveCallLead(null);
          }}
          onSuccess={() => {
            fetchLeads(1);
          }}
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
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  countText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  countBold: {
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  clearFiltersBtn: {
    padding: 2,
  },
  clearFiltersText: {
    fontSize: 11,
    color: Colors.primaryLight,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
  },
});
