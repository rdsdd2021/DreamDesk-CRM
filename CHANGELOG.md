# 📋 DreamDesk CRM — Detailed Changelog & Release Notes

All notable changes, architectural enhancements, schema migrations, and feature additions for DreamDesk CRM are documented in this file.

---

## [v2.8.0] — 2026-10-16

### 🌟 Admissions Playbook, Smart Outcomes Studio & Frictionless Outcome Recipe Modal
**Objective**: Abstract the operational complexity of legacy telecom dispositions, sub-dispositions, mathematical score points, and campaign bindings into an intuitive visual **Admissions Playbook** with clean reaction trays and a single-column, friction-free outcome popup.

#### 1. Admissions Playbook Studio (`PlaybookStudioWorkspace.tsx`)
- **Abstracted Conceptual Model**: Replaced technical disposition management with an intuitive "Admissions Playbook & Smart Outcome Recipes" mental model.
- **4 Color-Coded Human Reaction Trays**:
  - 🌟 **Progressing Forward** (Emerald): High-intent admission steps (Enrolled, Campus Visit Scheduled, Ready to Apply). Automatically awards top ranking priority and advances students to *Interested* or *Admitted*.
  - ⏳ **Needs Follow-up** (Amber): Active considerations (Discussing with Parents, Fee & Installment Inquiry, Awaiting 12th/CUET Results). Automatically prompts for callback dates.
  - 📵 **Couldn't Connect** (Blue): 1-tap fast retry logging (Ringing No Response, Switched Off, Busy). Calculates attempt counts and activates smart cooldown.
  - 🛑 **Closed / Dropped** (Rose): Ineligible, joined elsewhere, or opted out. Halts active dialing and safely archives the lead.
- **1-Click Starter Playbook Packs**:
  - 🎓 *Undergrad & College Admissions*: Standard higher-ed cycle (visits, parent consultations, scholarships).
  - ⚙️ *Engineering & STEM Admissions*: Tailored for JEE, branch selection (CSE, AI/ML, ECE), and hostel availability.
  - 💼 *MBA & Post-Graduate Admissions*: Tailored for CAT/MAT/GMAT percentiles, GD/PI rounds, and executive financing.
- **Live KPI Counter Ribbon**: Real-time counts across all 4 reaction trays with instant search and tray filtering.
- **Collapsible Lead Scoring Engine**: In-studio calibration panel for academic vs disposition weights, attempt penalties, and high-intent score thresholds.

#### 2. Streamlined & Frictionless Outcome Modal (`PlaybookOutcomeModal.tsx`)
- **Focused Single-Column Layout (`sm:max-w-xl`)**: Completely eliminated the cramped 2-column split (which caused scrolling issues on standard laptop displays) in favor of a clean, top-to-bottom layout with zero numbered-step clutter.
- **Click-to-Pick Emoji Popover**: Replaced finicky CSS hover menus with a dedicated button opening a clean 24-emoji curated grid that closes reliably on outside click.
- **1-Click Starter Presets**: When adding new outcomes, 5 pre-filled popular pills (`🔥 Interested`, `🎓 Admitted`, `⏳ Follow-up`, `👨‍👩‍👧 Parents`, `📳 No Answer`) allow admins to create a fully configured outcome in 1 click.
- **Instant Smart Defaults**: Selecting a Category Tray automatically sets recommended Intent Levels and Callback requirements, saving operators from manual configuration.
- **Simplified Student Temperature (Intent)**: Clean 5-pill segmented picker (`🎓 +100`, `🔥 +75`, `🌤️ +35`, `❄️ 0`, `🛑 -30`) with a 1-line plain-language explanation of stage impact.
- **Effortless Sub-Reason Tags**: Removable chips with 1-click suggested additions (`+ Fee Details`, `+ Campus Visit`, `+ Hostel Query`, `+ Location Far`).
- **Natural Action Bar**: Cancel and Save buttons placed naturally at the bottom of the form where user focus ends.

#### 3. Telecaller Call Drawer Integration (`EnhancedLeadDrawer.tsx`)
- Grouped all reachable outcomes into the 3 reaction trays (🌟 Progressing, ⏳ Needs Follow-up, 🛑 Closed) alongside 1-tap unreachable shortcuts.
- Telecallers can identify and log conversation outcomes in under 2 seconds with zero operational confusion.

---

## [v2.7.0] — 2026-10-15

