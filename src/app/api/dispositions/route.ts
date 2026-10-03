import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function GET(request: NextRequest) {
  try {
    const campaignId = request.nextUrl.searchParams.get("campaign_id") || undefined;
    const dispositions = LeadsService.getDispositions(campaignId);
    return NextResponse.json(dispositions);
  } catch (error: any) {
    console.error("Failed to fetch dispositions:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch dispositions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || !body.category) {
      return NextResponse.json(
        { error: "Name and category are required" },
        { status: 400 }
      );
    }

    const created = LeadsService.createDisposition({
      name: body.name,
      code: body.code,
      category: body.category,
      color: body.color || "#3b82f6",
      score: body.score !== undefined ? Number(body.score) : 0,
      requires_callback: body.requires_callback ? 1 : 0,
      is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      linked_campaign_ids: body.linked_campaign_ids || [],
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create disposition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create disposition" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Disposition ID is required" }, { status: 400 });
    }

    LeadsService.updateDisposition(id, updates);
    return NextResponse.json({ success: true, message: "Disposition updated successfully" });
  } catch (error: any) {
    console.error("Failed to update disposition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update disposition" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Disposition ID is required" }, { status: 400 });
    }

    LeadsService.deleteDisposition(id);
    return NextResponse.json({ success: true, message: "Disposition deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete disposition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete disposition" },
      { status: 500 }
    );
  }
}
