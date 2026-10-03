import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.disposition_id || !body.name) {
      return NextResponse.json(
        { error: "disposition_id and name are required" },
        { status: 400 }
      );
    }

    const created = LeadsService.createSubDisposition({
      disposition_id: body.disposition_id,
      name: body.name,
      code: body.code,
      score: body.score !== undefined ? Number(body.score) : 0,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create sub-disposition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create sub-disposition" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Sub-disposition ID is required" }, { status: 400 });
    }

    LeadsService.deleteSubDisposition(id);
    return NextResponse.json({ success: true, message: "Sub-disposition deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete sub-disposition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete sub-disposition" },
      { status: 500 }
    );
  }
}
