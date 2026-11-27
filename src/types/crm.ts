export type UserRole = 'admin' | 'team_lead' | 'senior_counselor' | 'counselor' | 'telecaller';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  avatar_color: string;
  assigned_count?: number;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  last_login_location?: string | null;
  deactivated_at?: string | null;
  deactivated_by?: string | null;
  team_lead_id?: string | null;
  team_lead_name?: string | null;
  created_at: string;
}

export interface AuthSession {
  user: User;
  sessionId: string;
  expiresAt: string;
  permissions: {
    canViewAllLeads: boolean;
    canExportLeads: boolean;
    canDeleteLeads: boolean;
    canManageSchema: boolean;
    canManageCampaigns: boolean;
    canManageDispositions: boolean;
    canManageTeam: boolean;
    canImportLeads: boolean;
    canViewAuditLogs: boolean;
    canAssignLeads: boolean;
    canManagePolicies?: boolean;
    allowedViews: string[];
  };
}

export interface UserScope {
  userId: string;
  role: UserRole;
  canViewAllLeads: boolean;
  name?: string;
}

export interface SchemaMeta {
  id: string;
  key_name: string;
  display_label: string;
  data_type: 'string' | 'number' | 'date' | 'boolean';
  is_filterable: number; // 1 or 0
  filter_type: 'faceted' | 'range' | 'search';
  is_visible: number; // 1 or 0
  display_order: number;
  lead_count?: number;
  created_at?: string;
}

export interface SubDisposition {
  id: string;
  disposition_id: string;
  name: string;
  code: string;
  score: number;
  display_order: number;
  is_active: number; // 1 or 0
  created_at?: string;
}

export interface Disposition {
  id: string;
  name: string;
  code: string;
  category: 'positive' | 'neutral' | 'negative' | 'unreachable';
  color: string;
  score: number;
  requires_callback: number; // 1 or 0
  is_active: number; // 1 or 0
  display_order: number;
  linked_campaign_ids?: string[];
  sub_dispositions?: SubDisposition[];
  created_at?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  channel: string;
  target_audience?: string;
  status: 'active' | 'completed' | 'paused';
  total_leads?: number;
  converted_leads?: number;
  disposition_counts?: Record<string, number>;
  linked_disposition_ids?: string[];
  created_at: string;
}

export interface LeadAlternateContact {
  id: string;
  phone: string;
  label: string;
  added_by_name?: string;
  added_at: string;
}

