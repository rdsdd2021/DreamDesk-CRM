import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "crm.db");
  const db = new Database(dbPath);

  // High performance SQLite tuning for 500k+ records
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -64000"); // 64MB memory cache
  db.pragma("temp_store = MEMORY");
  db.pragma("foreign_keys = ON");

  initializeSchema(db);

  dbInstance = db;
  return dbInstance;
}

function initializeSchema(db: Database.Database) {
  // 1. Counselors / Users
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  // Migrations for existing DBs
  try {
    db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN salt TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_login_at DATETIME;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_login_ip TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_login_location TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN deactivated_at DATETIME;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN deactivated_by TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN ip_address TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN location TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN user_agent TEXT;`);
  } catch {}

  // 2. Dynamic Schema Metadata (Headers Registry)
  db.exec(`
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
  `);

  // 3. Campaigns Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      channel TEXT NOT NULL DEFAULT 'General',
      target_audience TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Customizable Dispositions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dispositions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL DEFAULT 'neutral', -- 'positive', 'neutral', 'negative', 'unreachable'
      color TEXT DEFAULT '#3b82f6',
      score INTEGER DEFAULT 0,
      requires_callback INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4b. Two-Level Sub-Dispositions Table
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

    -- 4c. Saved Views Table (Filters, Columns, Sorting Presets)
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

    -- 4d. WhatsApp Message Templates Table
    CREATE TABLE IF NOT EXISTS whatsapp_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      template_body TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4e. Automated Lead Assignment Rules Table
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
  `);

  // 5. Campaign <-> Disposition Link Table (Many-to-Many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_dispositions (
      campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
      disposition_id TEXT REFERENCES dispositions(id) ON DELETE CASCADE,
      PRIMARY KEY (campaign_id, disposition_id)
    );
  `);

  // 6. Leads (Core indexed columns + dynamic raw_attributes JSON)
  db.exec(`
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
  `);

  // Migration check: Add campaign_id, disposition_id, sub_disposition_id, callback_at to existing leads table if missing
  const leadCols = db.pragma("table_info(leads)") as { name: string }[];
  const existingColNames = new Set(leadCols.map((c) => c.name));

  if (!existingColNames.has("campaign_id")) {
    db.exec("ALTER TABLE leads ADD COLUMN campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL;");
  }
  if (!existingColNames.has("disposition_id")) {
    db.exec("ALTER TABLE leads ADD COLUMN disposition_id TEXT REFERENCES dispositions(id) ON DELETE SET NULL;");
  }
  if (!existingColNames.has("sub_disposition_id")) {
    db.exec("ALTER TABLE leads ADD COLUMN sub_disposition_id TEXT REFERENCES sub_dispositions(id) ON DELETE SET NULL;");
  }
  if (!existingColNames.has("callback_at")) {
    db.exec("ALTER TABLE leads ADD COLUMN callback_at DATETIME;");
  }

  // Optimize indices for high-volume 500k lead queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_leads_disposition ON leads(disposition_id);
    CREATE INDEX IF NOT EXISTS idx_leads_sub_disposition ON leads(sub_disposition_id);
    CREATE INDEX IF NOT EXISTS idx_leads_callback ON leads(callback_at);
  `);

  // 7. Activity Logs for Bulk Operations
  db.exec(`
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

  // 8. Dedicated Individual Lead Audit Trail & Activity Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      old_value TEXT,
      new_value TEXT,
      metadata TEXT,
      performed_by_id TEXT,
      performed_by_name TEXT DEFAULT 'System',
      performed_by_role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON lead_activities(activity_type);
  `);

  backfillLeadActivities(db);
  seedInitialData(db);
}

