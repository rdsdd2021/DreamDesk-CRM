import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const body = await request.json();
    let { tags, action, tag } = body;

    if (!Array.isArray(tags)) {
      if (typeof tag === "string" && tag.trim()) {
        const lead = LeadsService.getLeadById(leadId);
        const curTags = lead?.tags || [];
        if (action === "remove") {
          tags = curTags.filter((t) => t.toLowerCase() !== tag.trim().toLowerCase());
        } else {
          tags = Array.from(new Set([...curTags, tag.trim()]));
        }
      } else {
        return NextResponse.json({ error: "Tags array or tag string is required" }, { status: 400 });
      }
    }

    const updatedLead = LeadsService.updateLeadTags(leadId, tags);
    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error: any) {
    console.error("Failed to update lead tags:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update tags" },
      { status: 500 }
    );
  }
}
