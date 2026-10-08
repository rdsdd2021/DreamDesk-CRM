# 📋 DreamDesk CRM — Detailed Changelog & Release Notes

All notable changes, architectural enhancements, schema migrations, and feature additions for DreamDesk CRM are documented in this file.

---

## [v2.5.0] — 2026-10-08

### 🔒 Enterprise Security Hardening, Policy Integrity, Zero-Data-Loss Deduplication & UX Synchronization
**Objective**: Eliminate critical authentication loopholes, enforce strict RBAC across all REST endpoints, prevent cascade data loss during duplicate lead merges, standardize phone normalization, and resolve operator keyboard navigation desynchronization.

#### 1. Security & RBAC Hardening
- **Universal Session & Permission Middleware (`authService.ts`)**: Added `requireAuth(request, requiredPermission)` helper verifying active sessions and permissions before executing operations.
- **Lockdown of Critical Endpoints**:
  - `POST /api/leads/bulk-delete`: Restricted strictly to Super Admins with `canDeleteLeads`.
  - `POST /api/users`: Fixed cookie bypass vulnerability; strictly verifies `canManageTeam`.
  - `GET /api/leads`: Enforces authentication; unauthenticated requests receive 401 instead of exfiltrating all 500k student records.
  - `POST /api/leads/claim`: Enforces counselor self-scoping and prevents IDOR lead poaching.
  - `GET / POST /api/leads/duplicates`: Restricted to users with `canAssignLeads`.
  - `GET / POST /api/leads/[id]/activities`: Strict counselor IDOR check and tamper-proof performer identity logged from session.
  - `POST /api/leads/[id]/disposition`: Strict counselor IDOR check and caller attribution.
  - `PATCH /api/tasks/[id]`: Enforces task assignment ownership check.
- **Cryptographic Password Seeding**: New user creation in `LeadsService.createUser` now hashes initial passwords using scrypt with random salts.

#### 2. Zero-Data-Loss Duplicate Merging & Phone Normalization
- **Historical Activity & Task Re-Parenting (`leadsService.ts`)**: `mergeLeads` now re-links all `lead_activities` and `crm_tasks` to the surviving primary record before executing deletion, preventing `ON DELETE CASCADE` from erasing historical calls, notes, and callbacks.
- **Standardized Phone Normalization (`normalizePhoneNumber`)**: Strips country codes (`+91`, `91`, leading `0`), whitespace, and symbols. Both duplicate clustering and CSV batch import deduplication now detect matches across formatting variations.

#### 3. 7-Day Counselor Ownership Policy & Task Integrity
- **Counselor Attribution Binding (`policyService.ts`)**: `checkLeadLock` and `getPolicyStats` now evaluate whether the *currently assigned counselor* performed the call or note (`performed_by_id = lead.assigned_to`), preventing transfer recipients from inheriting unearned locks.
- **Interaction Expansion**: 7-day lock now protects leads when counselors log consultation notes (`note`) or send WhatsApp messages (`whatsapp`).
- **Policy Check on Self-Claim**: `claimUnassignedLeads` validates candidates against `PolicyService.validateBulkReassignment` inside an atomic transaction.
- **Deactivated Counselor Filter**: `autoDistributeLeads` now filters `WHERE status = 'active'` to prevent inactive staff allocation.
- **Idempotent Task Completion**: `TasksService.completeTask` guards against duplicate completion updates and duplicate timeline log entries.

#### 4. Operator UX & Workflow Synchronization (`page.tsx`)
- **Hotkey Desynchronization Resolved**: Global calling (<kbd>c</kbd>) and WhatsApp (<kbd>w</kbd>) hotkeys now correctly target the student currently open in `EnhancedLeadDrawer` or active row. Drawer sequential navigation (<kbd>[</kbd> / <kbd>]</kbd>) synchronizes `activeLeadIndex`.
- **Multi-Page Selection Preserved**: `handleToggleSelectAllPage` now performs a Set union across pages, preventing selections made on previous pages from being discarded.

---

## [v2.4.0] — 2026-10-08

### 🌟 Redesigned Lead History: Smart Executive Journey & Multi-Density Timeline
**Objective**: Eliminate vertical fatigue, cognitive clutter, and information overload caused by legacy 3,000px card feeds. Provide admissions counselors with a 3-second at-a-glance briefing before placing consultation calls.

