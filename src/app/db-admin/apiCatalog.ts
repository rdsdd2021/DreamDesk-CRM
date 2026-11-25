export interface ApiEndpointSpec {
  id: string;
  group: "Leads" | "Tasks & Calls" | "Metadata & Users" | "Analytics & System" | "Database";
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  description: string;
  defaultBody?: string;
}

export const API_CATALOG: ApiEndpointSpec[] = [
  {
    id: "leads-list",
    group: "Leads",
    method: "GET",
    path: "/api/leads?page=1&limit=20",
    title: "List / Filter Leads",
    description: "Paginated leads list with search, status, assigned_to, campaign_id, disposition_id, and dynamic facet_* filters.",
  },
  {
    id: "leads-get-one",
    group: "Leads",
    method: "GET",
    path: "/api/leads/1",
    title: "Get Lead by ID",
    description: "Fetch a single student lead profile with RBAC scoping and raw_attributes.",
  },
  {
    id: "leads-activities",
    group: "Leads",
    method: "GET",
    path: "/api/leads/1/activities",
    title: "Get Lead Activities",
    description: "Fetch interaction timeline, call logs, and audit events for a specific lead.",
  },
  {
    id: "leads-disposition",
    group: "Leads",
    method: "POST",
    path: "/api/leads/1/disposition",
    title: "Log Call Disposition",
    description: "Record call outcome, disposition_id, notes, and optional callback schedule for a lead.",
    defaultBody: JSON.stringify(
      {
        disposition_id: "disp_interested",
        call_outcome: "connected",
        notes: "Spoke with student via API test",
      },
      null,
      2
    ),
  },
  {
    id: "tasks-list",
    group: "Tasks & Calls",
    method: "GET",
    path: "/api/tasks",
    title: "List Tasks & Callbacks",
    description: "Retrieve scheduled follow-up tasks and callbacks.",
  },
  {
    id: "notifications-list",
    group: "Tasks & Calls",
    method: "GET",
    path: "/api/notifications",
    title: "List Notifications",
    description: "Fetch active counselor notifications and callback alerts.",
  },
  {
    id: "dispositions-list",
    group: "Metadata & Users",
    method: "GET",
    path: "/api/dispositions",
    title: "List Call Dispositions",
    description: "Retrieve configured call outcome dispositions and sub-dispositions.",
  },
  {
    id: "campaigns-list",
    group: "Metadata & Users",
    method: "GET",
    path: "/api/campaigns",
    title: "List Campaigns",
    description: "Retrieve marketing campaigns and lead sources.",
  },
  {
    id: "users-list",
    group: "Metadata & Users",
    method: "GET",
    path: "/api/users",
    title: "List Staff Users",
    description: "Retrieve counselors, telecallers, team leads, and administrators.",
  },
  {
    id: "schema-list",
    group: "Metadata & Users",
    method: "GET",
    path: "/api/schema",
    title: "Lead Dynamic Schema",
    description: "Retrieve custom dynamic field definitions (school, stream, city, score, etc.).",
  },
  {
    id: "analytics-perf",
    group: "Analytics & System",
    method: "GET",
    path: "/api/analytics/performance",
    title: "Counselor Performance",
    description: "Calling velocity, conversion rates, and disposition breakdown.",
  },
  {
    id: "diagnostics",
    group: "Analytics & System",
    method: "GET",
    path: "/api/diagnostics",
    title: "System Diagnostics",
    description: "Database size, WAL status, and recent logged system errors.",
  },
  {
    id: "auth-me",
    group: "Analytics & System",
    method: "GET",
    path: "/api/auth/me",
    title: "Current Session User",
    description: "Verify current authenticated session user and RBAC permissions.",
  },
  {
    id: "db-tables",
    group: "Database",
    method: "GET",
    path: "/api/admin/db?action=tables",
    title: "List DB Tables (Admin)",
    description: "Live SQLite table list with row counts and WAL mode status.",
  },
  {
    id: "db-query",
    group: "Database",
    method: "POST",
    path: "/api/admin/db",
    title: "Run SQL Query (Admin)",
    description: "Execute live SQL queries against crm.db (Read-Only by default).",
    defaultBody: JSON.stringify(
      {
        sql: "SELECT status, COUNT(*) as count FROM leads GROUP BY status;",
        allowWrite: false,
      },
      null,
      2
    ),
  },
];

export const TABLE_TO_API_MAP: Record<string, string> = {
  leads: "leads-list",
  lead_activities: "leads-activities",
  tasks: "tasks-list",
  notifications: "notifications-list",
  dispositions: "dispositions-list",
  campaigns: "campaigns-list",
  users: "users-list",
  lead_schema_meta: "schema-list",
  system_errors: "diagnostics",
};