### 📊 Real-Time Call Reporting, Daily Calling Velocity & "Uncalled Today" Queue
**Objective**: Guarantee real-time dashboard reflection for all telecaller calls, provide actionable hourly/daily outreach velocity charts, and eliminate duplicate intra-day dialing through a dedicated uncalled queue.

#### 1. Real-Time Dashboard Call Reporting (`src/lib/services/leadsService.ts`, `AnalyticsWorkspace.tsx`)
- **Direct Activity Log Aggregation**: Resolved data lag where counselor call attempts were not reflecting in real-time dashboards by querying fresh SQLite activity logs directly within the transaction boundary.
- **Multi-Dimensional Metrics Sync**: Accurately counts connected conversations, unreachable attempts, total call duration, and first-call response latency across selected time windows.

#### 2. Daily Calling & Outreach Velocity Trend
- **Replaced Static Intake Trend**: Removed the static "Lead Intake & Registration Trend" (redundant since cohorts are pre-uploaded at the start of enrollment sessions) with the dynamic **Daily Calling & Outreach Velocity Trend**.
- **Dual Visual Granularity**:
  - **Hourly Call Velocity**: Bar chart illustrating call distribution throughout working hours (9 AM - 7 PM), highlighting peak connection windows.
  - **Daily Outreach Trend**: Area & bar charts tracking daily outbound volume, connection rates, and outcome progression over 7-day and 30-day horizons.
- **Counselor Velocity Breakdown**: Compares call velocity and connect percentages across team members.

#### 3. "Uncalled Today" Dialing Queue
- **Intra-Day Dialing Protection**: Added a dedicated **"Uncalled Today"** queue filter tab in the main Leads workspace.
- **Duplicate Dial Prevention**: Prevents multiple callers or the same caller from repeatedly dialing leads that have already received an outreach attempt earlier today.
- **Automated Queue Exclusion**: Leads dialed today (whether connected or unreachable) are immediately filtered out of the uncalled queue until the next calendar day.

---

## [v2.6.0] — 2026-10-14

### 🎯 Telecaller Focus Mode, Dynamic Dispositions & Navigation Gatekeeper
**Objective**: Build a distraction-free calling cockpit for telecallers, make call outcomes 100% dynamic and admin-configurable in SQLite, and enforce call completion gatekeeping before record switching.

#### 1. Telecaller Focus Mode Workspace (`FocusModeWorkspace.tsx`)
- **Distraction-Free Cockpit**: Streamlined, single-screen telecalling desk eliminating non-essential CRM navigation tabs for staff with the Telecaller role.
- **Next-in-Line Dialing Dock**: Highlights the next candidate in the queue with academic summary, past call attempts, and 1-click dial action.
- **Lockdown of Admin Controls**: Restricts bulk actions, schema editing, and deletion for telecaller profiles to enforce data hygiene and focus.

#### 2. Dynamic Dispositions & Composite Lead Ranking Engine
- **Database Schema Migration**:
  - `dispositions`: Dynamic table with `id`, `name`, `code`, `category`, `color`, `score`, `requires_callback`, `is_active`.
  - `sub_dispositions`: Dynamic table linking sub-reasons to parent dispositions with custom scoring.
  - `campaign_dispositions`: Many-to-many junction table binding dispositions to specific marketing campaigns.
  - `lead_scoring_policies`: Configurable policy table storing academic weights, disposition weights, attempt penalties, and high-intent thresholds.
- **REST API Endpoints**:
  - `GET / POST / PATCH / DELETE /api/dispositions`: Dynamic root outcome CRUD.
  - `POST / DELETE /api/dispositions/sub`: Sub-disposition tag management.
  - `GET / POST /api/dispositions/scoring-config`: Lead scoring formula calibration.
- **Composite Lead Ranking Algorithm**: Automatically recalculates lead scores upon every call outcome:
  $$\text{Composite Score} = (\text{Academic Score} \times W_{acad}) + (\text{Outcome Score} \times W_{disp}) - (\text{Attempts} \times P_{att})$$

#### 3. Navigation Gatekeeper & Multi-Page Auto-Advancing Stepper (`EnhancedLeadDrawer.tsx`)
- **Call Navigation Gatekeeper**: Prevents callers from skipping or switching records while a call is active until an outcome is logged.
- **Multi-Page Stepper**: Synchronized keyboard stepper (<kbd>[</kbd> / <kbd>]</kbd>) and automatic advance to the next lead upon saving an outcome across filtered and paginated datasets.

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
