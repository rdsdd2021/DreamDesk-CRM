import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records, sourceName, campaignId, skipDuplicates, fieldMapping, defaultStatus } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Invalid data: 'records' must be a non-empty array." }, { status: 400 });
    }

    const { importedCount, skippedDuplicates, newHeadersFound } = LeadsService.importLeads(
      records,
      sourceName || "Manual Import",
      campaignId || undefined,
      Boolean(skipDuplicates),
      fieldMapping,
      defaultStatus || "New"
    );

    return NextResponse.json({
      success: true,
      importedCount,
      skippedDuplicates,
      newHeadersFound,
      message: `Successfully imported ${importedCount.toLocaleString()} leads${skippedDuplicates > 0 ? ` (${skippedDuplicates.toLocaleString()} duplicates skipped)` : ""}.${newHeadersFound.length > 0 ? ` Discovered ${newHeadersFound.length} new dynamic headers: [${newHeadersFound.join(", ")}].` : ""}`,
    });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error?.message || "Failed to import leads" }, { status: 500 });
  }
}