export interface Lead {
  id: number;
  lead_code: string;
  name: string | null;
  phone: string | null;
  phone_label?: string | null;
  alternate_contacts?: LeadAlternateContact[];
  email: string | null;
  status: string;
  assigned_to: string | null;
  assigned_user_name?: string | null;
  assigned_user_color?: string | null;
  assigned_at: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  disposition_id?: string | null;
  disposition_name?: string | null;
  disposition_color?: string | null;
  sub_disposition_id?: string | null;
  sub_disposition_name?: string | null;
  callback_at?: string | null;
  attempt_count?: number;
  last_attempt_at?: string | null;
  cooldown_until?: string | null;
  call_outcome?: string | null;
  is_reassigned?: boolean;
  previous_counselor_name?: string | null;
  previous_disposition_name?: string | null;
  previous_notes?: string | null;
  reassigned_at?: string | null;
  tags?: string[];
  raw_attributes: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string[]>;
  search?: string;
  search_query?: string;
  visible_columns?: string[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  is_default?: number;
  created_at?: string;
}

export interface CallbackTask {
  lead_id: number;
  lead_code: string;
  name: string | null;
  phone: string | null;
  status: string;
  callback_at: string;
  assigned_to: string | null;
  assigned_user_name?: string | null;
  disposition_name?: string | null;
  sub_disposition_name?: string | null;
  notes: string | null;
}

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface CrmTask {
  id: number;
  lead_id: number;
  lead_code: string;
  lead_name: string | null;
  lead_phone: string | null;
  lead_status: string;
  assigned_to: string;
  assigned_user_name?: string | null;
  assigned_user_color?: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string;
  status: TaskStatus;
  created_by: string;
  source_action: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserNotification {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: 'task' | 'policy' | 'lead_assignment' | 'system';
  priority: TaskPriority;
  metadata?: any;
  is_read: boolean;
  created_at: string;
}

export interface BulkTaskConfig {
  create_task: boolean;
  title: string;
  description?: string;
  priority: TaskPriority;
  due_date?: string;
  due_in_hours?: number;
}

export type WorkTaskType = 'one_time' | 'recurring' | 'timed';
export type WorkTaskRecurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly';
export type WorkTaskStatus = 'todo' | 'in_progress' | 'done';

export interface WorkTaskChecklistItem {
  id: number;
  task_id: number;
  label: string;
  is_done: boolean;
  sort_order: number;
}

export interface WorkTaskDependencySummary {
  id: number;
  title: string;
  status: WorkTaskStatus;
  assigned_to: string;
  assigned_user_name?: string | null;
}

export interface WorkTask {
  id: number;
  title: string;
  description: string | null;
  task_type: WorkTaskType;
  recurrence_rule: WorkTaskRecurrence | null;
  time_limit_minutes: number | null;
  started_at: string | null;
  due_at: string | null;
  status: WorkTaskStatus;
  progress_pct: number;
  priority: TaskPriority;
  assigned_to: string;
  assigned_user_name?: string | null;
  assigned_user_color?: string | null;
  created_by: string;
  created_by_name?: string | null;
  depends_on_task_id: number | null;
  depends_on?: WorkTaskDependencySummary | null;
  is_blocked?: boolean;
  last_completed_at: string | null;
  is_archived: boolean;
  checklist?: WorkTaskChecklistItem[];
  completion_count?: number;
  requires_proof?: boolean;
  requires_approval?: boolean;
  proof_notes?: string | null;
  approval_status?: 'none' | 'pending_review' | 'approved' | 'revision_requested';
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_feedback?: string | null;
  last_nudged_at?: string | null;
  nudge_count?: number;
  template_id?: number | null;
  created_at: string;
  updated_at: string;
}

export type PresenceStatus = 'available' | 'on_calls' | 'busy' | 'break' | 'wrap_up' | 'offline';

export interface DailyAutoStats {
  callsMade: number;
  connectedCalls: number;
  whatsappSent: number;
  tasksCompleted: number;
  conversions: number;
}

export interface DailyCheckin {
  id: number;
  user_id: string;
  checkin_date: string;
  presence_status: PresenceStatus;
  morning_focus: string | null;
  checked_in_at: string | null;
  eod_submitted_at: string | null;
  eod_notes: string | null;
  eod_blockers: string | null;
  eod_auto_stats?: DailyAutoStats | null;
  updated_at: string;
}

export interface DailyTarget {
  id?: number;
  user_id: string | null;
  calls_target: number;
  connected_target: number;
  whatsapp_target: number;
  tasks_target: number;
  conversions_target: number;
  is_override?: boolean;
}

export interface WorkTaskTemplate {
  id: number;
  title: string;
  description: string | null;
  task_type: WorkTaskType;
  recurrence_rule: WorkTaskRecurrence | null;
  time_limit_minutes: number | null;
  priority: TaskPriority;
  requires_proof: boolean;
  requires_approval: boolean;
  playbook_slot: 'morning' | 'midday' | 'evening' | 'custom';
  checklist: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TeamFloorMember {
  user: User;
  checkin: DailyCheckin | null;
  autoStats: DailyAutoStats;
  target: DailyTarget;
  tasks: {
    todo: number;
    inProgress: number;
    overdue: number;
    pendingReview: number;
    completedToday: number;
    nudged: number;
  };
  freshLeadsRemaining: number;
  bottlenecks: string[];
}

export interface DispositionSopRule {
  id: number;
  disposition_id: string | null;
  disposition_name?: string | null;
  sub_disposition_id: string | null;
  sub_disposition_name?: string | null;
  target_role: 'lead_owner' | 'team_lead' | 'senior_counselor' | 'counselor' | 'telecaller' | 'admin';
  specific_user_id: string | null;
  specific_user_name?: string | null;
  task_mode: 'call_task' | 'daily_task' | 'both';
  template_id: number | null;
  template_title?: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  sla_hours: number;
  requires_proof: boolean;
  requires_approval: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface WorkTaskLog {
  id: number;
  task_id: number;
  task_title?: string;
  task_type?: WorkTaskType;
  user_id: string;
  user_name: string;
  action: string;
  cycle_date: string | null;
  progress_pct: number | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
}

export interface FacetOption {
  value: string;
  label?: string;
  count: number;
}

export interface FacetGroup {
  key_name: string;
  display_label: string;
  options: FacetOption[];
}

export interface FilterParams {
  search?: string;
  status?: string[];
  assigned_to?: string[];
  campaign_id?: string[];
  disposition_id?: string[];
  tags?: string[];
  calling_recency?: 'uncalled_today' | 'never_called' | 'called_today' | 'all';
  reassigned_only?: boolean;
  facets?: Record<string, string[]>;
  date_from?: string;
  date_to?: string;
  date_preset?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface LeadSummaryStats {
  totalLeads: number;
  unassignedCount: number;
  assignedCount: number;
  statusBreakdown: Record<string, number>;
  isFiltered?: boolean;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: FacetGroup[];
  summary: LeadSummaryStats;
  globalSummary?: LeadSummaryStats;
}

export type WorkQueueId = "all" | "uncalled_today" | "callbacks" | "unassigned" | "high_intent" | "followups" | "unreached";


export interface BulkAssignRequest {
  mode: 'auto' | 'quota' | 'single';
  assignment_batch_id?: string;
  assignment_name?: string;
  lead_ids?: number[];
  apply_to_all_filtered?: boolean;
  filter_params?: FilterParams;
  total_to_assign?: number;
  single_user_id?: string;
  selected_user_ids?: string[];
  user_quotas?: Record<string, number>; // userId -> count
  override_policy?: boolean;
  task_config?: BulkTaskConfig;
}

export interface AssignmentBatchCallerStat {
  user_id: string;
  user_name: string;
  avatar_color?: string;
  assigned_count: number;
  initial_count: number;
  claimed_count: number;
  dialled_count: number;
  pending_new_count: number;
  followup_count: number;
  positive_count: number;
  admitted_count: number;
  conversion_rate: number;
}

export type BackgroundJobType =
  | 'import'
  | 'bulk_assign'
  | 'bulk_status'
  | 'bulk_campaign'
  | 'bulk_tags'
  | 'bulk_delete'
  | 'auto_distribute';

export type BackgroundJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface BackgroundJobLogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface BackgroundJob {
  id: string;
  job_type: BackgroundJobType;
  title: string;
  status: BackgroundJobStatus;
  total_items: number;
  processed_items: number;
  success_count: number;
  skipped_count: number;
  error_message?: string | null;
  result_summary?: Record<string, any> | null;
  logs?: BackgroundJobLogEntry[];
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface AssignmentBatchSummary {
  id: string;
  name: string;
  filter_params: FilterParams;
  filter_summary: string;
  mode: string;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  total_assigned: number;
  initial_assigned: number;
  claimed_assigned: number;
  remaining_unassigned_in_filter: number;
  callers: AssignmentBatchCallerStat[];
}

export interface ActivityLog {
  id: number;
  action_type: string;
  description: string;
  affected_count: number;
  metadata: string | null;
  performed_by: string;
  created_at: string;
}

export interface LeadActivity {
  id: number;
  lead_id: number;
  activity_type:
    | 'created'
    | 'assigned'
    | 'stage_change'
    | 'disposition'
    | 'callback_scheduled'
    | 'note'
    | 'field_update'
    | 'call'
    | 'whatsapp'
    | 'communication';
  title: string;
  description?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: string | null;
  performed_by_id?: string | null;
  performed_by_name?: string | null;
  performed_by_role?: string | null;
  created_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  template_body: string;
  is_default?: number;
  created_at?: string;
}

export interface AssignmentRule {
  id: string;
  name: string;
  criteria_field: string;
  criteria_value: string;
  assigned_to: string;
  assigned_user_name?: string | null;
  is_active: number;
  priority: number;
  created_at?: string;
}

export interface DuplicateCluster {
  key: string;
  field: 'phone' | 'email';
  count: number;
  leads: Lead[];
}

export interface CounselorMetric {
  counselor_id: string;
  name: string;
  avatar_color: string;
  total_assigned: number;
  calls_today: number;
  connected_calls_today?: number;
  unreachable_calls_today?: number;
  contact_rate: number;
  admissions_count: number;
  avg_score: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  drop_off: number;
}

export interface AnalyticsReportParams {
  date_preset?: string; // 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom'
  date_from?: string;   // "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
  date_to?: string;     // "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
  assigned_to?: string;
  campaign_id?: string;
  status?: string;
  stream?: string;
  disposition_id?: string;
  min_score?: number;
}

export interface AnalyticsReportData {
  filters: {
    date_preset: string;
    date_from: string | null;
    date_to: string | null;
    assigned_to: string | null;
    campaign_id: string | null;
    status: string | null;
    stream: string | null;
  };
  summary: {
    totalLeads: number;
    assignedCount: number;
    unassignedCount: number;
    contactedCount: number;
    interestedCount: number;
    admittedCount: number;
    positiveCount: number;
    conversionRate: string;
    callsLogged: number;
    connectedCalls?: number;
    unreachableCalls?: number;
    avgScore: number;
  };
  funnel: FunnelStage[];
  statusBreakdown: { name: string; value: number; color: string }[];
  streamBreakdown: { name: string; fullName: string; count: number; color: string }[];
  campaignBreakdown: {
    id: string;
    name: string;
    total: number;
    contacted: number;
    admitted: number;
    conversionRate: number;
  }[];
  dispositionBreakdown: {
    name: string;
    fullName: string;
    count: number;
    color: string;
    category: string;
  }[];
  counselorBreakdown: {
    counselor_id: string;
    name: string;
    avatar_color: string;
    total_assigned: number;
    calls_in_period: number;
    connected_calls?: number;
    unreachable_calls?: number;
    contact_rate: number;
    admissions_count: number;
    conversion_rate: number;
    avg_score: number;
  }[];
  dailyIntakeTrend: {
    date: string;
    leads: number;
    calls: number;
    connected?: number;
    unreachable?: number;
    admitted: number;
  }[];
  dailyCallingTrend?: {
    date: string;
    total_calls: number;
    connected_calls: number;
    unreachable_calls: number;
    admitted_count: number;
    time_label?: string;
  }[];
  sampleLeads: {
    id: number;
    lead_code: string;
    name: string;
    phone: string;
    status: string;
    school: string;
    stream: string;
    score: number;
    assigned_user_name: string | null;
    campaign_name: string | null;
    disposition_name: string | null;
    created_at: string;
  }[];
}

export interface LeadScoringPolicyConfig {
  academic_weight: number;
  disposition_weight: number;
  attempt_penalty: number;
  high_intent_threshold: number;
  auto_recalculate_on_call: boolean;
}

export interface CrmPolicyConfig {
  lock_days?: number;
  exempt_roles?: UserRole[];
  activity_types?: string[];
  allow_unassign?: boolean;
  require_reason_for_override?: boolean;
  notification_message?: string;
  academic_weight?: number;
  disposition_weight?: number;
  attempt_penalty?: number;
  high_intent_threshold?: number;
  auto_recalculate_on_call?: boolean;
  [key: string]: any;
}

export interface CrmPolicy {
  id: string;
  name: string;
  description: string | null;
  policy_type: 'counselor_lock' | 'inactivity_reclaim' | 'max_leads_cap' | string;
  is_enabled: boolean | number;
  config: CrmPolicyConfig;
  created_at: string;
  updated_at: string;
}

export interface PolicyValidationResult {
  allowed: boolean;
  policy_id?: string;
  policy_name?: string;
  is_override?: boolean;
  reason?: string;
  message?: string;
  lead_id?: number;
  lead_code?: string;
  counselor_id?: string;
  counselor_name?: string;
  last_call_at?: string;
  days_since_call?: number;
  days_remaining?: number;
  lock_days?: number;
}