function backfillLeadActivities(db: Database.Database) {
  try {
    const actCount = db.prepare("SELECT COUNT(*) as count FROM lead_activities").get() as { count: number };
    if (actCount.count > 0) return;

    // Backfill historical audit trail for existing leads
    const leads = db.prepare(`
      SELECT 
        leads.*,
        users.name as assigned_user_name,
        campaigns.name as campaign_name,
        dispositions.name as disposition_name,
        dispositions.color as disposition_color,
        dispositions.score as disposition_score
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
      LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
      ORDER BY leads.id ASC
    `).all() as any[];

    if (leads.length === 0) return;

    const insertActivity = db.prepare(`
      INSERT INTO lead_activities (
        lead_id, activity_type, title, description, old_value, new_value, metadata, performed_by_name, created_at
      ) VALUES (
        @lead_id, @activity_type, @title, @description, @old_value, @new_value, @metadata, @performed_by_name, @created_at
      )
    `);

    const tx = db.transaction(() => {
      for (const l of leads) {
        // 1. Created entry
        insertActivity.run({
          lead_id: l.id,
          activity_type: "created",
          title: "Lead Ingested / Created",
          description: l.campaign_name ? `Lead acquired via campaign "${l.campaign_name}"` : "Direct enrollment via system",
          old_value: null,
          new_value: l.status,
          metadata: JSON.stringify({ lead_code: l.lead_code, campaign: l.campaign_name }),
          performed_by_name: "System",
          created_at: l.created_at || new Date().toISOString(),
        });

        // 2. Assignment entry (if assigned)
        if (l.assigned_to && l.assigned_user_name) {
          insertActivity.run({
            lead_id: l.id,
            activity_type: "assigned",
            title: `Assigned to Counselor: ${l.assigned_user_name}`,
            description: `Lead allocated to ${l.assigned_user_name} for student outreach`,
            old_value: "Unassigned",
            new_value: l.assigned_user_name,
            metadata: JSON.stringify({ counselor_id: l.assigned_to }),
            performed_by_name: "Admin",
            created_at: l.assigned_at || l.created_at || new Date().toISOString(),
          });
        }

        // 3. Disposition / Call outcome entry (if logged)
        if (l.disposition_id && l.disposition_name) {
          insertActivity.run({
            lead_id: l.id,
            activity_type: "disposition",
            title: `Call Outcome: ${l.disposition_name}`,
            description: l.notes || "Call logged with student",
            old_value: null,
            new_value: l.disposition_name,
            metadata: JSON.stringify({
              color: l.disposition_color,
              score: l.disposition_score,
            }),
            performed_by_name: l.assigned_user_name || "Counselor",
            created_at: l.updated_at || l.created_at || new Date().toISOString(),
          });
        }

        // 4. Callback entry (if scheduled)
        if (l.callback_at) {
          insertActivity.run({
            lead_id: l.id,
            activity_type: "callback_scheduled",
            title: "Follow-up Callback Scheduled",
            description: `Callback scheduled for ${new Date(l.callback_at).toLocaleString()}`,
            old_value: null,
            new_value: l.callback_at,
            metadata: JSON.stringify({ callback_at: l.callback_at }),
            performed_by_name: l.assigned_user_name || "Counselor",
            created_at: l.updated_at || l.created_at || new Date().toISOString(),
          });
        }
      }
    });

    tx();
  } catch (err) {
    console.warn("Could not backfill lead activities:", err);
  }
}

