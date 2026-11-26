import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { AuthService } from "@/lib/services/authService";
import { LeadsService } from "@/lib/services/leadsService";
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

    const uploadId = request.headers.get("x-upload-id")?.replace(/[^a-zA-Z0-9_-]/g, "");
    const chunkIndex = Number(request.headers.get("x-chunk-index") || "0");
    const isLast = request.headers.get("x-chunk-last") === "true";

    if (!uploadId) {
      return NextResponse.json({ error: "Missing x-upload-id header" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "data", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const tempPath = path.join(uploadDir, `${uploadId}.csv`);

    const arrayBuf = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (chunkIndex === 0) {
      fs.writeFileSync(tempPath, buffer);
    } else {
      fs.appendFileSync(tempPath, buffer);
    }

    if (!isLast) {
      return NextResponse.json({ success: true, chunkIndex, receivedBytes: buffer.length });
    }

    // Final chunk received — enqueue background ingestion job on the server
    const sourceName = decodeURIComponent(request.headers.get("x-source-name") || "Batch CSV Import");
    const campaignRaw = request.headers.get("x-campaign-id");
    const campaignId = campaignRaw && campaignRaw !== "none" ? campaignRaw : undefined;
    const skipDuplicates = request.headers.get("x-skip-duplicates") !== "false";
    const defaultStatus = decodeURIComponent(request.headers.get("x-default-status") || "New");

    let fieldMapping: Record<string, string> | undefined;
    const mappingHeader = request.headers.get("x-field-mapping");
    if (mappingHeader) {
      try {
        fieldMapping = JSON.parse(decodeURIComponent(mappingHeader));
      } catch {
        fieldMapping = undefined;
      }
    }

    const stats = fs.statSync(tempPath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(1);
    const estimatedRows = await countCsvRowsFast(tempPath);

    const job = JobsService.enqueueJob({
      jobType: "import",
      title: `Import CSV: ${sourceName} (${sizeMb} MB, ~${estimatedRows.toLocaleString()} rows)`,
      totalItems: estimatedRows,
      createdBy: currentUser,
      run: async ({ updateProgress, appendLog, isCancelled, yieldLoop }) => {
        const CHUNK_SIZE = 500;
        let rowBuffer: any[] = [];
        let processedTotal = 0;
        let importedTotal = 0;
        let skippedTotal = 0;
        let errorRows = 0;
        const headersSet = new Set<string>();

        appendLog("info", `Received ${sourceName} (${sizeMb} MB). Starting server-side streaming ingestion...`);

        const flushBuffer = async () => {
          if (isCancelled()) throw new Error("Cancelled by user");
          if (rowBuffer.length === 0) return;
          const batch = rowBuffer;
          rowBuffer = [];
          try {
            const { importedCount, skippedDuplicates, newHeadersFound } = LeadsService.importLeads(
              batch,
              sourceName,
              campaignId,
              skipDuplicates,
              fieldMapping,
              defaultStatus
            );
            importedTotal += importedCount;
            skippedTotal += skippedDuplicates;
            for (const h of newHeadersFound) headersSet.add(h);
          } catch (chunkErr: any) {
            errorRows += batch.length;
            appendLog("error", `Chunk failed (${batch.length} rows): ${chunkErr?.message || "DB error"}`);
          }
          processedTotal += batch.length;
          updateProgress(processedTotal, importedTotal, skippedTotal, Math.max(estimatedRows, processedTotal));
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
                    appendLog(
                      "warn",
                      `CSV parse warning near row ${processedTotal + rowBuffer.length + 1}: ${results.errors[0].message}`
                    );
                  }
                }
                if (results.data && typeof results.data === "object") {
                  rowBuffer.push(results.data);
                }
                if (rowBuffer.length >= CHUNK_SIZE) {
                  parser.pause();
                  flushBuffer()
                    .then(() => {
                      if (processedTotal % 5000 === 0) {
                        appendLog(
                          "info",
                          `Processed ${processedTotal.toLocaleString()} rows (${importedTotal.toLocaleString()} imported, ${skippedTotal.toLocaleString()} skipped)...`
                        );
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
                    `Finished: ${importedTotal.toLocaleString()} imported, ${skippedTotal.toLocaleString()} skipped${
                      errorRows > 0 ? `, ${errorRows} row/chunk warnings` : ""
                    }.`
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
        estimatedRows,
        message: `Uploaded ${sizeMb} MB CSV. Server ingestion queued in background.`,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Chunked import error:", error);
    return NextResponse.json({ error: error?.message || "Chunk upload failed" }, { status: 500 });
  }
}
