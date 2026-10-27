/**
 * Universal Client-Orchestrated Batch Processing Engine.
 * Provides true functional progress, throughput telemetry (leads/sec, ETA),
 * pause/cancellation tokens, and automatic failure recovery.
 */

export interface BatchProgress {
  processedCount: number;
  totalCount: number;
  percent: number;
  currentBatchIndex: number;
  totalBatches: number;
  speedLeadsPerSec: number;
  estimatedSecondsRemaining: number;
  elapsedSeconds: number;
  counselorTally: Record<string, number>;
  skippedLockedCount: number;
  status: "idle" | "running" | "paused" | "completed" | "error";
  errorMessage?: string;
  failedBatchIndex?: number;
}

export interface BatchChunkResult {
  affectedCount: number;
  skippedLockedCount?: number;
  counselorTally?: Record<string, number>;
  message?: string;
}

export interface BatchRunnerOptions<T> {
  items: T[];
  chunkSize?: number;
  processChunk: (chunk: T[], batchIndex: number, totalBatches: number) => Promise<BatchChunkResult>;
  onProgress: (progress: BatchProgress) => void;
  maxRetriesPerChunk?: number;
  initialCounselorTally?: Record<string, number>;
}

export class BatchController {
  private isCancelled = false;
  private isPaused = false;
  private resumeResolve: (() => void) | null = null;

  cancel() {
    this.isCancelled = true;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  get cancelled() {
    return this.isCancelled;
  }

  get paused() {
    return this.isPaused;
  }

  async waitIfPaused() {
    if (this.isPaused && !this.isCancelled) {
      await new Promise<void>((resolve) => {
        this.resumeResolve = resolve;
      });
    }
  }
}

export async function runBatchOperation<T>(
  options: BatchRunnerOptions<T>,
  controller: BatchController
): Promise<{ success: boolean; totalAffected: number; totalLocked: number; counselorTally: Record<string, number>; error?: string }> {
  const {
    items,
    chunkSize = 400,
    processChunk,
    onProgress,
    maxRetriesPerChunk = 3,
    initialCounselorTally = {},
  } = options;

  const totalCount = items.length;
  if (totalCount === 0) {
    onProgress({
      processedCount: 0,
      totalCount: 0,
      percent: 100,
      currentBatchIndex: 0,
      totalBatches: 0,
      speedLeadsPerSec: 0,
      estimatedSecondsRemaining: 0,
      elapsedSeconds: 0,
      counselorTally: {},
      skippedLockedCount: 0,
      status: "completed",
    });
    return { success: true, totalAffected: 0, totalLocked: 0, counselorTally: {} };
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  const totalBatches = chunks.length;
  let processedCount = 0;
  let totalAffected = 0;
  let totalLocked = 0;
  const counselorTally: Record<string, number> = { ...initialCounselorTally };

  const startTime = Date.now();

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    if (controller.cancelled) {
      onProgress({
        processedCount,
        totalCount,
        percent: Math.round((processedCount / totalCount) * 100),
        currentBatchIndex: batchIdx,
        totalBatches,
        speedLeadsPerSec: 0,
        estimatedSecondsRemaining: 0,
        elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
        counselorTally,
        skippedLockedCount: totalLocked,
        status: "paused",
        errorMessage: "Operation paused / cancelled by user.",
      });
      return { success: false, totalAffected, totalLocked, counselorTally, error: "Cancelled by user" };
    }

    await controller.waitIfPaused();

    const currentChunk = chunks[batchIdx];
    let chunkSuccess = false;
    let attempt = 0;
    let lastError: any = null;

    while (!chunkSuccess && attempt <= maxRetriesPerChunk) {
      if (controller.cancelled) break;

      try {
        const result = await processChunk(currentChunk, batchIdx, totalBatches);
        chunkSuccess = true;
        totalAffected += result.affectedCount || 0;
        totalLocked += result.skippedLockedCount || 0;

        if (result.counselorTally) {
          for (const [cId, count] of Object.entries(result.counselorTally)) {
            counselorTally[cId] = (counselorTally[cId] || 0) + count;
          }
        }
      } catch (err: any) {
        attempt++;
        lastError = err;
        if (attempt <= maxRetriesPerChunk) {
          // Micro delay before retry with backoff
          await new Promise((r) => setTimeout(r, 600 * attempt));
        }
      }
    }

    if (!chunkSuccess) {
      const errMsg = lastError?.message || `Failed to process batch ${batchIdx + 1} of ${totalBatches}`;
      onProgress({
        processedCount,
        totalCount,
        percent: Math.round((processedCount / totalCount) * 100),
        currentBatchIndex: batchIdx + 1,
        totalBatches,
        speedLeadsPerSec: 0,
        estimatedSecondsRemaining: 0,
        elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
        counselorTally,
        skippedLockedCount: totalLocked,
        status: "error",
        errorMessage: errMsg,
        failedBatchIndex: batchIdx,
      });
      return { success: false, totalAffected, totalLocked, counselorTally, error: errMsg };
    }

    processedCount += currentChunk.length;
    const elapsedSeconds = Math.max(0.1, (Date.now() - startTime) / 1000);
    const speedLeadsPerSec = Math.round(processedCount / elapsedSeconds);
    const remainingCount = totalCount - processedCount;
    const estimatedSecondsRemaining = speedLeadsPerSec > 0 ? Math.ceil(remainingCount / speedLeadsPerSec) : 0;
    const percent = Math.min(100, Math.round((processedCount / totalCount) * 100));

    onProgress({
      processedCount,
      totalCount,
      percent,
      currentBatchIndex: batchIdx + 1,
      totalBatches,
      speedLeadsPerSec,
      estimatedSecondsRemaining,
      elapsedSeconds: Math.round(elapsedSeconds),
      counselorTally: { ...counselorTally },
      skippedLockedCount: totalLocked,
      status: batchIdx + 1 === totalBatches ? "completed" : "running",
    });
  }

  return {
    success: true,
    totalAffected,
    totalLocked,
    counselorTally,
  };
}