#### 1. Executive Journey Highlights Strip (`src/components/crm/LeadTimeline.tsx`)
- **Intake & Pipeline Age**: Instant calculation of days active in the pipeline (`X Days Active` or `New Today`) and origin marketing campaign.
- **Call Engagement**: Total telephone calls logged, time since last contact, and latest disposition outcome.
- **Counselor Ownership**: Current assigned staff member with policy protection status badge.
- **Current Admissions Stage**: Visual lifecycle badge with associated disposition and sub-disposition.
- **Pinned Latest Remark Banner**: Automatic highlight banner displaying the most recent counselor consultation note or call observation at the very top.

#### 2. Multi-Density Stream Architecture
- **`Compact` Mode (Default — 75% Vertical Space Savings)**:
  - Linear single-line rows with colored circular action icons (`PhoneCall` 🟢, `Stage` 🟣, `Note` 🔵, `Ownership` 🟢, `System` ⚪).
  - Truncated 1-line remarks preview (`line-clamp-1`) for rapid scanning.
  - Expand/collapse toggle (`[▾ Details]`) revealing full description, old-to-new transition pills, and ISO timestamps on demand.
  - Global *Expand all* and *Collapse all* bulk controls.
- **`Detailed` Mode**:
  - Full card audit layout with all deltas, tags, and complete remarks permanently expanded for deep compliance auditing.

#### 3. Smart Chronological Date Bucketing
- Automatic grouping of lead activity records into sticky time dividers:
  - **Today**
  - **Yesterday**
  - **Day of Week** (e.g., *Monday, Oct 6*)
  - **Earlier History** (month/day/year)

#### 4. High-Signal vs Low-Signal Filtering & Real-Time Search
- **Signal Filter Chips**:
  - `All`: Full chronological audit log.
  - `📞 Calls & Notes`: High-signal view showing exclusively phone calls, counseling remarks, and WhatsApp conversations.
  - `🔄 Stages`: Admissions pipeline stage shifts and counselor allocations.
  - `⚙️ System`: Bulk tags, schema metadata changes, and campaign attribution changes.
- **In-Timeline Search Bar**: Real-time filtering across titles, counselor remarks, staff names, old/new values, and tags.

#### 5. Quick Note Composer with One-Touch Preset Chips
- Textarea with 6 one-click template chips for rapid logging:
  - `+ Parent requested follow-up call`
  - `+ Fee structure shared with student`
  - `+ Awaiting document submission`
  - `+ Call unanswered / phone switched off`
  - `+ Interested in physical campus visit`
  - `+ Confirmed application admission intent`

---

## [v2.3.0] — 2026-10-07

### 🔔 Bulk Action Task & Priority Notification Engine
**Objective**: Connect bulk administrative operations (allocation, campaign attribution, tagging) directly to caller workflows so telecallers and counselors receive immediate prioritized tasks and in-app alerts.

#### 1. Database Schema Additions (`src/lib/db/database.ts`)
- **`crm_tasks` Table**:
  - Fields: `id`, `lead_id`, `assigned_to`, `title`, `description`, `priority` (`urgent` | `high` | `normal` | `low`), `due_date`, `status` (`pending` | `completed`), `created_by`, `source_action` (`bulk_assign` | `bulk_campaign` | `bulk_tags` | `manual` | `callback`), `completed_at`, `created_at`, `updated_at`.
  - Indexes: `idx_tasks_assigned_status`, `idx_tasks_priority`, `idx_tasks_due_date`, `idx_tasks_lead`.
- **`user_notifications` Table**:
  - Fields: `id`, `user_id`, `title`, `message`, `type` (`task` | `policy` | `lead_assignment` | `system`), `priority`, `metadata` (JSON), `is_read` (0/1), `created_at`.
  - Indexes: `idx_notif_user_unread`, `idx_notif_created`.

#### 2. Tasks & Notification Service (`src/lib/services/tasksService.ts`)
- **`createBulkTasksForLeads`**:
  - Discovers assigned counselors for all target leads.
  - Calculates dynamic due dates based on priority SLA:
    - **Urgent**: 4 hours
    - **High**: 12 hours
    - **Normal**: 24 hours
    - **Low**: 48 hours
  - Records task timeline entries on each lead's `lead_activities` log.
  - Aggregates tasks per counselor and dispatches batch in-app notifications.
- **`getTasks`**: Unified query sorting by priority urgency (`urgent` ➔ `high` ➔ `normal` ➔ `low`) and time buckets (`overdue`, `today`, `upcoming`, `completed`).
- **`completeTask`**: Resolves task status and appends a `Task Completed` audit entry to the lead timeline.
- **`getNotifications` & `markNotificationRead` / `markAllNotificationsRead`**: Manages unread alert counts and status toggling.

