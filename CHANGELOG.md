# 📋 DreamDesk CRM — Detailed Changelog & Release Notes

All notable changes, architectural enhancements, schema migrations, and feature additions for DreamDesk CRM are documented in this file.

---

## [v2.12.0] — 2026-10-28

### 🏷️ Removal of Legacy Demo Auto-Tagging & 💬 Full WhatsApp Template Management System
**Objective**: Eliminate unrequested random tags appearing on newly imported student leads caused by legacy demo migration hooks, and introduce a complete in-app WhatsApp template editing, creation, and token substitution management system.

#### 1. Root-Cause Resolution for Random Tags on Lead Upload (`src/lib/db/database.ts`)
- **Problem**: When users uploaded fresh leads without tags, an automated demo seed check (`hasAnyTags.count === 0`) evaluated to `true`, executing SQLite modulo batch queries (`WHERE id % 7 = 0`, `WHERE id % 5 = 0`, etc.) that automatically assigned demo tags (*"High Priority"*, *"Hostel Required"*, *"Scholarship Applicant"*, *"VIP Referral"*, *"Local Candidate"*) across every 5th, 7th, 11th, and 13th imported lead.
- **Fix**: Completely removed the legacy modulo update queries from `initializeSchema()`.
- **Campaign Backfill Purge**: Also eliminated the legacy `backfillLeadActivities()` and synthetic campaign/disposition backfill loop (`camp_delhi_fair`, etc.) to prevent unwanted mutations on operational data.

#### 2. WhatsApp Template In-Modal Manager (`src/components/crm/WhatsAppModal.tsx`)
- **"Edit Templates" Mode**: Counselors and admins can click the new **"Edit Templates"** gear button next to the template selector in the WhatsApp modal to switch between message delivery and template management.
- **Create & Edit Templates**: Users can select an existing template to edit (updating its Title, Category, Body, and default status) or click "+ New Template" to craft a brand-new outreach template.
- **Dynamic Variable Placeholder Pills**: Added 1-click token insertion chips directly inside the template editor:
  - `{name}` — Lead student's full name
  - `{stream}` — Preferred academic stream / program
  - `{school}` — School or previous institution
  - `{counselor_name}` — Assigned counselor / telecaller's name
  - `{callback_at}` — Scheduled follow-up time
  - `{lead_code}` — Lead identifier code
- **Real-Time Live Preview**: Modifying or switching templates updates the preview composer in real time.

#### 3. Backend Template API & Service Layer (`src/lib/services/leadsService.ts`, `src/app/api/whatsapp-templates/route.ts`)
- **`LeadsService.updateWhatsAppTemplate()`**: Added transaction-safe update routine that persists template alterations, sanitizes inputs, and handles single-default template flags.
- **RESTful Endpoints**: Implemented `PUT` and `PATCH` methods on `/api/whatsapp-templates` with schema validation and error reporting.

---

## [v2.11.0] — 2026-10-27

### 🛡️ Production Readiness, Login Redesign, Dummy Data Purge & Developer Backdoor Removal
**Objective**: Transition DreamDesk CRM from a development/demo prototype with 112,500+ generated mock leads, demo role-switchers, and public data counters into a pristine, enterprise-grade production application with strict authentication, zero dummy users, a vacuumed database, and a clean slate for real student data.

#### 1. Enterprise SaaS Login Screen Redesign (`src/app/login/page.tsx`)
- **Focused, Clean Authentication**: Replaced cluttered developer demo layout with a modern, centered SaaS login card.
- **Removed Developer Noise**: Eliminated all public counters (*"112,501 Indexed Leads"*, *"SQLite WAL Engine"*), sandbox tabs (*"Staff Sandbox"*, *"Executive Walkthrough"*), and 1-click quick-login demo profile buttons.
- **Enhanced Security Features**:
  - Interactive password show/hide eye toggle.
  - "Remember this device" state persistence.
  - End-to-end encrypted session security badge.
  - Minimalist floating theme toggle (<kbd>Sun</kbd> / <kbd>Moon</kbd>) in top right corner.
  - Clear, user-friendly inline alert messages for invalid credentials and deactivated accounts.

#### 2. Complete Database Purge & Storage Reclamation (`data/crm.db`)
- **112,501 Mock Leads & 278,771 Mock Activities Purged**: Removed all synthetic test student records, historical audit trails, mock tasks, and notifications.
- **Mock Staff Account Purge**: Removed all 6 mock staff accounts (`usr_rohit`, `usr_ananya`, `usr_vikram`, `usr_priya`, `usr_sneha`, `usr_aditya`).
- **Master Super Admin Retained**: Retained single active administrative account (`usr_admin`, `admin@dreamdesk.in`).
- **Autoincrement Sequence Reset**: Cleared `sqlite_sequence` entries for `leads`, `lead_activities`, `crm_tasks`, `user_notifications`, and `system_errors`, ensuring the first real student inquiry begins at ID #1 (`DDM-0001`).
- **SQLite Database VACUUM**: Executed SQL `VACUUM;` to rebuild the SQLite database file, reducing file size from **137.5 MB down to 248.00 KB** (99.8% disk space recovery).
- **Preserved Structural Foundations**: Retained all custom schema metadata, admissions campaigns, playbooks, disposition categories, sub-dispositions, and WhatsApp templates.

