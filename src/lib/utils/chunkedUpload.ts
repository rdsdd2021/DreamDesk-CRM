export interface ChunkedImportOptions {
  sourceName: string;
  campaignId?: string;
  skipDuplicates: boolean;
  defaultStatus?: string;
  fieldMapping?: Record<string, string>;
}

export async function uploadCsvInChunks(
  file: File,
  options: ChunkedImportOptions,
  onProgress?: (pct: number) => void
): Promise<any> {
  const CHUNK_BYTES = 2 * 1024 * 1024; // 2MB chunks — bypasses proxy/body size limits cleanly
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  const uploadId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let finalData: any = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_BYTES;
    const end = Math.min(file.size, start + CHUNK_BYTES);
    const slice = file.slice(start, end);
    const isLast = i === totalChunks - 1;

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "x-upload-id": uploadId,
      "x-chunk-index": String(i),
      "x-chunk-last": String(isLast),
    };

    if (isLast) {
      headers["x-source-name"] = encodeURIComponent(options.sourceName || file.name);
      headers["x-campaign-id"] = options.campaignId || "none";
      headers["x-skip-duplicates"] = String(options.skipDuplicates);
      headers["x-default-status"] = encodeURIComponent(options.defaultStatus || "New");
      if (options.fieldMapping) {
        headers["x-field-mapping"] = encodeURIComponent(JSON.stringify(options.fieldMapping));
      }
    }

    const res = await fetch("/api/leads/import/chunk", {
      method: "POST",
      headers,
      body: slice,
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON response (${res.status}).`);
    }

    if (!res.ok) {
      throw new Error(parsed?.error || `Chunk ${i + 1}/${totalChunks} failed (${res.status})`);
    }

    onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
    if (isLast) {
      finalData = parsed;
    }
  }

  return finalData;
}
