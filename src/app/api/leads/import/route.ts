import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import Papa from "papaparse";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";

export const dynamic = "force-dynamic";

function countCsvRowsFast(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    let lines = 0;
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 10) lines++;
      }
    });
    stream.on("end", () => resolve(Math.max(1, lines - 1)));
    stream.on("error", () => resolve(1));
  });
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user || null;

    const contentType = request.headers.get("content-type") || "";

    // 1. Streaming Multipart File Upload (supports 60MB+ CSVs cleanly)
    if (contentType.includes("multipart/form-data")) {
      const formData = (await request.formData()) as any;
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
      }

      const sourceName = String(formData.get("sourceName") || file.name || "CSV Upload");
      const campaignIdRaw = formData.get("campaignId");
      const campaignId = campaignIdRaw && String(campaignIdRaw) !== "none" ? String(campaignIdRaw) : undefined;
      const skipDuplicates = String(formData.get("skipDuplicates") || "true") === "true";
      const duplicateModeRaw = String(formData.get("duplicateMode") || "").toLowerCase();
      const duplicateMode =
        duplicateModeRaw === "merge" || duplicateModeRaw === "allow" || duplicateModeRaw === "skip"
          ? duplicateModeRaw
          : skipDuplicates
          ? "skip"
          : "allow";
      const defaultStatus = String(formData.get("defaultStatus") || "New");

      const uploadDir = path.join(process.cwd(), "data", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const tempPath = path.join(uploadDir, `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.csv`);

      // Stream file to disk without holding entire 60MB+ in memory
      const webStream = file.stream();
      const nodeStream = Readable.fromWeb(webStream as any);
      await pipeline(nodeStream, fs.createWriteStream(tempPath));

      const estimatedRows = await countCsvRowsFast(tempPath);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

      const job = JobsService.enqueueJob({
        jobType: "import",
        title: `Import CSV: ${sourceName} (${sizeMb} MB, ~${estimatedRows.toLocaleString()} rows)`,
        totalItems: estimatedRows,
        createdBy: currentUser,
        run: async ({ updateProgress, appendLog, yieldLoop }) => {
          const CHUNK_SIZE = 500;
          let buffer: any[] = [];
          let processedTotal = 0;
          let importedTotal = 0;
          let skippedTotal = 0;
          let mergedTotal = 0;
          let rejectedTotal = 0;
          let errorRows = 0;
          const rejectedSample: any[] = [];
          const duplicateSample: any[] = [];
          const headersSet = new Set<string>();

          appendLog("info", `Received ${sourceName} (${sizeMb} MB). Starting server-side streaming ingestion...`);

          const flushBuffer = async () => {
            if (buffer.length === 0) return;
            const batch = buffer;
            buffer = [];
            try {
              const res = LeadsService.importLeads(
                batch,
                sourceName,
                campaignId,
                skipDuplicates,
                undefined,
                defaultStatus,
                duplicateMode
              );
              importedTotal += res.importedCount;
              skippedTotal += res.skippedDuplicates;
              mergedTotal += res.mergedCount;
              rejectedTotal += res.rejectedCount;
              if (rejectedSample.length < 100) rejectedSample.push(...res.rejectedRows.slice(0, 100 - rejectedSample.length));
              if (duplicateSample.length < 100) duplicateSample.push(...res.duplicateRows.slice(0, 100 - duplicateSample.length));
              for (const h of res.newHeadersFound) headersSet.add(h);
            } catch (chunkErr: any) {
              errorRows += batch.length;
              appendLog("error", `Chunk failed (${batch.length} rows): ${chunkErr?.message || "DB error"}`);
            }
            processedTotal += batch.length;
            const totalForBar = Math.max(estimatedRows, processedTotal);
            updateProgress(processedTotal, importedTotal, skippedTotal, totalForBar);
            await yieldLoop();
          };

          try {
            await new Promise<void>((resolve, reject) => {
              const readStream = fs.createReadStream(tempPath, { encoding: "utf8" });
              Papa.parse(readStream, {
                header: true,
                skipEmptyLines: true,
                step: (results, parser) => {
                  if (results.errors && results.errors.length > 0) {
                    errorRows += 1;
                    if (errorRows <= 10) {
                      appendLog("warn", `CSV parse warning near row ${processedTotal + buffer.length + 1}: ${results.errors[0].message}`);
                    }
                  }
                  if (results.data && typeof results.data === "object") {
                    buffer.push(results.data);
                  }
                  if (buffer.length >= CHUNK_SIZE) {
                    parser.pause();
                    flushBuffer()
                      .then(() => {
                        if (processedTotal % 5000 === 0) {
                          appendLog("info", `Processed ${processedTotal.toLocaleString()} rows (${importedTotal.toLocaleString()} imported, ${skippedTotal.toLocaleString()} skipped)...`);
                        }
                        parser.resume();
                      })
                      .catch((err) => {
                        parser.abort();
                        reject(err);
                      });
                  }
                },
                complete: async () => {
                  try {
                    await flushBuffer();
                    updateProgress(processedTotal, importedTotal, skippedTotal, processedTotal);
                    appendLog(
                      "info",
                      `Finished: ${importedTotal.toLocaleString()} imported, ${skippedTotal.toLocaleString()} skipped${errorRows > 0 ? `, ${errorRows} row/chunk warnings` : ""}.`
                    );
                    resolve();
                  } catch (e) {
                    reject(e);
                  }
                },
                error: (err) => reject(err),
              });
            });
          } finally {
            try {
              if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch {}
          }

          return {
            importedCount: importedTotal,
            skippedDuplicates: skippedTotal,
            mergedCount: mergedTotal,
            rejectedCount: rejectedTotal,
            rejectedRows: rejectedSample,
            duplicateRows: duplicateSample,
            errorRows,
            newHeadersFound: Array.from(headersSet),
          };
        },
      });

      return NextResponse.json(
        {
          success: true,
          async: true,
          job,
          message: `Uploaded ${sizeMb} MB CSV. Server ingestion running in background.`,
        },
        { status: 202 }
      );
    }

    // 2. Fallback JSON array import (small batches / API callers)
    const body = await request.json();
    const { records, sourceName, campaignId, skipDuplicates, duplicateMode, fieldMapping, defaultStatus } = body;

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
      run: async ({ updateProgress, appendLog, yieldLoop }) => {
        const CHUNK_SIZE = 250;
        let importedTotal = 0;
        let skippedTotal = 0;
        let mergedTotal = 0;
        let rejectedTotal = 0;
        const rejectedSample: any[] = [];
        const duplicateSample: any[] = [];
        const headersSet = new Set<string>();

        appendLog("info", `Starting ingestion of ${totalRecords.toLocaleString()} leads...`);

        for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE);
          const res = LeadsService.importLeads(
            chunk,
            cleanSource,
            campaignId || undefined,
            Boolean(skipDuplicates),
            fieldMapping,
            defaultStatus || "New",
            duplicateMode
          );
          importedTotal += res.importedCount;
          skippedTotal += res.skippedDuplicates;
          mergedTotal += res.mergedCount;
          rejectedTotal += res.rejectedCount;
          if (rejectedSample.length < 100) rejectedSample.push(...res.rejectedRows.slice(0, 100 - rejectedSample.length));
          if (duplicateSample.length < 100) duplicateSample.push(...res.duplicateRows.slice(0, 100 - duplicateSample.length));
          for (const h of res.newHeadersFound) headersSet.add(h);

          updateProgress(Math.min(i + chunk.length, totalRecords), importedTotal, skippedTotal);
          await yieldLoop();
        }

        appendLog(
          "info",
          `Finished: ${importedTotal.toLocaleString()} imported, ${mergedTotal.toLocaleString()} merged, ${skippedTotal.toLocaleString()} skipped, ${rejectedTotal.toLocaleString()} rejected.`
        );
        return {
          importedCount: importedTotal,
          skippedDuplicates: skippedTotal,
          mergedCount: mergedTotal,
          rejectedCount: rejectedTotal,
          rejectedRows: rejectedSample,
          duplicateRows: duplicateSample,
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
