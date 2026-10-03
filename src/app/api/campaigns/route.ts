import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function GET() {
  try {
    const campaigns = LeadsService.getCampaigns();
    return NextResponse.json(campaigns);
  } catch (error: any) {
    console.error("Failed to fetch campaigns:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || !body.channel) {
      return NextResponse.json(
        { error: "Campaign name and channel are required" },
        { status: 400 }
      );
    }

    const created = LeadsService.createCampaign({
      name: body.name,
      channel: body.channel,
      description: body.description,
      target_audience: body.target_audience,
      status: body.status || "active",
      linked_disposition_ids: body.linked_disposition_ids,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create campaign:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
    }

    LeadsService.updateCampaign(id, updates);
    return NextResponse.json({ success: true, message: "Campaign updated successfully" });
  } catch (error: any) {
    console.error("Failed to update campaign:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
    }

    LeadsService.deleteCampaign(id);
    return NextResponse.json({ success: true, message: "Campaign deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete campaign:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
