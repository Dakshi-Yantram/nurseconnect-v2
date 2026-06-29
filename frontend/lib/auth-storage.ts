/**
 * Token persistence layer.
 * On native: uses expo-secure-store (keychain/keystore).
 * On web: falls back to AsyncStorage (which uses localStorage under the hood on web).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'nc_access_token',
  REFRESH_TOKEN: 'nc_refresh_token',
  USER: 'nc_user',
  ROLE: 'nc_role',
} as const;

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return await AsyncStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export const authStorage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
      setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  },
  async getAccessToken(): Promise<string | null> {
    return getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },
  async getRefreshToken(): Promise<string | null> {
    return getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },
  async saveUser(user: any): Promise<void> {
    await setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  async getUser<T = any>(): Promise<T | null> {
    const raw = await getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async saveRole(role: string): Promise<void> {
    await setItem(STORAGE_KEYS.ROLE, role);
  },
  async getRole(): Promise<string | null> {
    return getItem(STORAGE_KEYS.ROLE);
  },
  async clearAll(): Promise<void> {
    await Promise.all(
      Object.values(STORAGE_KEYS).map((k) => removeItem(k))
    );
  },
};
