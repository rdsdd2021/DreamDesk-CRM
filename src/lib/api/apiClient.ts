/**
 * Resilient API Client with Content-Type safety and automatic transient network retry.
 */

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  isNetworkError?: boolean;
}

export class ApiClient {
  /**
   * Safe fetcher that guarantees structured error reporting and avoids JSON parse crashes on HTML error responses.
   */
  static async fetchJson<T = any>(
    url: string,
    options: RequestInit = {},
    maxRetries = 2,
    retryDelayMs = 1000
  ): Promise<{ data: T | null; error: ApiError | null }> {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const headers = new Headers(options.headers || {});
        if (!headers.has("Accept")) {
          headers.set("Accept", "application/json");
        }
        if (options.body && !headers.has("Content-Type") && typeof options.body === "string") {
          headers.set("Content-Type", "application/json");
        }

        const res = await fetch(url, {
          ...options,
          headers,
        });

        const contentType = res.headers.get("content-type") || "";

        if (res.ok) {
          if (contentType.includes("application/json")) {
            const data = await res.json();
            return { data, error: null };
          } else {
            const text = await res.text();
            return { data: text as any, error: null };
          }
        }

        // Handle Server Errors (502, 503, 504) with auto-retry
        const isTransientServerIssue = res.status === 502 || res.status === 503 || res.status === 504;
        if (isTransientServerIssue && attempt < maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
          continue;
        }

        // Parse error body safely
        let errorMessage = `Server returned HTTP ${res.status}`;
        let errorCode = "HTTP_ERROR";

        if (contentType.includes("application/json")) {
          try {
            const errJson = await res.json();
            errorMessage = errJson.error || errJson.message || errorMessage;
            errorCode = errJson.code || errorCode;
          } catch {}
        } else {
          // HTML error page (e.g., Nginx 504 Gateway Timeout or Cloudflare error)
          try {
            const htmlText = await res.text();
            if (htmlText.includes("<title>")) {
              const match = htmlText.match(/<title>(.*?)<\/title>/i);
              if (match?.[1]) {
                errorMessage = match[1].replace(/&nbsp;/g, " ").trim();
              }
            } else if (htmlText.length < 300) {
              errorMessage = htmlText.trim();
            }
          } catch {}
        }

        return {
          data: null,
          error: {
            message: errorMessage,
            code: errorCode,
            status: res.status,
            isNetworkError: false,
          },
        };
      } catch (err: any) {
        // Network drop or fetch failure
        if (attempt < maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
          continue;
        }

        return {
          data: null,
          error: {
            message: err.message || "Network connection failed. Please check your internet connection.",
            code: "NETWORK_ERROR",
            status: 0,
            isNetworkError: true,
          },
        };
      }
    }

    return {
      data: null,
      error: {
        message: "Failed after maximum retries.",
        code: "TIMEOUT",
        status: 504,
        isNetworkError: true,
      },
    };
  }
}
