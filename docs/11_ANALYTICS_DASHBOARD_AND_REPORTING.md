# 📊 Executive Analytics Dashboard & Reporting Guide

This guide covers the **Multi-Dimensional Analytics Dashboard & Reporting Suite** in DreamDesk CRM, designed to provide institutional leadership with real-time visibility into admissions velocity, counselor productivity, and campaign conversion rates.

---

## 1. Feature Overview & Architecture

Higher-education marketing and admissions involve multi-channel campaigns (Google Ads, Facebook, school expos, alumni referrals). Leadership must know:
- Which marketing channels produce paying enrollments vs dead inquiries?
- Which counselors maintain the highest consultation velocity and conversion ratios?
- Where are students dropping out in the admissions funnel?

DreamDesk CRM features an **Executive Analytics Dashboard** powered by sub-30ms aggregation queries across 500,000+ student records:

```mermaid
graph TD
    DB[(SQLite 3 Database: 500k+ Records)] --> AggEngine[Dynamic Analytics Aggregation Engine]
    
    Filters[Multi-Dimensional Filter Bar: Date Presets, Counselors, Campaigns, Streams] --> AggEngine

    AggEngine --> KPI[1. Executive KPI Summary Cards: Total Inflow, Conversion Rate, Enrolled, Revenue]
    AggEngine --> Funnel[2. Visual Admissions Pipeline Funnel: New -> Contacted -> Interested -> Admitted]
    AggEngine --> Velocity[3. Counselor Workload & Velocity Leaderboard]
    AggEngine --> Channel[4. Marketing Campaign ROI & Attribution Chart]
    AggEngine --> Demographics[5. Academic Streams & Board Breakdown]

    AggEngine --> CSV[1-Click Filtered CSV Export: Immediate Management Reports]
```

---

## 2. Multi-Dimensional Filter Controls

The dashboard features multi-dimensional filtering, allowing management to slice analytics datasets:

### A. Date Presets & Custom Date Ranges
- 📅 **Today** • **Yesterday** • **Last 7 Days** • **Last 30 Days** • **This Quarter** • **This Year**
- 📆 **Custom Date Picker**: Precise start and end date boundaries down to the day.

### B. Counselor Workload Scope
- Filter by individual counselors or compare team cohorts against each other.

### C. Campaign Attribution
- Filter by specific marketing initiatives (e.g. *Delhi Fair 2026*, *Google Search STEM*, *Direct Walk-ins*).

### D. Academic Stream & Board Filters
- Segment performance by academic board (CBSE, ICSE, State Board) and discipline (Engineering, Medical, Commerce, Arts).

---

## 3. Core Analytics Visualizations

### 1. Executive KPI Metrics Cards
- **Total Outreach**: Total calls and contact attempts logged within the selected period.
- **Connection Rate**: Percentage of dialed calls that connected with students or parents.
- **Conversion Velocity**: Percentage of inquiries successfully converted to `Admitted` status.
- **Active Pipeline**: Total leads currently in `Interested` or `Follow-up` stages.
- **Average Response Latency**: Time elapsed between lead generation and first logged call.

### 2. Daily Calling & Outreach Velocity Trend
*(Replaced the legacy static lead intake trend, as student cohorts are uploaded in bulk at the start of enrollment sessions).*
- **Hourly Call Velocity (Bar Chart)**:
  - Tracks call volume distribution across working hours (9:00 AM to 7:00 PM).
  - Highlights peak candidate connection windows (typically 11:30 AM–1:00 PM and 4:30 PM–6:30 PM).
- **Daily Outreach & Connect Trend (Area Chart)**:
  - Visualizes daily call throughput, connected conversations, and positive outcome progression across 7-day and 30-day windows.
- **Disposition Mix**: Real-time breakdown of Progressing vs Follow-up vs Unreachable vs Dropped outcomes.

### 3. Admissions Pipeline Funnel
Interactive funnel chart tracking candidate progression across admissions milestones:
1. `New Inquiry` (100%)
2. `Contacted` (78%)
3. `Interested - High Intent` (42%)
4. `Application Submitted` (26%)
5. `Admitted / Fee Paid` (18%)

### 4. Counselor Throughput & Velocity Leaderboard
Comparative staff performance table:
- Calls Logged per Day & Hour
- Average Call Duration
- Connection Rate (%)
- Progressing Outcomes Generated
- Overdue Callback Count

### 5. Marketing Campaign Conversion Chart
Bar and pie charts displaying:
- Inquiry Volume per Campaign
- Confirmed Enrollments per Campaign
- Cost per Enrolled Student (ROI)

---

## 4. Real-Time Data Reflection & The "Uncalled Today" Queue

### A. Real-Time SQLite Activity Synchronization
A core technical improvement in DreamDesk CRM is immediate, zero-lag query execution:
- Every call outcome logged by a telecaller or counselor in `EnhancedLeadDrawer` or `FocusModeWorkspace` is recorded in SQLite with an immediate transaction commit.
- Dashboard queries aggregate fresh `lead_activities` directly, ensuring analytics cards, velocity charts, and counselor leaderboards reflect calls the instant they happen.

### B. The "Uncalled Today" Dialing Queue
To ensure telecallers don't repeatedly dial the same candidate multiple times in a single day:
- A dedicated **"Uncalled Today"** queue tab is available in the main workspace and Speed Dialer.
- Evaluates `last_attempt_at` and logs from today's calendar date:
  - If a student received a call attempt today (whether connected, busy, or unanswered), they are immediately excluded from the uncalled queue.
  - Telecallers working through the queue are guaranteed fresh candidates who have not yet been contacted today.

---

## 5. 1-Click CSV Export & Reporting

*Endpoint*: `GET /api/analytics/report`

At any time, leadership can download a customized admissions report:
1. Apply desired filters (e.g., *Last 30 Days • Engineering • Campaign: Google Ads*).
2. Click **"Export CSV"** in the upper right corner.
3. The server generates a clean, formatted CSV with all student details, consultation remarks, and counselor attributions in under 1 second.

---

## 6. 🏫 Real-World Use Case Scenarios

### Scenario A: Weekly Executive Dean's Review
- **Context**: The Dean of Admissions meets with the Chancellor every Monday at 9:00 AM to review progress against enrollment targets.
- **Workflow**:
  1. Opens the **Analytics Dashboard**.
  2. Selects date preset: **Last 7 Days**.
  3. Reviews total inquiries (1,240) and confirmed admissions (84).
  4. Clicks **Export CSV** to generate the executive report for the Chancellor's binder.
- **Result**: Immediate data-backed strategic visibility without waiting for manual Excel preparation.

### Scenario B: Counselor Incentive & Bonus Calculations
- **Context**: End-of-month counselor commission distribution based on conversion rate and call volume.
- **Workflow**:
  1. Team Lead filters by date: **This Month**.
  2. Inspects the **Counselor Throughput Leaderboard**.
  3. Counselor Sneha Rao ranks #1 with 480 calls logged and a 22.4% conversion rate.
- **Result**: Transparent, tamper-evident performance ranking.

---

## 7. ⚙️ Technical Engine Reference

- **Aggregations**: Calculated directly inside optimized SQLite indexed queries with memory caching.
- **Response Latency**: <30ms query time across 500,000+ lead records.
- **Recharts Integration**: Responsive SVG/Canvas rendering with tooltips and smooth transitions.
