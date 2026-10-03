import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const isReset = process.argv.includes("--reset") || process.argv.includes("-r");
const targetCount = parseInt(process.env.SEED_COUNT || "2500", 10);

const dataDir = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "crm.db");
console.log(`\n======================================================`);
console.log(`🚀 DreamDesk CRM - Database Seeder`);
console.log(`   Database Path: ${dbPath}`);
console.log(`   Reset Mode:    ${isReset ? "ENABLED (Rebuilding DB)" : "DISABLED (Append / Safe Seed)"}`);
console.log(`   Target Leads:  ${targetCount}`);
console.log(`======================================================\n`);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

if (isReset) {
  console.log("⚠️  Resetting database tables...");
  db.exec(`
    DROP TABLE IF EXISTS activity_logs;
    DROP TABLE IF EXISTS leads;
    DROP TABLE IF EXISTS campaign_dispositions;
    DROP TABLE IF EXISTS assignment_rules;
    DROP TABLE IF EXISTS whatsapp_templates;
    DROP TABLE IF EXISTS saved_views;
    DROP TABLE IF EXISTS sub_dispositions;
    DROP TABLE IF EXISTS dispositions;
    DROP TABLE IF EXISTS campaigns;
    DROP TABLE IF EXISTS lead_schema_meta;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
  `);
  console.log("✓ Old tables dropped successfully.\n");
}

