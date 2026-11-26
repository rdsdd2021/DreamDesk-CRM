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
  ScrollView,
} from "react-native";
import { Colors } from "../theme/colors";
import { MobileApiClient } from "../api/mobileApiClient";
import { LeadCard, MobileLead } from "../components/LeadCard";
import { FilterModal, MobileFilterState } from "../components/FilterModal";
import { RapidLoggerModal } from "../components/RapidLoggerModal";
import { useCallTracker } from "../hooks/useCallTracker";
import { MobileCache } from "../utils/cache";
import { Search, Filter, X } from "lucide-react-native";

const QUICK_CHIPS: { id: string; label: string; apply: Partial<MobileFilterState> }[] = [
  { id: "all", label: "All Leads", apply: {} },
  { id: "uncalled", label: "Uncalled Today", apply: { calling_recency: "uncalled_today" } },
  { id: "new", label: "New", apply: { status: "New" } },
  { id: "interested", label: "Interested", apply: { status: "Interested" } },
  { id: "followup", label: "Follow-up", apply: { status: "Follow-up" } },
];

export function LeadsScreen({ navigation }: any) {
  const [leads, setLeads] = useState<MobileLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<MobileFilterState>({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Rapid Logger State
  const [activeCallLead, setActiveCallLead] = useState<{ id: number; name: string } | null>(null);
  const [isRapidLoggerOpen, setIsRapidLoggerOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [dispositions, setDispositions] = useState<any[]>([]);

  const { startCall } = useCallTracker((leadId, leadName, durationSec) => {
    setActiveCallLead({ id: leadId, name: leadName });
    setCallDuration(durationSec);
    setIsRapidLoggerOpen(true);
  });

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Hydrate cached leads & dispositions on initial mount for 0ms startup
  useEffect(() => {
    MobileCache.get<MobileLead[]>("leads_default").then((cached) => {
      if (cached && cached.length > 0 && leads.length === 0) {
        setLeads(cached);
        setLoading(false);
      }
    });
    MobileCache.get<any[]>("dispositions").then((cachedDisp) => {
      if (cachedDisp && cachedDisp.length > 0) {
        setDispositions(cachedDisp);
      }
    });
    MobileApiClient.fetchJson<any[]>("/api/dispositions").then(({ data }) => {
      if (Array.isArray(data)) {
        setDispositions(data);
        MobileCache.set("dispositions", data);
      }
    });
  }, []);

  const fetchLeads = useCallback(
    async (pageToLoad = 1, isPullRefresh = false) => {
      try {
        if (pageToLoad === 1 && !isPullRefresh && leads.length === 0) {
          setLoading(true);
        } else if (pageToLoad > 1) {
          setLoadingMore(true);
        }

        const params = new URLSearchParams();
        params.append("page", String(pageToLoad));
        params.append("limit", "25");

        if (debouncedSearch) params.append("search", debouncedSearch);
        if (filters.status) params.append("status", filters.status);
        if (filters.calling_recency) params.append("calling_recency", filters.calling_recency);
        if (filters.stream) params.append("facet_stream", filters.stream);
        if (filters.school) params.append("facet_school", filters.school);
        if (filters.city) params.append("facet_city", filters.city);

        const { data } = await MobileApiClient.fetchJson<{
          leads: MobileLead[];
          total: number;
          totalPages?: number;
        }>(`/api/leads?${params.toString()}`);

        if (data?.leads) {
          if (pageToLoad === 1) {
            setLeads(data.leads);
            if (!debouncedSearch && Object.keys(filters).length === 0) {
              MobileCache.set("leads_default", data.leads);
            }
          } else {
            setLeads((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const next = data.leads.filter((l) => !existingIds.has(l.id));
              return [...prev, ...next];
            });
          }
          setTotalCount(data.total || 0);
          setHasMore(data.leads.length >= 25);
        }
      } catch (err) {
        console.error("Failed to load leads:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, filters]
  );

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchLeads(1);
  }, [fetchLeads]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchLeads(1, true);
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLeads(nextPage);
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

  const isChipActive = (chipId: string) => {
    if (chipId === "all") return activeFilterCount === 0;
    if (chipId === "uncalled") return filters.calling_recency === "uncalled_today";
    if (chipId === "new") return filters.status === "New";
    if (chipId === "interested") return filters.status === "Interested";
    if (chipId === "followup") return filters.status === "Follow-up";
    return false;
  };

  const renderLead = useCallback(
    ({ item }: { item: MobileLead }) => (
      <LeadCard
        lead={item}
        onPress={() => navigation.navigate("LeadDetail", { leadId: item.id })}
        onPressCall={(l) => startCall(l.id, l.name, l.phone)}
        onPressWhatsApp={handleTriggerWhatsApp}
      />
    ),
    [navigation, startCall]
  );

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
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

      {/* 1-Tap Quick Filter Chips */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {QUICK_CHIPS.map((chip) => {
            const active = isChipActive(chip.id);
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setFilters(chip.apply)}
                style={[styles.quickChip, active && styles.quickChipActive]}
              >
                <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Leads Counter */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          Showing <Text style={styles.countBold}>{leads.length}</Text> of{" "}
          <Text style={styles.countBold}>{totalCount.toLocaleString()}</Text> students
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={() => setFilters({})} style={styles.clearFiltersBtn}>
            <Text style={styles.clearFiltersText}>Reset All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Virtualized Leads List */}
      {loading && leads.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching student database...</Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLead}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.footerLoaderText}>Loading more leads...</Text>
              </View>
            ) : undefined
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
          onSuccess={(updatedLead) => {
            if (updatedLead?.id) {
              setLeads((prev) => {
                const next = prev.map((l) =>
                  l.id === updatedLead.id ? { ...l, ...updatedLead } : l
                );
                if (!debouncedSearch && Object.keys(filters).length === 0) {
                  MobileCache.set("leads_default", next);
                }
                return next;
              });
            } else {
              fetchLeads(1, true);
            }
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
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  filterButton: {
    width: 44,
    height: 44,
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
  chipsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quickChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryLight,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  quickChipTextActive: {
    color: Colors.primaryLight,
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
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 12,
    color: Colors.textMuted,
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