#### 3. Security Hardening & Developer Backdoor Removal
- **Hardened `/api/auth/login`**: Completely removed the `quickLogin && userId` backdoor bypass; every login strictly requires email and password verification.
- **Hardened `AuthService.authenticate`**: Removed `bypassPassword` parameter, enforcing Scrypt verification on all attempts.
- **Role Switcher Removal (`page.tsx`)**: Removed `handleSwitchUser` and the "Quick Role Switcher (Test)" menu item from the user profile dropdown.
- **Test Generation Removal**: Removed `handleGenerateSampleLeads` and "Generate Synthetic Test Data" options from `CommandCenter.tsx` and `UnifiedCommandBar.tsx`.
- **Protected Lead Generator Endpoint (`/api/leads/generate`)**: Added production environment guard returning `403 Forbidden` when `NODE_ENV === "production"`.
- **Database Schema Seed Integrity (`database.ts`)**: Updated default assignment rules and initial user seeding to reference `usr_admin`, preventing foreign key constraint violations under `PRAGMA foreign_keys = ON`.
- **Empty State Polish (`LeadsTable.tsx`)**: Replaced demo test-generation prompt with professional guidance to import student records from CSV.

#### 4. Staff Password Provisioning & Self-Service Admin Reset Modal
- **Optional Initial Password on User Creation (`TeamWorkspace.tsx`, `TeamModal.tsx`, `leadsService.ts`)**: Admins can now specify a custom initial password (min 6 characters) with show/hide toggle when registering a counselor, or leave it blank to automatically default to `password123`.
- **Admin Password Reset Modal (`TeamWorkspace.tsx`, `PATCH /api/users`)**: Added a dedicated "Password" action button on each counselor card. Admins can type a new password or click "Generate Quick Password" (`Desk@4821`), copy it in 1 click, and update credentials.
- **Session Purging on Password Reset (`AuthService.resetPassword`)**: When a password is reset, all existing active browser sessions for that user are immediately terminated, forcing re-authentication with the new password.
- **Audit Logging**: Every password reset generates an immutable audit entry in `activity_logs`.

---

## [v2.10.0] — 2026-10-27

### 🔒 Enterprise Student Contact Security, Phone Masking & On-Demand Dialer Activation
**Objective**: Eliminate student data theft and lead harvesting by strictly masking contact numbers from the frontend for Counselors and Telecallers, while maintaining a 100% seamless click-to-dial workflow, server-assisted WhatsApp launching, and audited administrative unmasking.

#### 1. Strict Backend Phone Sanitization (`phoneMasker.ts`, `leadsService.ts`, `tasks/route.ts`)
- **Backend Masking**: Sanitizes phone numbers server-side in all lead and task list endpoints (`/api/leads`, `/api/leads/[id]`, `/api/tasks`) for counselors and telecallers. Raw contact digits are never transmitted over the network or stored in browser state, eliminating DevTools harvesting.
- **Verification Format (`+91 ••••• ••421`)**: Preserves the country prefix and trailing 3 digits while replacing middle digits with bullets (`•`), enabling staff to verbally verify candidate identity (*"Am I speaking with the applicant ending in 421?"*) without exposing full contact numbers.
- **Safe Lead Edits**: If a staff member saves a lead profile with the masked phone string unchanged, the backend preserves the existing raw phone number without overwriting it with bullets.

#### 2. On-Demand Click-to-Dial Intent (`/api/leads/[id]/call-intent`)
- **Dialer Intent Endpoint**: When a counselor clicks **"Call Student"** or presses hotkey <kbd>c</kbd>, the client requests a secure one-time dial URI (`tel:+91...`).
- **Immediate Device Native Dialer Launch**: Triggers the device's native dialer (Phone Link on Windows, FaceTime/Calls on macOS, Android/iOS dialer, or softphones).
- **Automated Outreach Audit**: Immediately writes an `Outbound Call Initiated` activity log in SQLite and starts the active call timer with disposition selection intact.

#### 3. Server-Assisted WhatsApp Launch (`/api/leads/[id]/whatsapp-intent`)
- **Protected Messaging Link**: Generates an authenticated `https://wa.me/91...?text=...` launch URL on demand.
- **Template Variable Interpolation**: Replaces tokens (`{name}`, `{stream}`, `{callback_at}`) and opens WhatsApp Web/Desktop in a new tab without exposing raw numbers in the CRM UI.
- **Audit Logging**: Automatically records WhatsApp outreach activities in the student timeline.