// 1. Create Core Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'counselor',
    status TEXT NOT NULL DEFAULT 'active',
    avatar_color TEXT DEFAULT '#3b82f6',
    password_hash TEXT,
    salt TEXT,
    last_login_at DATETIME,
    last_login_ip TEXT,
    last_login_location TEXT,
    deactivated_at DATETIME,
    deactivated_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip_address TEXT,
    location TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS lead_schema_meta (
    id TEXT PRIMARY KEY,
    key_name TEXT UNIQUE NOT NULL,
    display_label TEXT NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'string',
    is_filterable INTEGER NOT NULL DEFAULT 1,
    filter_type TEXT NOT NULL DEFAULT 'faceted',
    is_visible INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    channel TEXT NOT NULL DEFAULT 'General',
    target_audience TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dispositions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL DEFAULT 'neutral',
    color TEXT DEFAULT '#3b82f6',
    score INTEGER DEFAULT 0,
    requires_callback INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sub_dispositions (
    id TEXT PRIMARY KEY,
    disposition_id TEXT NOT NULL REFERENCES dispositions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sub_disp_parent ON sub_dispositions(disposition_id);

  CREATE TABLE IF NOT EXISTS campaign_dispositions (
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    disposition_id TEXT REFERENCES dispositions(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, disposition_id)
  );

  CREATE TABLE IF NOT EXISTS saved_views (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filters TEXT NOT NULL DEFAULT '{}',
    search TEXT DEFAULT '',
    visible_columns TEXT,
    sort_by TEXT DEFAULT 'created_at',
    sort_order TEXT DEFAULT 'desc',
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    template_body TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assignment_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    criteria_field TEXT NOT NULL,
    criteria_value TEXT NOT NULL,
    assigned_to TEXT REFERENCES users(id) ON DELETE CASCADE,
    is_active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_code TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    assigned_at DATETIME,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    disposition_id TEXT REFERENCES dispositions(id) ON DELETE SET NULL,
    sub_disposition_id TEXT REFERENCES sub_dispositions(id) ON DELETE SET NULL,
    callback_at DATETIME,
    raw_attributes TEXT NOT NULL DEFAULT '{}',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name);
  CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_leads_disposition ON leads(disposition_id);
  CREATE INDEX IF NOT EXISTS idx_leads_sub_disposition ON leads(sub_disposition_id);
  CREATE INDEX IF NOT EXISTS idx_leads_callback ON leads(callback_at);

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    affected_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    performed_by TEXT DEFAULT 'Admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
`);

console.log("✓ Schema and indices verified.");

// Helper for hashing password123
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

// 2. Seed Default Staff Accounts
const { hash: defaultHash, salt: defaultSalt } = hashPassword("password123");

const defaultUsers = [
  { id: "usr_admin", name: "Super Admin", email: "admin@dreamdesk.in", role: "admin", status: "active", avatar_color: "#4f46e5" },
  { id: "usr_vikram", name: "Vikram Malhotra", email: "vikram.m@dreamdesk.in", role: "team_lead", status: "active", avatar_color: "#16a34a" },
  { id: "usr_rohit", name: "Rohit Sharma", email: "rohit.sharma@dreamdesk.in", role: "senior_counselor", status: "active", avatar_color: "#2563eb" },
  { id: "usr_ananya", name: "Ananya Verma", email: "ananya.v@dreamdesk.in", role: "counselor", status: "active", avatar_color: "#db2777" },
  { id: "usr_priya", name: "Priya Patel", email: "priya.p@dreamdesk.in", role: "counselor", status: "active", avatar_color: "#ea580c" },
  { id: "usr_sneha", name: "Sneha Rao", email: "sneha.rao@dreamdesk.in", role: "counselor", status: "active", avatar_color: "#9333ea" },
  { id: "usr_aditya", name: "Aditya Roy", email: "aditya.roy@dreamdesk.in", role: "telecaller", status: "active", avatar_color: "#0891b2" },
];

const insertUser = db.prepare(`
  INSERT INTO users (id, name, email, role, status, avatar_color, password_hash, salt)
  VALUES (@id, @name, @email, @role, @status, @avatar_color, @password_hash, @salt)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    email=excluded.email,
    role=excluded.role,
    password_hash=COALESCE(users.password_hash, excluded.password_hash),
    salt=COALESCE(users.salt, excluded.salt)
`);

for (const u of defaultUsers) {
  insertUser.run({ ...u, password_hash: defaultHash, salt: defaultSalt });
}
console.log(`✓ Seeded ${defaultUsers.length} staff users (Default password: password123).`);

// 3. Seed Dynamic Schema Meta
const defaultHeaders = [
  { id: "meta_stream", key_name: "stream", display_label: "Stream / Course", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 1 },
  { id: "meta_school", key_name: "school", display_label: "School / College", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 2 },
  { id: "meta_board", key_name: "board", display_label: "Education Board", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 3 },
  { id: "meta_city", key_name: "city", display_label: "City / Location", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 4 },
  { id: "meta_score", key_name: "score", display_label: "Percentage / Score", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 5 },
  { id: "meta_parent_phone", key_name: "parent_phone", display_label: "Parent Contact", data_type: "string", is_filterable: 0, filter_type: "search", is_visible: 1, display_order: 6 },
  { id: "meta_preferred_branch", key_name: "preferred_branch", display_label: "Preferred Branch", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 7 },
  { id: "meta_jee_percentile", key_name: "jee_percentile", display_label: "JEE Percentile", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 8 },
];

const insertMeta = db.prepare(`
  INSERT INTO lead_schema_meta (id, key_name, display_label, data_type, is_filterable, filter_type, is_visible, display_order)
  VALUES (@id, @key_name, @display_label, @data_type, @is_filterable, @filter_type, @is_visible, @display_order)
  ON CONFLICT(key_name) DO UPDATE SET display_label=excluded.display_label, is_filterable=excluded.is_filterable
`);
for (const h of defaultHeaders) insertMeta.run(h);
console.log(`✓ Seeded ${defaultHeaders.length} dynamic lead schema fields.`);

// 4. Seed Campaigns
const defaultCampaigns = [
  {
    id: "camp_delhi_fair",
    name: "Delhi Mega Education Fair 2026",
    description: "On-ground student counseling expo at Pragati Maidan",
    channel: "In-Person Expo",
    target_audience: "Class 12 Passing Out & JEE/NEET Aspirants",
    status: "active",
  },
  {
    id: "camp_kota_drive",
    name: "Kota Coaching & STEM Drive",
    description: "Direct outreach across prominent Kota coaching institutes",
    channel: "Outreach Drive",
    target_audience: "JEE Advanced & NEET Repeaters",
    status: "active",
  },
  {
    id: "camp_cbse_outreach",
    name: "CBSE & ICSE School Direct Connect",
    description: "Institutional partnerships and high school career workshops",
    channel: "School Partnerships",
    target_audience: "Top tier CBSE/ICSE High Schools in Metro Cities",
    status: "active",
  },
  {
    id: "camp_digital_portal",
    name: "Online Admissions 2026 Portal",
    description: "Google Search, Meta Ads, and Organic Website Inquiries",
    channel: "Digital & Social",
    target_audience: "All-India Engineering & Commerce Applicants",
    status: "active",
  },
];

const insertCamp = db.prepare(`
  INSERT INTO campaigns (id, name, description, channel, target_audience, status)
  VALUES (@id, @name, @description, @channel, @target_audience, @status)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, channel=excluded.channel
`);
for (const c of defaultCampaigns) insertCamp.run(c);
console.log(`✓ Seeded ${defaultCampaigns.length} campaigns.`);

// 5. Seed Dispositions
const defaultDispositions = [
  { id: "disp_adm_filled", name: "Admission Form Submitted", code: "ADM_SUBMITTED", category: "positive", color: "#10b981", score: 100, requires_callback: 0, display_order: 1 },
  { id: "disp_couns_booked", name: "Counseling Session Booked", code: "COUNS_BOOKED", category: "positive", color: "#059669", score: 85, requires_callback: 1, display_order: 2 },
  { id: "disp_high_intent", name: "Interested - High Intent", code: "INT_HIGH", category: "positive", color: "#3b82f6", score: 70, requires_callback: 1, display_order: 3 },
  { id: "disp_stall_visited", name: "Stall Visited / Brochure Given", code: "VISITED_STALL", category: "positive", color: "#06b6d4", score: 60, requires_callback: 0, display_order: 4 },
  { id: "disp_cb_requested", name: "Callback Requested", code: "CB_REQ", category: "neutral", color: "#f59e0b", score: 40, requires_callback: 1, display_order: 5 },
  { id: "disp_followup_needed", name: "Follow-up Needed", code: "FOLLOW_UP", category: "neutral", color: "#8b5cf6", score: 30, requires_callback: 1, display_order: 6 },
  { id: "disp_parent_pending", name: "Parent Discussion Pending", code: "PARENT_PENDING", category: "neutral", color: "#d97706", score: 25, requires_callback: 1, display_order: 7 },
  { id: "disp_rnr", name: "Ringing - No Response", code: "RNR", category: "unreachable", color: "#f97316", score: 10, requires_callback: 1, display_order: 8 },
  { id: "disp_busy", name: "Busy / Call Cut", code: "BUSY", category: "unreachable", color: "#ea580c", score: 5, requires_callback: 1, display_order: 9 },
  { id: "disp_switched_off", name: "Switched Off / Network Issue", code: "SWITCH_OFF", category: "unreachable", color: "#fb923c", score: 5, requires_callback: 1, display_order: 10 },
  { id: "disp_not_interested", name: "Not Interested", code: "NOT_INT", category: "negative", color: "#ef4444", score: -20, requires_callback: 0, display_order: 11 },
  { id: "disp_joined_other", name: "Joined Another College", code: "JOINED_OTHER", category: "negative", color: "#dc2626", score: -50, requires_callback: 0, display_order: 12 },
  { id: "disp_invalid_num", name: "Invalid / Wrong Number", code: "INVALID_NUM", category: "negative", color: "#94a3b8", score: -100, requires_callback: 0, display_order: 13 },
  { id: "disp_dnd", name: "Do Not Call (DND)", code: "DND", category: "negative", color: "#64748b", score: -100, requires_callback: 0, display_order: 14 },
];

const insertDisp = db.prepare(`
  INSERT INTO dispositions (id, name, code, category, color, score, requires_callback, display_order)
  VALUES (@id, @name, @code, @category, @color, @score, @requires_callback, @display_order)
  ON CONFLICT(code) DO UPDATE SET name=excluded.name, category=excluded.category, color=excluded.color
`);
for (const d of defaultDispositions) insertDisp.run(d);

const linkStmt = db.prepare(`INSERT OR IGNORE INTO campaign_dispositions (campaign_id, disposition_id) VALUES (?, ?)`);
for (const c of defaultCampaigns) {
  for (const d of defaultDispositions) linkStmt.run(c.id, d.id);
}
console.log(`✓ Seeded ${defaultDispositions.length} dispositions and campaign links.`);

// 6. Seed Sub-Dispositions
const defaultSubDispositions = [
  { id: "sub_fee_paid", disposition_id: "disp_adm_filled", name: "Registration Fee Paid", code: "ADM_FEE_PAID", score: 100, display_order: 1 },
  { id: "sub_docs_pending", disposition_id: "disp_adm_filled", name: "Documents Verification In-Progress", code: "ADM_DOCS_VERIF", score: 90, display_order: 2 },
  { id: "sub_provisional", disposition_id: "disp_adm_filled", name: "Provisional Letter Issued", code: "ADM_PROVISIONAL", score: 95, display_order: 3 },
  { id: "sub_campus_visit", disposition_id: "disp_high_intent", name: "Campus Visit Scheduled", code: "INT_CAMPUS_VISIT", score: 85, display_order: 1 },
  { id: "sub_fee_inquiry", disposition_id: "disp_high_intent", name: "Fee Structure & Installments Shared", code: "INT_FEE_STRUCT", score: 75, display_order: 2 },
  { id: "sub_scholarship", disposition_id: "disp_high_intent", name: "Scholarship Test Registered", code: "INT_SCHOLARSHIP", score: 80, display_order: 3 },
  { id: "sub_parent_call", disposition_id: "disp_high_intent", name: "Parent Discussion Arranged", code: "INT_PARENT_TALK", score: 70, display_order: 4 },
  { id: "sub_couns_online", disposition_id: "disp_couns_booked", name: "Google Meet / Video Session", code: "COUNS_ONLINE", score: 85, display_order: 1 },
  { id: "sub_couns_campus", disposition_id: "disp_couns_booked", name: "In-Person Center Counseling", code: "COUNS_CAMPUS", score: 90, display_order: 2 },
  { id: "sub_cb_class", disposition_id: "disp_cb_requested", name: "Student Attending School / Coaching", code: "CB_IN_CLASS", score: 40, display_order: 1 },
  { id: "sub_cb_evening", disposition_id: "disp_cb_requested", name: "Call After 6:00 PM (Evening)", code: "CB_EVENING", score: 45, display_order: 2 },
  { id: "sub_cb_weekend", disposition_id: "disp_cb_requested", name: "Call on Saturday / Sunday", code: "CB_WEEKEND", score: 35, display_order: 3 },
  { id: "sub_fu_brochure", disposition_id: "disp_followup_needed", name: "Reviewing Syllabus / Brochure", code: "FU_BROCHURE", score: 35, display_order: 1 },
  { id: "sub_fu_comparing", disposition_id: "disp_followup_needed", name: "Comparing Multiple Institutes", code: "FU_COMPARING", score: 30, display_order: 2 },
  { id: "sub_fu_board_results", disposition_id: "disp_followup_needed", name: "Awaiting Board / Exam Results", code: "FU_RESULTS", score: 30, display_order: 3 },
  { id: "sub_ni_other_coll", disposition_id: "disp_not_interested", name: "Enrolled in Another Institute", code: "NOT_INT_OTHER_COLL", score: -20, display_order: 1 },
  { id: "sub_ni_budget", disposition_id: "disp_not_interested", name: "Budget Constraint / Fee High", code: "NOT_INT_BUDGET", score: -20, display_order: 2 },
  { id: "sub_ni_diff_course", disposition_id: "disp_not_interested", name: "Opted for Different Stream", code: "NOT_INT_DIFF_STREAM", score: -20, display_order: 3 },
  { id: "sub_ni_distance", disposition_id: "disp_not_interested", name: "Location / Distance Issue", code: "NOT_INT_DISTANCE", score: -20, display_order: 4 },
  { id: "sub_rnr_1", disposition_id: "disp_rnr", name: "Attempt 1 (No Answer)", code: "RNR_ATTEMPT_1", score: 10, display_order: 1 },
  { id: "sub_rnr_2", disposition_id: "disp_rnr", name: "Attempt 2 (No Answer)", code: "RNR_ATTEMPT_2", score: 10, display_order: 2 },
  { id: "sub_rnr_3", disposition_id: "disp_rnr", name: "Attempt 3+ Unresponsive", code: "RNR_ATTEMPT_3", score: 5, display_order: 3 },
];

const insertSubDisp = db.prepare(`
  INSERT OR IGNORE INTO sub_dispositions (id, disposition_id, name, code, score, display_order)
  VALUES (@id, @disposition_id, @name, @code, @score, @display_order)
`);
for (const s of defaultSubDispositions) insertSubDisp.run(s);
console.log(`✓ Seeded ${defaultSubDispositions.length} two-level sub-dispositions.`);

// 7. Seed WhatsApp Templates & Routing Rules
const defaultTpls = [
  {
    id: "tpl_welcome",
    name: "Welcome & Admission Brochure",
    category: "Introduction",
    template_body: "Hello {name}! 👋 Thank you for your interest in our {stream} programs at DreamDesk. Here is our official prospectus and 2026 fee structure: https://admissions.dreamdesk.edu/brochure. Would you like to schedule a 1-on-1 counseling call with our senior academic advisor? Reply YES to connect.",
    is_default: 1,
  },
  {
    id: "tpl_counseling_confirm",
    name: "Counseling Session Confirmation",
    category: "Appointment",
    template_body: "Dear {name}, your counseling session is confirmed for {callback_at}. Our expert counselor will call you to discuss stream selection, cutoffs, and merit scholarships. Reference Lead ID: {lead_code}.",
    is_default: 1,
  },
  {
    id: "tpl_fee_scholarship",
    name: "Scholarship Test & Fee Structure",
    category: "Admissions",
    template_body: "Hi {name}! 🎉 Based on your academic score in {stream}, you qualify for the DreamDesk Merit Scholarship Test (up to 40% tuition fee waiver). Register your test slot: https://admissions.dreamdesk.edu/scholarship-test",
    is_default: 0,
  },
  {
    id: "tpl_missed_call",
    name: "Follow-Up After Unanswered Call",
    category: "Follow-up",
    template_body: "Hello {name}, our counselor tried calling your number regarding your admission inquiry for {school}. When would be a convenient time to speak today? You can also reply directly with your questions here on WhatsApp.",
    is_default: 0,
  },
];

const insertTpl = db.prepare(`
  INSERT INTO whatsapp_templates (id, name, category, template_body, is_default)
  VALUES (@id, @name, @category, @template_body, @is_default)
  ON CONFLICT(id) DO UPDATE SET template_body=excluded.template_body
`);
for (const t of defaultTpls) insertTpl.run(t);

const defaultRules = [
  { id: "rule_medical", name: "Medical / NEET Stream -> Priya Patel", criteria_field: "stream", criteria_value: "Science (PCB)", assigned_to: "usr_priya", is_active: 1, priority: 1 },
  { id: "rule_engineering", name: "Engineering / JEE Stream -> Rohit Sharma", criteria_field: "stream", criteria_value: "Science (PCM)", assigned_to: "usr_rohit", is_active: 1, priority: 2 },
  { id: "rule_commerce", name: "Commerce Stream -> Ananya Verma", criteria_field: "stream", criteria_value: "Commerce with Maths", assigned_to: "usr_ananya", is_active: 1, priority: 3 },
  { id: "rule_humanities", name: "Humanities / Arts -> Sneha Rao", criteria_field: "stream", criteria_value: "Humanities / Arts", assigned_to: "usr_sneha", is_active: 1, priority: 4 },
];

const insertRule = db.prepare(`
  INSERT INTO assignment_rules (id, name, criteria_field, criteria_value, assigned_to, is_active, priority)
  VALUES (@id, @name, @criteria_field, @criteria_value, @assigned_to, @is_active, @priority)
  ON CONFLICT(id) DO UPDATE SET assigned_to=excluded.assigned_to, criteria_value=excluded.criteria_value
`);
for (const r of defaultRules) insertRule.run(r);

// 8. Seed Leads
const existingLeadCount = db.prepare("SELECT COUNT(*) as count FROM leads").get().count;
console.log(`Current existing leads in DB: ${existingLeadCount}`);

if (existingLeadCount < targetCount || isReset) {
  const needed = isReset ? targetCount : (targetCount - existingLeadCount);
  console.log(`Generating ${needed} realistic student leads with rich distribution...`);

  const firstNames = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
    "Diya", "Saanvi", "Aanya", "Aadhya", "Pari", "Ananya", "Riya", "Myra", "Avani", "Meera",
    "Kavya", "Aryan", "Rohan", "Tanvi", "Pranav", "Nikhil", "Shreya", "Neha", "Dhruv", "Siddharth",
    "Tanya", "Akash", "Rhea", "Manish", "Pooja", "Varun", "Simran", "Rahul", "Karan", "Sneha"
  ];
  const lastNames = [
    "Sharma", "Verma", "Gupta", "Malhotra", "Mehta", "Patel", "Reddy", "Singh", "Nair", "Rao",
    "Iyer", "Chopra", "Bose", "Das", "Sengupta", "Kulkarni", "Deshmukh", "Joshi", "Agarwal", "Bansal",
    "Mishra", "Pandey", "Chatterjee", "Mukherjee", "Kapoor", "Bhatia", "Saxena", "Choudhury"
  ];

  const schools = [
    "Delhi Public School, R.K. Puram",
    "St. Xavier's Collegiate School, Kolkata",
    "The Mother's International School, Delhi",
    "National Public School, Indiranagar, Bengaluru",
    "Bombay Scottish School, Mahim, Mumbai",
    "Modern School, Barakhamba Road",
    "DAV Public School, Sector 14, Gurugram",
    "Amity International School, Noida",
    "Bishop Cotton Boys' School, Bengaluru",
    "Ryan International School, Mumbai",
    "City Montessori School, Lucknow",
    "Heritage Experiential Learning School, Gurugram",
    "South Point High School, Kolkata",
    "Loyola High School, Patna",
    "St. John's High School, Chandigarh",
  ];

  const streams = [
    "Science (PCM)",
    "Science (PCB)",
    "Commerce with Maths",
    "Commerce without Maths",
    "Humanities / Arts",
    "Computer Science"
  ];

  const boards = ["CBSE", "ICSE / ISC", "State Board", "IB (International Baccalaureate)", "Cambridge (IGCSE)"];
  const cities = ["Delhi NCR", "Mumbai", "Bengaluru", "Kolkata", "Hyderabad", "Pune", "Chennai", "Kota", "Jaipur", "Ahmedabad", "Lucknow", "Chandigarh", "Patna"];
  const branches = [
    "B.Tech Computer Science & Engineering",
    "B.Tech AI & Data Science",
    "B.Tech Electronics & Communication",
    "MBBS / Pre-Med",
    "B.Com (Honours) Finance",
    "BBA Marketing & Analytics",
    "BA Economics & Policy",
    "B.Des Product & UIUX Design",
    "Law (BA LLB Honours)"
  ];

  const statuses = [
    "New", "New", "Contacted", "Contacted", "Interested", "Follow-up", "Follow-up", "Enrolled", "Lost"
  ];

  const counselorIds = ["usr_rohit", "usr_ananya", "usr_priya", "usr_sneha", "usr_aditya", null];
  const campIds = defaultCampaigns.map(c => c.id);

  // Map status to suitable disposition and sub-disposition
  const statusDispMap = {
    "New": null,
    "Contacted": { disp: "disp_cb_requested", sub: "sub_cb_evening" },
    "Interested": { disp: "disp_high_intent", sub: "sub_campus_visit" },
    "Follow-up": { disp: "disp_followup_needed", sub: "sub_fu_brochure" },
    "Enrolled": { disp: "disp_adm_filled", sub: "sub_fee_paid" },
    "Lost": { disp: "disp_not_interested", sub: "sub_ni_other_coll" },
  };

  const insertLead = db.prepare(`
    INSERT INTO leads (
      lead_code, name, phone, email, status, assigned_to, assigned_at,
      campaign_id, disposition_id, sub_disposition_id, callback_at,
      raw_attributes, notes, created_at, updated_at
    ) VALUES (
      @lead_code, @name, @phone, @email, @status, @assigned_to, @assigned_at,
      @campaign_id, @disposition_id, @sub_disposition_id, @callback_at,
      @raw_attributes, @notes, @created_at, @updated_at
    )
  `);

  const now = Date.now();
  const startIndex = existingLeadCount + 1;

  const insertTx = db.transaction(() => {
    for (let i = 0; i < needed; i++) {
      const seq = startIndex + i;
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const school = schools[Math.floor(Math.random() * schools.length)];
      const stream = streams[Math.floor(Math.random() * streams.length)];
      const board = boards[Math.floor(Math.random() * boards.length)];
      const city = cities[Math.floor(Math.random() * cities.length)];
      const branch = branches[Math.floor(Math.random() * branches.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const counselor = counselorIds[Math.floor(Math.random() * counselorIds.length)];
      const campaign = campIds[Math.floor(Math.random() * campIds.length)];

      const scoreNum = (68 + Math.random() * 30).toFixed(1);
      const score = `${scoreNum}%`;
      const phone = `+91 ${9000000000 + Math.floor(Math.random() * 999999999)}`;
      const parentPhone = `+91 ${8000000000 + Math.floor(Math.random() * 999999999)}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${Math.floor(Math.random() * 900) + 100}@gmail.com`;

      const rawAttributes = {
        school,
        stream,
        board,
        city,
        score,
        preferred_branch: branch,
        parent_phone: parentPhone,
      };

      if (stream.includes("PCM") || stream.includes("Computer")) {
        rawAttributes["jee_percentile"] = (75 + Math.random() * 24.9).toFixed(2);
      }
      if (Math.random() > 0.6) {
        rawAttributes["hostel_required"] = Math.random() > 0.4 ? "Yes" : "No";
      }

      // Timing distribution (past 30 days)
      const daysAgo = Math.floor(Math.random() * 30);
      const hoursAgo = Math.floor(Math.random() * 24);
      const leadDate = new Date(now - (daysAgo * 86400000 + hoursAgo * 3600000)).toISOString().replace("T", " ").substring(0, 19);

      // Disposition mapping
      const dispConfig = statusDispMap[status];
      const dispositionId = dispConfig ? dispConfig.disp : null;
      const subDispositionId = dispConfig ? dispConfig.sub : null;

      // Scheduled callback (some future, some past)
      let callbackAt = null;
      if (status === "Follow-up" || status === "Interested" || dispositionId === "disp_cb_requested") {
        const offsetHours = (Math.random() * 96) - 24; // from -24h to +72h
        callbackAt = new Date(now + offsetHours * 3600000).toISOString().replace("T", " ").substring(0, 19);
      }

      const notesList = [
        "Student inquired about cutoffs and campus placements.",
        "Parent called to check hostel availability and security.",
        "Candidate scored well in mock tests, considering CSE seats.",
        "Follow-up scheduled after board term exams.",
        "Shared digital prospectus on WhatsApp.",
        "Requested scholarship details for top 5% rankers."
      ];
      const notes = status !== "New" ? notesList[Math.floor(Math.random() * notesList.length)] : null;

      insertLead.run({
        lead_code: `LD-${String(seq).padStart(6, "0")}`,
        name: `${fName} ${lName}`,
        phone,
        email,
        status,
        assigned_to: counselor,
        assigned_at: counselor ? leadDate : null,
        campaign_id: campaign,
        disposition_id: dispositionId,
        sub_disposition_id: subDispositionId,
        callback_at: callbackAt,
        raw_attributes: JSON.stringify(rawAttributes),
        notes,
        created_at: leadDate,
        updated_at: leadDate,
      });
    }
  });

  insertTx();
  console.log(`✓ Inserted ${needed} realistic student leads.`);
}

// 9. Activity Log Entry
db.prepare(`
  INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
  VALUES ('DATABASE_SEED', 'Generated comprehensive realistic CRM seed data with full RBAC, campaigns, and leads', ?, ?, 'System Admin')
`).run(targetCount, JSON.stringify({ isReset, targetCount, timestamp: new Date().toISOString() }));

const finalUserCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
const finalLeadCount = db.prepare("SELECT COUNT(*) as count FROM leads").get().count;
const finalCampCount = db.prepare("SELECT COUNT(*) as count FROM campaigns").get().count;
const finalDispCount = db.prepare("SELECT COUNT(*) as count FROM dispositions").get().count;

console.log(`\n======================================================`);
console.log(`🎉 Seeding Complete!`);
console.log(`   Staff Users:  ${finalUserCount} accounts`);
console.log(`   Total Leads:  ${finalLeadCount} leads`);
console.log(`   Campaigns:    ${finalCampCount} active campaigns`);
console.log(`   Dispositions: ${finalDispCount} disposition codes`);
console.log(`======================================================\n`);
