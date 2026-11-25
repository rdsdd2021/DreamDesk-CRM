import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/database";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

function requireAdmin(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return {
      error: NextResponse.json(
        { error: errorResponse.error },
        { status: errorResponse.status }
      ),
    };
  }
  if (session.user.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Live Database GUI requires Administrator privileges." },
        { status: 403 }
      ),
    };
  }
  return { session };
}

function getValidTables(db: ReturnType<typeof getDatabase>): { name: string; type: string }[] {
  return db
    .prepare(
      `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name ASC`
    )
    .all() as { name: string; type: string }[];
}

interface ForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "tables";

    if (action === "tables") {
      const validTables = getValidTables(db);
      const tables = validTables.map((t) => {
        let rowCount = 0;
        try {
          const res = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get() as {
            cnt: number;
          };
          rowCount = res?.cnt ?? 0;
        } catch {
          rowCount = 0;
        }
        return {
          name: t.name,
          type: t.type,
          rowCount,
        };
      });

      const journalMode = db.pragma("journal_mode", { simple: true });
      return NextResponse.json({
        tables,
        journalMode: String(journalMode),
      });
    }

    if (action === "rows") {
      const tableName = searchParams.get("table") || "";
      const validTables = getValidTables(db);
      if (!validTables.some((t) => t.name === tableName)) {
        return NextResponse.json({ error: "Invalid or unknown table name" }, { status: 400 });
      }

      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
      const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") || "50", 10) || 50));
      const offset = (page - 1) * limit;
      const search = (searchParams.get("search") || "").trim();
      const filterCol = (searchParams.get("filterCol") || "").trim();
      const filterVal = searchParams.get("filterVal");

      const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as {
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }[];

      const indexes = db.prepare(`PRAGMA index_list("${tableName}")`).all() as {
        seq: number;
        name: string;
        unique: number;
        origin: string;
        partial: number;
      }[];

      const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all() as ForeignKeyInfo[];

      // Find incoming foreign keys from other tables pointing to this table
      const referencedBy: { table: string; from: string; to: string }[] = [];
      for (const t of validTables) {
        if (t.type !== "table") continue;
        try {
          const fks = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all() as ForeignKeyInfo[];
          for (const fk of fks) {
            if (fk.table === tableName) {
              referencedBy.push({
                table: t.name,
                from: fk.from,
                to: fk.to,
              });
            }
          }
        } catch {
          // ignore
        }
      }

      const conditions: string[] = [];
      const params: any[] = [];

      if (filterCol && filterVal !== null && columns.some((c) => c.name === filterCol)) {
        conditions.push(`CAST("${filterCol}" AS TEXT) = ?`);
        params.push(String(filterVal));
      }

      if (search && columns.length > 0) {
        const likeExprs = columns.map((c) => `CAST("${c.name}" AS TEXT) LIKE ?`);
        conditions.push(`(${likeExprs.join(" OR ")})`);
        columns.forEach(() => params.push(`%${search}%`));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRow = db
        .prepare(`SELECT COUNT(*) as cnt FROM "${tableName}" ${whereClause}`)
        .get(...params) as { cnt: number };
      const totalCount = countRow?.cnt ?? 0;

      const orderCol = columns.some((c) => c.name === "id") ? `"id" DESC` : `rowid DESC`;
      const rows = db
        .prepare(`SELECT * FROM "${tableName}" ${whereClause} ORDER BY ${orderCol} LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);

      return NextResponse.json({
        table: tableName,
        columns,
        indexes,
        foreignKeys,
        referencedBy,
        rows,
        totalCount,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      });
    }

    if (action === "related_counts") {
      const tableName = searchParams.get("table") || "";
      const pkVal = searchParams.get("pkVal") ?? "";
      const validTables = getValidTables(db);
      if (!validTables.some((t) => t.name === tableName)) {
        return NextResponse.json({ error: "Invalid table" }, { status: 400 });
      }

      const related: { table: string; from: string; to: string; count: number }[] = [];
      for (const t of validTables) {
        if (t.type !== "table") continue;
        try {
          const fks = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all() as ForeignKeyInfo[];
          for (const fk of fks) {
            if (fk.table === tableName) {
              const cntRow = db
                .prepare(`SELECT COUNT(*) as cnt FROM "${t.name}" WHERE CAST("${fk.from}" AS TEXT) = ?`)
                .get(String(pkVal)) as { cnt: number };
              related.push({
                table: t.name,
                from: fk.from,
                to: fk.to,
                count: cntRow?.cnt ?? 0,
              });
            }
          }
        } catch {
          // ignore
        }
      }

      return NextResponse.json({ related });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to inspect database" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    // Support safe parameterized single-cell updates from the Row Inspector
    if (body?.action === "update_cell") {
      if (!body?.allowWrite) {
        return NextResponse.json(
          { error: "Enable 'Allow Write Queries' mode to edit live cell values." },
          { status: 403 }
        );
      }
      const db = getDatabase();
      const validTables = getValidTables(db);
      const tableName = String(body.table || "");
      if (!validTables.some((t) => t.name === tableName && t.type === "table")) {
        return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
      }

      const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string; pk: number }[];
      const colName = String(body.col || "");
      const pkCol = String(body.pkCol || "");
      if (!columns.some((c) => c.name === colName) || !columns.some((c) => c.name === pkCol)) {
        return NextResponse.json({ error: "Invalid column or primary key" }, { status: 400 });
      }

      const startTime = performance.now();
      const info = db
        .prepare(`UPDATE "${tableName}" SET "${colName}" = ? WHERE CAST("${pkCol}" AS TEXT) = ?`)
        .run(body.value === "" ? null : body.value, String(body.pkVal));
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

      return NextResponse.json({
        success: true,
        changes: info.changes,
        durationMs,
      });
    }

    const rawSql = String(body?.sql || "").trim();
    const allowWrite = Boolean(body?.allowWrite);

    if (!rawSql) {
      return NextResponse.json({ error: "SQL query cannot be empty" }, { status: 400 });
    }

    const db = getDatabase();
    const startTime = performance.now();

    const stmt = db.prepare(rawSql);

    if (!stmt.reader && !allowWrite) {
      return NextResponse.json(
        {
          error:
            "Write/DDL queries are blocked in Read-Only mode. Enable 'Allow Write Queries' toggle to run INSERT/UPDATE/DELETE/ALTER.",
        },
        { status: 403 }
      );
    }

    if (stmt.reader) {
      const rows = stmt.all() as Record<string, any>[];
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      const columns =
        rows.length > 0
          ? Object.keys(rows[0])
          : stmt.columns().map((c) => c.name);

      return NextResponse.json({
        isReadOnly: true,
        columns,
        rows: rows.slice(0, 1000),
        totalReturned: rows.length,
        truncated: rows.length > 1000,
        durationMs,
      });
    } else {
      const info = stmt.run();
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

      return NextResponse.json({
        isReadOnly: false,
        changes: info.changes,
        lastInsertRowid: Number(info.lastInsertRowid),
        durationMs,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "SQL execution error" },
      { status: 400 }
    );
  }
}