#### 4. Role-Based Admin Unmasking (`/api/leads/[id]/unmask`)
- **Supervisor Reveal Action**: Admins and Team Leads can click a **"Reveal"** eye button next to the masked number in the lead drawer.
- **Mandatory Compliance Audit Trail**: Every unmask action creates a permanent security audit record (*"[Admin Name] unmasked student phone number for compliance review"*).
- **Counselor Lockdown**: Non-manager requests to the unmask endpoint are rejected with `403 Forbidden`.

#### 5. CSV Export Protection
- **Masked Staff Exports**: Counselors and Telecallers downloading CSV lead sheets receive spreadsheets with masked phone numbers (`+91 ••••• ••421`).
- **Unmasked Admin Exports**: Admins and Team Leads retain the ability to export full contact information for institutional reporting.
- **Copy Restrictions**: Disables/removes the "Copy Phone" button in the lead drawer for counselors.

---

## [v2.9.0] — 2026-10-27

### 🚀 Resilient Lead Allocation Cockpit, SQLite Concurrency Hardening & System-Wide Error Handling
**Objective**: Build a real, non-superficial progress cockpit during bulk lead allocation, eliminate intermittent database lock errors (`SQLITE_BUSY`) and proxy timeouts (HTTP 504) on production servers, and establish an awesome 3-layer system-wide error handling architecture.

#### 1. Live Functional Allocation Cockpit (`BulkAssignModal.tsx`, `batchRunner.ts`)
- **Telemetry-Driven Progress Bar**: 100% accurate visual progress bar tied to committed SQLite chunks (never fake timer simulations).
- **Speed & Dynamic ETA**: Displays real-time allocation throughput (e.g. `380 leads/s`) and dynamic ETA countdown.
- **Counselor Workload Allocation Badges**: Live counters update dynamically per counselor (e.g. `Priya Patel +250`, `Rohit Sharma +250`).
- **Policy Lock Preservation Counter**: Displays leads protected from reassignment under the 7-day anti-poaching policy (e.g. `42 locked`).
- **Pause & Emergency Stop**: Allows operators to pause or safely cancel midway without losing already-committed batches.
- **Interactive Batch Error Recovery**: If a transient network glitch occurs, presents an inline recovery card with `[Retry Batch]`, `[Skip]`, or `[Finish Partial]`.

#### 2. SQLite Concurrency & Lock Resilience (`database.ts`, `leadsService.ts`)
- **SQLite Busy Timeout (15,000ms)**: Added `{ timeout: 15000 }` and `PRAGMA busy_timeout = 15000`, eliminating instantaneous `SQLITE_BUSY: database is locked` exceptions during concurrent operations.
- **Automatic Exponential Backoff Decorator (`withDbRetry`)**: Retries transient locks up to 3 times with randomized jitter before failing.
- **N+1 Query Loop Optimization**: Replaced individual lead check loops in `policyService.ts` with set-based query chunking, dropping bulk policy validation time from 1,200ms to <8ms across 5,000 leads.
- **Micro-Chunking (350 Leads/Batch)**: Client-orchestrated chunking prevents HTTP 504 Gateway Timeouts by keeping write transactions under 45ms.
- **Fast Target Lead IDs Endpoint (`/api/leads/target-ids`)**: Resolves filtered query matches into lead ID arrays in <15ms without transferring heavy record payloads.

#### 3. 3-Layer System-Wide Error Handling Architecture
- **Layer 1 (Database & Engine)**: Persistent `system_errors` table with stack trace capture, request metadata, and automated 1,000-row pruning.
- **Layer 2 (Network & API Safety - `apiClient.ts`)**: Content-Type validation and error page parsing protection; handles Nginx/Cloudflare HTML 502/504 error pages without crashing on `res.json()`.
- **Layer 3 (UI Boundaries - `WorkspaceErrorBoundary.tsx`, `GlobalErrorBoundary.tsx`)**:
  - **Isolated Workspace Error Boundaries**: Each CRM workspace (Dashboard, Pipeline, Campaigns, Playbook, Dynamic Schema, Tasks, Team, Import, Activity, Policies) is isolated. If a single view throws an exception, only that view shows a retry banner—the rest of the app remains fully functional.
  - **Global Crash Guard**: Root error boundary with diagnostic copy and stack recovery.
  - **Floating Network Status Pill (`NetworkStatusPill.tsx`)**: Live indicator alerting staff when network connectivity drops.
- **Admin Diagnostics & SQLite WAL Health Drawer (`SystemDiagnosticsDrawer.tsx`, `/api/diagnostics`)**:
  - Accessible via the bottom-left sidebar status indicator.
  - Displays database file size, WAL buffer size, active busy timeout, and recent server error logs.

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