function seedInitialData(db: Database.Database) {
  // Seed Counselors if empty
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, role, status, avatar_color)
      VALUES (@id, @name, @email, @role, @status, @avatar_color)
    `);

    const defaultUsers = [
      { id: "usr_admin", name: "Super Admin", email: "admin@dreamdesk.in", role: "admin", status: "active", avatar_color: "#4f46e5" },
      { id: "usr_rohit", name: "Rohit Sharma", email: "rohit.sharma@dreamdesk.in", role: "senior_counselor", status: "active", avatar_color: "#2563eb" },
      { id: "usr_ananya", name: "Ananya Verma", email: "ananya.v@dreamdesk.in", role: "counselor", status: "active", avatar_color: "#db2777" },
      { id: "usr_vikram", name: "Vikram Malhotra", email: "vikram.m@dreamdesk.in", role: "team_lead", status: "active", avatar_color: "#16a34a" },
      { id: "usr_priya", name: "Priya Patel", email: "priya.p@dreamdesk.in", role: "counselor", status: "active", avatar_color: "#ea580c" },
      { id: "usr_sneha", name: "Sneha Rao", email: "sneha.rao@dreamdesk.in", role: "counselor", status: "active", avatar_color: "#9333ea" },
      { id: "usr_aditya", name: "Aditya Roy", email: "aditya.roy@dreamdesk.in", role: "telecaller", status: "active", avatar_color: "#0891b2" },
    ];

    const insertManyUsers = db.transaction((users) => {
      for (const u of users) insertUser.run(u);
    });
    insertManyUsers(defaultUsers);
  } else {
    // Ensure admin user exists even if other users already exist
    const adminExists = db.prepare("SELECT id FROM users WHERE id = 'usr_admin' OR email = 'admin@dreamdesk.in'").get();
    if (!adminExists) {
      db.prepare(`
        INSERT INTO users (id, name, email, role, status, avatar_color)
        VALUES ('usr_admin', 'Super Admin', 'admin@dreamdesk.in', 'admin', 'active', '#4f46e5')
      `).run();
    }
  }

  // Ensure all users have a password hash (default: password123)
  const usersWithoutPassword = db.prepare("SELECT id FROM users WHERE password_hash IS NULL").all() as { id: string }[];
  if (usersWithoutPassword.length > 0) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync("password123", salt, 64).toString("hex");
    const updateStmt = db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?");
    for (const u of usersWithoutPassword) {
      updateStmt.run(hash, salt, u.id);
    }
  }

  // Seed default metadata headers if empty
  const metaCount = db.prepare("SELECT COUNT(*) as count FROM lead_schema_meta").get() as { count: number };
  if (metaCount.count === 0) {
    const insertMeta = db.prepare(`
      INSERT INTO lead_schema_meta (id, key_name, display_label, data_type, is_filterable, filter_type, is_visible, display_order)
      VALUES (@id, @key_name, @display_label, @data_type, @is_filterable, @filter_type, @is_visible, @display_order)
    `);

    const defaultHeaders = [
      { id: "meta_stream", key_name: "stream", display_label: "Stream / Course", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 1 },
      { id: "meta_school", key_name: "school", display_label: "School / College", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 2 },
      { id: "meta_board", key_name: "board", display_label: "Education Board", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 3 },
      { id: "meta_city", key_name: "city", display_label: "City / Location", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 4 },
      { id: "meta_score", key_name: "score", display_label: "Percentage / Score", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 5 },
      { id: "meta_parent_phone", key_name: "parent_phone", display_label: "Parent Contact", data_type: "string", is_filterable: 0, filter_type: "search", is_visible: 1, display_order: 6 },
      { id: "meta_preferred_branch", key_name: "preferred_branch", display_label: "Preferred Branch", data_type: "string", is_filterable: 1, filter_type: "faceted", is_visible: 1, display_order: 7 },
    ];

    const insertManyMeta = db.transaction((headers) => {
      for (const h of headers) insertMeta.run(h);
    });
    insertManyMeta(defaultHeaders);
  }

  // Seed default Campaigns if empty
  const campCount = db.prepare("SELECT COUNT(*) as count FROM campaigns").get() as { count: number };
  if (campCount.count === 0) {
    const insertCamp = db.prepare(`
      INSERT INTO campaigns (id, name, description, channel, target_audience, status)
      VALUES (@id, @name, @description, @channel, @target_audience, @status)
    `);

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

    for (const c of defaultCampaigns) insertCamp.run(c);
  }

  // Seed customizable Dispositions if empty
  const dispCount = db.prepare("SELECT COUNT(*) as count FROM dispositions").get() as { count: number };
  if (dispCount.count === 0) {
    const insertDisp = db.prepare(`
      INSERT INTO dispositions (id, name, code, category, color, score, requires_callback, display_order)
      VALUES (@id, @name, @code, @category, @color, @score, @requires_callback, @display_order)
    `);

    const defaultDispositions = [
      // Positive
      { id: "disp_adm_filled", name: "Admission Form Submitted", code: "ADM_SUBMITTED", category: "positive", color: "#10b981", score: 100, requires_callback: 0, display_order: 1 },
      { id: "disp_couns_booked", name: "Counseling Session Booked", code: "COUNS_BOOKED", category: "positive", color: "#059669", score: 85, requires_callback: 1, display_order: 2 },
      { id: "disp_high_intent", name: "Interested - High Intent", code: "INT_HIGH", category: "positive", color: "#3b82f6", score: 70, requires_callback: 1, display_order: 3 },
      { id: "disp_stall_visited", name: "Stall Visited / Brochure Given", code: "VISITED_STALL", category: "positive", color: "#06b6d4", score: 60, requires_callback: 0, display_order: 4 },
      // Neutral
      { id: "disp_cb_requested", name: "Callback Requested", code: "CB_REQ", category: "neutral", color: "#f59e0b", score: 40, requires_callback: 1, display_order: 5 },
      { id: "disp_followup_needed", name: "Follow-up Needed", code: "FOLLOW_UP", category: "neutral", color: "#8b5cf6", score: 30, requires_callback: 1, display_order: 6 },
      { id: "disp_parent_pending", name: "Parent Discussion Pending", code: "PARENT_PENDING", category: "neutral", color: "#d97706", score: 25, requires_callback: 1, display_order: 7 },
      // Unreachable
      { id: "disp_rnr", name: "Ringing - No Response", code: "RNR", category: "unreachable", color: "#f97316", score: 10, requires_callback: 1, display_order: 8 },
      { id: "disp_busy", name: "Busy / Call Cut", code: "BUSY", category: "unreachable", color: "#ea580c", score: 5, requires_callback: 1, display_order: 9 },
      { id: "disp_switched_off", name: "Switched Off / Network Issue", code: "SWITCH_OFF", category: "unreachable", color: "#fb923c", score: 5, requires_callback: 1, display_order: 10 },
      // Negative
      { id: "disp_not_interested", name: "Not Interested", code: "NOT_INT", category: "negative", color: "#ef4444", score: -20, requires_callback: 0, display_order: 11 },
      { id: "disp_joined_other", name: "Joined Another College", code: "JOINED_OTHER", category: "negative", color: "#dc2626", score: -50, requires_callback: 0, display_order: 12 },
      { id: "disp_invalid_num", name: "Invalid / Wrong Number", code: "INVALID_NUM", category: "negative", color: "#94a3b8", score: -100, requires_callback: 0, display_order: 13 },
      { id: "disp_dnd", name: "Do Not Call (DND)", code: "DND", category: "negative", color: "#64748b", score: -100, requires_callback: 0, display_order: 14 },
    ];

    for (const d of defaultDispositions) insertDisp.run(d);

    // Link Dispositions to Campaigns
    const linkStmt = db.prepare(`
      INSERT OR IGNORE INTO campaign_dispositions (campaign_id, disposition_id)
      VALUES (?, ?)
    `);

    const allCampIds = ["camp_delhi_fair", "camp_kota_drive", "camp_cbse_outreach", "camp_digital_portal"];
    for (const campId of allCampIds) {
      for (const d of defaultDispositions) {
        // Link all standard dispositions to campaigns
        linkStmt.run(campId, d.id);
      }
    }
  }

  // Seed default Sub-Dispositions if empty
  const subDispCount = db.prepare("SELECT COUNT(*) as count FROM sub_dispositions").get() as { count: number };
  if (subDispCount.count === 0) {
    const insertSubDisp = db.prepare(`
      INSERT INTO sub_dispositions (id, disposition_id, name, code, score, display_order)
      VALUES (@id, @disposition_id, @name, @code, @score, @display_order)
    `);

    const defaultSubDispositions = [
      // For ADM_SUBMITTED (disp_adm_filled)
      { id: "sub_fee_paid", disposition_id: "disp_adm_filled", name: "Registration Fee Paid", code: "ADM_FEE_PAID", score: 100, display_order: 1 },
      { id: "sub_docs_pending", disposition_id: "disp_adm_filled", name: "Documents Verification In-Progress", code: "ADM_DOCS_VERIF", score: 90, display_order: 2 },
      { id: "sub_provisional", disposition_id: "disp_adm_filled", name: "Provisional Letter Issued", code: "ADM_PROVISIONAL", score: 95, display_order: 3 },

      // For INT_HIGH (disp_high_intent)
      { id: "sub_campus_visit", disposition_id: "disp_high_intent", name: "Campus Visit Scheduled", code: "INT_CAMPUS_VISIT", score: 85, display_order: 1 },
      { id: "sub_fee_inquiry", disposition_id: "disp_high_intent", name: "Fee Structure & Installments Shared", code: "INT_FEE_STRUCT", score: 75, display_order: 2 },
      { id: "sub_scholarship", disposition_id: "disp_high_intent", name: "Scholarship Test Registered", code: "INT_SCHOLARSHIP", score: 80, display_order: 3 },
      { id: "sub_parent_call", disposition_id: "disp_high_intent", name: "Parent Discussion Arranged", code: "INT_PARENT_TALK", score: 70, display_order: 4 },

      // For COUNS_BOOKED (disp_couns_booked)
      { id: "sub_couns_online", disposition_id: "disp_couns_booked", name: "Google Meet / Video Session", code: "COUNS_ONLINE", score: 85, display_order: 1 },
      { id: "sub_couns_campus", disposition_id: "disp_couns_booked", name: "In-Person Center Counseling", code: "COUNS_CAMPUS", score: 90, display_order: 2 },

      // For CB_REQ (disp_cb_requested)
      { id: "sub_cb_class", disposition_id: "disp_cb_requested", name: "Student Attending School / Coaching", code: "CB_IN_CLASS", score: 40, display_order: 1 },
      { id: "sub_cb_evening", disposition_id: "disp_cb_requested", name: "Call After 6:00 PM (Evening)", code: "CB_EVENING", score: 45, display_order: 2 },
      { id: "sub_cb_weekend", disposition_id: "disp_cb_requested", name: "Call on Saturday / Sunday", code: "CB_WEEKEND", score: 35, display_order: 3 },

      // For FOLLOW_UP (disp_followup_needed)
      { id: "sub_fu_brochure", disposition_id: "disp_followup_needed", name: "Reviewing Syllabus / Brochure", code: "FU_BROCHURE", score: 35, display_order: 1 },
      { id: "sub_fu_comparing", disposition_id: "disp_followup_needed", name: "Comparing Multiple Institutes", code: "FU_COMPARING", score: 30, display_order: 2 },
      { id: "sub_fu_board_results", disposition_id: "disp_followup_needed", name: "Awaiting Board / Exam Results", code: "FU_RESULTS", score: 30, display_order: 3 },

      // For NOT_INT (disp_not_interested)
      { id: "sub_ni_other_coll", disposition_id: "disp_not_interested", name: "Enrolled in Another Institute", code: "NOT_INT_OTHER_COLL", score: -20, display_order: 1 },
      { id: "sub_ni_budget", disposition_id: "disp_not_interested", name: "Budget Constraint / Fee High", code: "NOT_INT_BUDGET", score: -20, display_order: 2 },
      { id: "sub_ni_diff_course", disposition_id: "disp_not_interested", name: "Opted for Different Stream", code: "NOT_INT_DIFF_STREAM", score: -20, display_order: 3 },
      { id: "sub_ni_distance", disposition_id: "disp_not_interested", name: "Location / Distance Issue", code: "NOT_INT_DISTANCE", score: -20, display_order: 4 },

      // For RNR (disp_rnr)
      { id: "sub_rnr_1", disposition_id: "disp_rnr", name: "Attempt 1 (No Answer)", code: "RNR_ATTEMPT_1", score: 10, display_order: 1 },
      { id: "sub_rnr_2", disposition_id: "disp_rnr", name: "Attempt 2 (No Answer)", code: "RNR_ATTEMPT_2", score: 10, display_order: 2 },
      { id: "sub_rnr_3", disposition_id: "disp_rnr", name: "Attempt 3+ Unresponsive", code: "RNR_ATTEMPT_3", score: 5, display_order: 3 },
    ];

    for (const s of defaultSubDispositions) insertSubDisp.run(s);
  }

  // Seed default Saved Views if empty
  const viewCount = db.prepare("SELECT COUNT(*) as count FROM saved_views").get() as { count: number };
  if (viewCount.count === 0) {
    const insertView = db.prepare(`
      INSERT INTO saved_views (id, name, filters, search, visible_columns, sort_by, sort_order, is_default)
      VALUES (@id, @name, @filters, @search, @visible_columns, @sort_by, @sort_order, @is_default)
    `);

    const defaultViews = [
      {
        id: "view_high_intent",
        name: "High-Intent Hot Leads",
        filters: JSON.stringify({ status: ["Interested"] }),
        search: "",
        visible_columns: JSON.stringify(["lead_code", "name", "phone", "status", "assigned_to", "disposition", "campaign"]),
        sort_by: "created_at",
        sort_order: "desc",
        is_default: 1,
      },
      {
        id: "view_callbacks_today",
        name: "Scheduled Callbacks Queue",
        filters: JSON.stringify({ status: ["Follow-up"] }),
        search: "",
        visible_columns: JSON.stringify(["lead_code", "name", "phone", "status", "assigned_to", "disposition", "campaign"]),
        sort_by: "callback_at",
        sort_order: "asc",
        is_default: 0,
      },
      {
        id: "view_unassigned_pool",
        name: "Unallocated Fresh Pool",
        filters: JSON.stringify({ assigned_to: ["unassigned"] }),
        search: "",
        visible_columns: JSON.stringify(["lead_code", "name", "phone", "status", "campaign"]),
        sort_by: "created_at",
        sort_order: "desc",
        is_default: 0,
      },
    ];

    for (const v of defaultViews) insertView.run(v);
  }

  // 12. Seed default WhatsApp Templates if empty
  const tplCount = db.prepare("SELECT COUNT(*) as count FROM whatsapp_templates").get() as { count: number };
  if (tplCount.count === 0) {
    const insertTpl = db.prepare(`
      INSERT INTO whatsapp_templates (id, name, category, template_body, is_default)
      VALUES (@id, @name, @category, @template_body, @is_default)
    `);

    const defaultTpls = [
      {
        id: "tpl_welcome",
        name: "Welcome & Admission Brochure",
        category: "Introduction",
        template_body: "Hello {name}! 👋 Thank you for your interest in our {stream} programs. Here is our official prospectus and 2026 fee structure: https://admissions.dreamdesk.edu/brochure. Would you like to schedule a 1-on-1 counseling call with our senior academic advisor? Reply YES to connect.",
        is_default: 1,
      },
      {
        id: "tpl_counseling_confirm",
        name: "Counseling Session Confirmation",
        category: "Appointment",
        template_body: "Dear {name}, your counseling session is confirmed for {callback_at}. Our expert counselor will call you to discuss stream selection, top university cutoffs, and merit scholarships. Reference Lead ID: {lead_code}.",
        is_default: 1,
      },
      {
        id: "tpl_fee_scholarship",
        name: "Scholarship Test & Fee Structure",
        category: "Admissions",
        template_body: "Hi {name}! 🎉 Based on your academic profile for {stream}, you qualify for the DreamDesk Merit Scholarship Test (up to 40% tuition fee waiver). Register your test slot here: https://admissions.dreamdesk.edu/scholarship-test before Friday.",
        is_default: 0,
      },
      {
        id: "tpl_missed_call",
        name: "Follow-Up After Unanswered Call",
        category: "Follow-up",
        template_body: "Hello {name}, our counselor tried calling your number regarding your admission inquiry for {school}. When would be a convenient time to speak today? You can also reply directly with your questions here on WhatsApp.",
        is_default: 0,
      },
      {
        id: "tpl_campus_visit",
        name: "Campus Visit & Open Day Invitation",
        category: "Events",
        template_body: "Dear {name}, you and your parents are warmly invited to our Campus Open House this Saturday from 10:00 AM! Tour the campus, meet current students, and get on-the-spot admission guidance. Register your visit pass: https://admissions.dreamdesk.edu/visit",
        is_default: 0,
      },
    ];

    for (const t of defaultTpls) insertTpl.run(t);
  }

  // 13. Seed default Lead Routing Rules if empty
  const rulesCount = db.prepare("SELECT COUNT(*) as count FROM assignment_rules").get() as { count: number };
  if (rulesCount.count === 0) {
    const insertRule = db.prepare(`
      INSERT INTO assignment_rules (id, name, criteria_field, criteria_value, assigned_to, is_active, priority)
      VALUES (@id, @name, @criteria_field, @criteria_value, @assigned_to, @is_active, @priority)
    `);

    const defaultRules = [
      {
        id: "rule_medical",
        name: "Medical / NEET Stream -> Dr. Priya Sharma",
        criteria_field: "stream",
        criteria_value: "Medical / NEET",
        assigned_to: "usr_priya",
        is_active: 1,
        priority: 1,
      },
      {
        id: "rule_engineering",
        name: "Engineering / JEE Stream -> Rohit Verma",
        criteria_field: "stream",
        criteria_value: "Engineering / JEE",
        assigned_to: "usr_rohit",
        is_active: 1,
        priority: 2,
      },
      {
        id: "rule_commerce",
        name: "Commerce / CA Stream -> Ananya Iyer",
        criteria_field: "stream",
        criteria_value: "Commerce / CA",
        assigned_to: "usr_ananya",
        is_active: 1,
        priority: 3,
      },
      {
        id: "rule_arts",
        name: "Humanities / Arts Stream -> Vikram Patel",
        criteria_field: "stream",
        criteria_value: "Humanities / Arts",
        assigned_to: "usr_vikram",
        is_active: 1,
        priority: 4,
      },
    ];

    for (const r of defaultRules) insertRule.run(r);
  }

  // Backfill existing leads with sample campaign & disposition IDs if null
  try {
    const unassociated = db.prepare("SELECT COUNT(*) as count FROM leads WHERE campaign_id IS NULL").get() as { count: number };
    if (unassociated && unassociated.count > 0) {
      const campIds = ["camp_delhi_fair", "camp_kota_drive", "camp_cbse_outreach", "camp_digital_portal"];
      const dispIds = ["disp_high_intent", "disp_cb_requested", "disp_rnr", "disp_followup_needed", "disp_couns_booked", "disp_not_interested"];
      
      const updateLeadCamp = db.prepare(`
        UPDATE leads 
        SET campaign_id = @campId, disposition_id = @dispId 
        WHERE id = @id
      `);

      const rows = db.prepare("SELECT id FROM leads WHERE campaign_id IS NULL LIMIT 2500").all() as { id: number }[];
      const backfillTx = db.transaction(() => {
        for (let i = 0; i < rows.length; i++) {
          const campId = campIds[i % campIds.length];
          const dispId = i % 2 === 0 ? dispIds[i % dispIds.length] : null;
          updateLeadCamp.run({ id: rows[i].id, campId, dispId });
        }
      });
      backfillTx();
    }
  } catch (err) {
    console.error("Backfill error:", err);
  }
}
