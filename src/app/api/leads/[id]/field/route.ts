import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { field, value } = body;

    if (!field) {
      return NextResponse.json({ error: "Field name is required" }, { status: 400 });
    }

    const result = LeadsService.updateLeadField(Number(id), field, value);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to update lead field:", error);
    return NextResponse.json({ error: error.message || "Failed to update field" }, { status: 500 });
  }
}
