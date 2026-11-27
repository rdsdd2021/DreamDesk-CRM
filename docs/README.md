# 📚 DreamDesk CRM — Comprehensive Feature Guides & Operational Manuals

Welcome to the official documentation and operational handbook for **DreamDesk CRM**.  
This repository of guides covers all architectural foundations, enterprise features, governance policies, and operator workflows with real-world higher-education admissions use cases.

---

## 📑 Documentation Index

| # | Guide | Primary Focus | Audience |
|---|---|---|---|
| **01** | [**Lead Allocation & Distribution Engine**](./01_LEAD_ALLOCATION_AND_DISTRIBUTION.md) | Named assignment batches, smart filter claims, caller reports, reassigned handoff & priority rules | Admins, Team Leads, Counselors |
| **02** | [**7-Day Counselor Ownership Policy & Anti-Poaching Governance**](./02_COUNSELOR_OWNERSHIP_POLICY.md) | Call locks, interaction protection, batch validation, overrides & audit trails | Admins, Team Leads |
| **03** | [**Prioritized Bulk Task Engine & Daily Team Ops**](./03_TASK_ENGINE_AND_NOTIFICATIONS.md) | Daily Team Floor, Check-in/EOD, Broadcasts, Android Notification Actions, SOP Playbooks & SLAs | All Staff |
| **04** | [**Smart Executive Journey & Multi-Density Timeline**](./04_EXECUTIVE_JOURNEY_AND_TIMELINE.md) | 4-card briefing strip, 2-layer timeline compaction (bundles & stacks), detailed view & quick notes | Counselors, Telecallers, TLs |
| **05** | [**Bulk Operations Suite & Background Jobs**](./05_BULK_OPERATIONS_SUITE.md) | Multi-select dock, non-blocking server background jobs, crash recovery, cancel & task log console | Admins, Team Leads |
| **06** | [**Admissions Playbook, Smart Outcomes & Telecalling Framework**](./06_CALL_DISPOSITIONS_AND_CALLBACKS.md) | 4 Reaction Trays, friction-free recipe popup, SOP trigger rules, composite scoring & stage locks | Counselors, Telecallers, TLs |
| **07** | [**Kapso WhatsApp, Multi-Contact Routing & Communication Drawer**](./07_WHATSAPP_AND_COMMUNICATION_DRAWER.md) | Integrated Kapso WhatsApp Inbox, Meta Template Studio, 24h window, Call/IVR vs WA routing & swipe navigation | Counselors, Telecallers |
| **08** | [**Dynamic Schema Studio & Custom Attributes**](./08_SCHEMA_STUDIO_AND_CUSTOM_ATTRIBUTES.md) | Zero-migration JSON attributes, phone masking, Template Studio variable suggestions & faceted filters | Super Admins |
| **09** | [**Data Import, E.164 Validation, Streaming 60MB+ CSVs & Deduplication**](./09_DATA_IMPORT_AND_DEDUPLICATION.md) | Streaming multipart CSV ingestion, E.164 normalization/rejection, Skip/Merge/Allow & multi-contact dedup | Admins, Operations |
| **10** | [**RBAC, Team Lead Pods, Geolocation & User Management**](./10_RBAC_SECURITY_AND_USER_MANAGEMENT.md) | 5-tier role hierarchy, Team Lead pod assignment, view/search guards & session security | Super Admins, Compliance |
| **11** | [**Executive Analytics, Outreach Velocity & Reporting**](./11_ANALYTICS_DASHBOARD_AND_REPORTING.md) | Hourly/daily call velocity trends, uncalled today queue, counselor leaderboard & 1-click CSV reports | Leadership, Admins, TLs |
| **12** | [**Productivity Hotkeys & Operator Fast-Paths**](./12_KEYBOARD_SHORTCUTS_AND_FAST_PATHS.md) | Keyboard controls (<kbd>c</kbd>, <kbd>w</kbd>, <kbd>j</kbd>/<kbd>k</kbd>, <kbd>[</kbd>/<kbd>]</kbd>), CmdK command center & 100-call/day workflow | All Users |

---

## 🏛️ System Architecture Overview

DreamDesk CRM is architected for zero-latency higher-education operations. It runs on an embedded **SQLite Write-Ahead Logging (WAL)** engine with a 64MB memory cache, achieving sub-30ms facet compilation across 500,000+ student records.

```mermaid
graph TD
    User([Staff User / Browser]) <-->|Keyboard Shortcuts & CmdK| UI[Next.js 16 Web Client]
    UI <-->|REST API Endpoints| Middleware[Auth & RBAC Middleware]
    Middleware <--> Services[Service Layer]
    
    subgraph Core Domain Services
        Services --> AuthService[AuthService: Scrypt + Session Purge]
        Services --> LeadsService[LeadsService: E.164, Facets & Dedup]
        Services --> PolicyService[PolicyService: 7-Day Anti-Poaching Lock]
        Services --> TasksService[TasksService: SLA Engine & Broadcasts]
        Services --> KapsoService[KapsoWhatsappService: Inbox & Templates]
    end

    Services <-->|Sub-30ms Dynamic Queries| DB[(SQLite 3 WAL Engine / 64MB Cache)]
    DB --- T1[users & sessions]
    DB --- T2[leads & raw_attributes JSON]
    DB --- T3[crm_tasks, broadcasts & notifications]
    DB --- T4[lead_activities & activity_logs]
    DB --- T5[whatsapp_conversations, messages & templates]
```

---

## 👥 Role Matrix & Workspace Scopes

| Role | Leads Visibility | Management Capabilities | Allowed Tabs & Views |
|---|---|---|---|
| **Super Admin** | Institutional (All 500k+ Leads) | Full system access: Users, Schema, Policies, Deletions, Audit Logs, Playbooks | All Workspaces: Leads, Focus Mode, Tasks, Pipeline, Dashboard, Campaigns, Playbook Studio, Schema Studio, Team, Import, Activity, Policies |
| **Team Lead** | Institutional (All 500k+ Leads) | Auto-Distribution, Quota Balancing, Campaigns, Playbook Recipes, Policy Overrides | Leads, Focus Mode, Tasks, Pipeline, Dashboard, Campaigns, Playbook Studio, Team, Import, Activity, Policies |
| **Senior Counselor** | Private Assigned Only | Follow-up Queues, Outcome Logging, Priority Callbacks, WhatsApp | Leads, Tasks, Pipeline |
| **Counselor** | Private Assigned Only | Consultation Logging, WhatsApp Drawer, Direct Dialing | Leads, Tasks, Pipeline |
| **Telecaller** | Private Assigned Only | Fast Focus Mode Cockpit, Uncalled Today Queue, Fast Reaction Trays, Callbacks | Focus Mode, Leads, Tasks, Pipeline |

---

## 💡 Quick Tips for New Operators

1. **Global Search & Command Bar**: Press <kbd>Ctrl</kbd> + <kbd>K</kbd> (or <kbd>⌘</kbd> + <kbd>K</kbd>) anywhere to jump between views, search students, or trigger bulk actions.
2. **Keyboard Calling**: Press <kbd>j</kbd> and <kbd>k</kbd> to step through student records, and hit <kbd>c</kbd> to call or <kbd>w</kbd> to open WhatsApp.
3. **Sequential Drawer Navigation**: Press <kbd>[</kbd> and <kbd>]</kbd> while viewing a student's profile drawer to move to previous and next students without closing the drawer.
4. **Instant Filter Toggle**: Press <kbd>f</kbd> to toggle the left faceted filter sidebar.
