import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "dreamdesk_cache_v1_";

export const MobileCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // ignore cache write failure
    }
  },
};
