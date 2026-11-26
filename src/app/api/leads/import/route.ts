import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user || null;

    const body = await request.json();
    const { records, sourceName, campaignId, skipDuplicates, fieldMapping, defaultStatus } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Invalid data: 'records' must be a non-empty array." }, { status: 400 });
    }

    const totalRecords = records.length;
    const cleanSource = sourceName || "Manual Import";

    const job = JobsService.enqueueJob({
      jobType: "import",
      title: `Import ${totalRecords.toLocaleString()} Leads (${cleanSource})`,
      totalItems: totalRecords,
      createdBy: currentUser,
      run: async ({ updateProgress, yieldLoop }) => {
        const CHUNK_SIZE = 250;
        let importedTotal = 0;
        let skippedTotal = 0;
        const headersSet = new Set<string>();

        for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE);
          const { importedCount, skippedDuplicates, newHeadersFound } = LeadsService.importLeads(
            chunk,
            cleanSource,
            campaignId || undefined,
            Boolean(skipDuplicates),
            fieldMapping,
            defaultStatus || "New"
          );
          importedTotal += importedCount;
          skippedTotal += skippedDuplicates;
          for (const h of newHeadersFound) headersSet.add(h);

          updateProgress(Math.min(i + chunk.length, totalRecords), importedTotal, skippedTotal);
          await yieldLoop();
        }

        return {
          importedCount: importedTotal,
          skippedDuplicates: skippedTotal,
          newHeadersFound: Array.from(headersSet),
        };
      },
    });

    return NextResponse.json(
      {
        success: true,
        async: true,
        job,
        message: `Queued background import of ${totalRecords.toLocaleString()} leads.`,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error?.message || "Failed to queue lead import" }, { status: 500 });
  }
}
