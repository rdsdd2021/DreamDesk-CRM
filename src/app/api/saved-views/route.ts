import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function GET() {
  try {
    const views = LeadsService.getSavedViews();
    return NextResponse.json(views);
  } catch (error: any) {
    console.error("Failed to fetch saved views:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch saved views" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: "View name is required" }, { status: 400 });
    }

    const created = LeadsService.createSavedView({
      name: body.name,
      filters: body.filters || {},
      search: body.search,
      visible_columns: body.visible_columns,
      sort_by: body.sort_by,
      sort_order: body.sort_order,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create saved view:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create saved view" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Saved view ID is required" }, { status: 400 });
    }

    LeadsService.deleteSavedView(id);
    return NextResponse.json({ success: true, message: "Saved view deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete saved view:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete saved view" },
      { status: 500 }
    );
  }
}
