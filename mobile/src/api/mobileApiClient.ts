import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_SERVER_URL = "https://dreamdesk.assistt.in";
const SERVER_URL_KEY = "dreamdesk_mobile_server_url";
const SESSION_COOKIE_KEY = "dreamdesk_mobile_session_cookie";

export interface ApiResponse<T> {
  data: T | null;
  error: { message: string; status?: number } | null;
}

export class MobileApiClient {
  private static cachedServerUrl: string | null = null;
  private static cachedCookie: string | null | undefined = undefined;

  static async getServerUrl(): Promise<string> {
    if (this.cachedServerUrl) return this.cachedServerUrl;
    try {
      const url = await AsyncStorage.getItem(SERVER_URL_KEY);
      this.cachedServerUrl = url || DEFAULT_SERVER_URL;
      return this.cachedServerUrl;
    } catch {
      return DEFAULT_SERVER_URL;
    }
  }

  static async setServerUrl(url: string): Promise<void> {
    const trimmed = url.trim().replace(/\/+$/, "");
    this.cachedServerUrl = trimmed;
    await AsyncStorage.setItem(SERVER_URL_KEY, trimmed);
  }

  static async getSessionCookie(): Promise<string | null> {
    if (this.cachedCookie !== undefined) return this.cachedCookie;
    try {
      this.cachedCookie = await AsyncStorage.getItem(SESSION_COOKIE_KEY);
      return this.cachedCookie;
    } catch {
      return null;
    }
  }

  static async setSessionCookie(cookie: string | null): Promise<void> {
    this.cachedCookie = cookie;
    if (cookie) {
      await AsyncStorage.setItem(SESSION_COOKIE_KEY, cookie);
    } else {
      await AsyncStorage.removeItem(SESSION_COOKIE_KEY);
    }
  }

  static async fetchJson<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const [baseUrl, cookie] = await Promise.all([
        this.getServerUrl(),
        this.getSessionCookie(),
      ]);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...((options.headers as Record<string, string>) || {}),
      };

      if (cookie) {
        headers["Cookie"] = cookie;
      }

      const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const fullUrl = `${baseUrl}${cleanEndpoint}`;

      const res = await fetch(fullUrl, {
        ...options,
        headers,
      });

      const setCookie = res.headers.get("set-cookie");
      if (setCookie && setCookie.includes("dreamdesk_session=")) {
        const match = setCookie.match(/dreamdesk_session=([^;]+)/);
        if (match) {
          await this.setSessionCookie(`dreamdesk_session=${match[1]}`);
        }
      }

      if (res.status === 401) {
        await this.setSessionCookie(null);
        return {
          data: null,
          error: { message: "Session expired or unauthorized", status: 401 },
        };
      }

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // Non-JSON response
      }

      if (!res.ok) {
        return {
          data: null,
          error: {
            message: json?.error || json?.message || `Request failed with status ${res.status}`,
            status: res.status,
          },
        };
      }

      return { data: json as T, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || "Network error. Please check your connection." },
      };
    }
  }
}
