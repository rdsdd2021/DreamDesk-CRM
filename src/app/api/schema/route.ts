import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function GET() {
  try {
    const meta = LeadsService.getSchemaMeta();
    return NextResponse.json(meta);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch schema" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.key_name || !body.display_label) {
      return NextResponse.json(
        { error: "Field key and display label are required." },
        { status: 400 }
      );
    }

    const created = LeadsService.createSchemaMeta({
      key_name: body.key_name,
      display_label: body.display_label,
      data_type: body.data_type || "string",
      is_filterable: body.is_filterable !== undefined ? body.is_filterable : 1,
      filter_type: body.filter_type || (body.data_type === "number" ? "range" : "faceted"),
      is_visible: body.is_visible !== undefined ? body.is_visible : 1,
      display_order: body.display_order,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create schema field:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create schema field" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { key_name, updates } = body;

    if (!key_name || !updates) {
      return NextResponse.json({ error: "key_name and updates are required" }, { status: 400 });
    }

    LeadsService.updateSchemaMeta(key_name, updates);
    return NextResponse.json({ success: true, message: `Updated header ${key_name}` });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update schema" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key");
    const purge = searchParams.get("purge") !== "false";

    if (!key) {
      return NextResponse.json({ error: "Field key is required" }, { status: 400 });
    }

    const result = LeadsService.deleteSchemaMeta(key, purge);
    return NextResponse.json({
      success: true,
      message: `Deleted dynamic field "${key}"`,
      affectedLeads: result.affectedLeads,
    });
  } catch (error: any) {
    console.error("Failed to delete schema field:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete schema field" },
      { status: 500 }
    );
  }
}