#### 3. Bulk Modals with Task Configuration
- **`BulkAssignModal.tsx`**: Added task scheduling toggle, custom title input, priority pills (Urgent 🔴, High 🟠, Normal 🔵, Low ⚪), and SLA dropdown.
- **`BulkCampaignModal.tsx`** (New): Dedicated modal for re-attaching leads to marketing campaigns with optional priority follow-up task generation.
- **`BulkTagsModal.tsx`**: Integrated task creation options for batch tag applications.
- **`BulkActionBar.tsx`**: Updated *Change Campaign* trigger to launch `BulkCampaignModal`.

#### 4. Top Header Notification Center (`src/components/crm/NotificationBell.tsx`)
- Real-time unread notification badge counter.
- Dropdown menu displaying recent task assignments, priorities, relative timestamps, and one-click *Mark all read*.
- Deep link to the Tasks & Callbacks Workspace.

#### 5. Tasks Command Center Overhaul (`src/components/crm/TasksWorkspace.tsx`)
- Unified view merging CRM tasks and phone callbacks.
- Visual priority badges (`🔥 URGENT`, `⚡ HIGH`, `📌 NORMAL`, `⚪ LOW`).
- Source badges (`Bulk Assign`, `Campaign`, `Tagged`, `Callback`).
- Priority filter pills (`All`, `Urgent`, `High`, `Normal`, `Low`).
- 1-click **"Done"** completion button with optimistic UI updates.
- Tab for **Completed Tasks**.

---

## [v2.2.0] — 2026-10-06

### 🛡️ 7-Day Counselor Ownership Policy Protection & Governance System
**Objective**: Prevent lead poaching and maintain student relationship continuity by locking leads assigned to a counselor who has contacted them within the past 7 days.

#### 1. Policy Engine (`src/lib/services/policyService.ts`)
- **Call Lock Rule**: Leads contacted via logged call, disposition, or consultation note within 7 days cannot be reassigned to another counselor.
- **Admin & Team Leader Override**: Privileged users can override policy locks with an explicit `override_policy: true` parameter and logged audit reason.
- **Pre-flight Validation (`validateBulkReassignment`)**: Validates entire batches before bulk execution, splitting target leads into `allowedIds` and `lockedIds`.

#### 2. User Interface Integration
- **Lock Protection Notice**: Displayed in `BulkAssignModal` with count of protected leads and override toggle for Admins.
- **Lead Drawer Lock Badge**: Real-time lock banner displaying the protecting counselor name, last contact date, and days remaining until unlock.
- **Dedicated Governance Studio (`src/components/crm/PoliciesWorkspace.tsx`)**: Full administrative view for configuring lock duration, override permissions, and audit logs.

#### 3. API Endpoints
- `GET /api/policies`: Retrieves active CRM policies and system configuration.
- `GET /api/policies/check?lead_id=...`: Real-time status check for lead lock state.

---

## [v2.1.0] — 2026-10-05

### 📝 Comprehensive Audit Trail & Activity Logging Engine
**Objective**: Ensure 100% compliance and complete data lineage for every action taken in the CRM.

- **`lead_activities` Table**: Tracks timeline events per student lead (`created`, `assigned`, `stage_change`, `disposition`, `note`, `field_update`, `whatsapp`, `communication`).
- **`activity_logs` Table**: System-wide administrative log capturing batch imports, bulk allocations, campaign switches, duplicate merges, and policy overrides.
- **Audit Logging across all bulk endpoints**:
  - `POST /api/leads/bulk-assign`: Logs mode, count, and policy override flags.
  - `POST /api/leads/bulk-campaign`: Logs old and new campaign attributions.
  - `POST /api/leads/bulk-tags`: Logs added and removed tag diffs.
  - `POST /api/leads/bulk-status`: Logs lifecycle stage transitions.
  - `POST /api/leads/duplicates`: Logs merged lead IDs and consolidated attributes.

---

## [v2.0.0] — 2026-10-01

### 🚀 Core Platform Architecture & High-Density Engine
- Next.js 16 (App Router + Turbopack) + React 19.
- Embedded SQLite with Write-Ahead Logging (`better-sqlite3`), 64MB memory cache tuning.
- Dynamic Schema Studio with on-the-fly column additions without schema migrations.
- 500,000+ lead query performance with sub-30ms facet compilation.
- Role-Based Access Control (RBAC): Super Admin, Team Lead, Senior Counselor, Counselor, Telecaller.
- Scrypt password hashing with cryptographically random salts.
- CmdK Global Command Center (`Ctrl+K`).
- 1-Click WhatsApp integration with variable interpolation.
