import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';

const STORAGE_DIR = `${FileSystem.documentDirectory || ''}zustand-storage/`;
const HAS_FILE_SYSTEM = !!FileSystem.documentDirectory;

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let asyncStoragePromise: Promise<AsyncStorageLike | null> | null = null;

const getAsyncStorage = async (): Promise<AsyncStorageLike | null> => {
  // Prevent loading the JS module when the native module is not linked in the current binary.
  if (!(NativeModules as any)?.RNCAsyncStorage) {
    return null;
  }

  if (!asyncStoragePromise) {
    asyncStoragePromise = (async () => {
      try {
        const mod = await import('@react-native-async-storage/async-storage');
        const storage = (mod?.default ?? mod) as AsyncStorageLike | undefined;
        if (
          storage &&
          typeof storage.getItem === 'function' &&
          typeof storage.setItem === 'function' &&
          typeof storage.removeItem === 'function'
        ) {
          return storage;
        }
      } catch {
        // Native module not linked in current build; fallback storage will be used.
      }
      return null;
    })();
  }
  return asyncStoragePromise;
};

const keyToPath = (key: string) => `${STORAGE_DIR}${encodeURIComponent(key)}.json`;

const ensureStorageDir = async () => {
  if (!HAS_FILE_SYSTEM) return;
  const info = await FileSystem.getInfoAsync(STORAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(STORAGE_DIR, { intermediates: true });
  }
};

const safeReadFile = async (path: string): Promise<string | null> => {
  if (!HAS_FILE_SYSTEM) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(path);
  } catch {
    return null;
  }
};

const safeDeleteFile = async (path: string) => {
  if (!HAS_FILE_SYSTEM) return;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    // no-op
  }
};

// AsyncStorage adapter for Zustand persist.
// Includes one-time migrations from previous file storage + SecureStore keys.
export const persistStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const asyncStorage = await getAsyncStorage();
    if (asyncStorage) {
      const fromAsyncStorage = await asyncStorage.getItem(key);
      if (fromAsyncStorage != null) return fromAsyncStorage;
    }

    const path = keyToPath(key);
    const fromFile = await safeReadFile(path);
    if (fromFile != null) {
      if (asyncStorage) {
        await asyncStorage.setItem(key, fromFile);
      }
      await Promise.all([safeDeleteFile(path), SecureStore.deleteItemAsync(key)]);
      return fromFile;
    }

    const legacy = await SecureStore.getItemAsync(key);
    if (legacy != null) {
      if (asyncStorage) {
        await asyncStorage.setItem(key, legacy);
      }
      await SecureStore.deleteItemAsync(key);
      return legacy;
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const asyncStorage = await getAsyncStorage();
    if (asyncStorage) {
      await asyncStorage.setItem(key, value);
      return;
    }

    // Fallback path while native AsyncStorage is unavailable in the current build.
    if (HAS_FILE_SYSTEM) {
      const path = keyToPath(key);
      await ensureStorageDir();
      await FileSystem.writeAsStringAsync(path, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const asyncStorage = await getAsyncStorage();
    const path = keyToPath(key);
    await Promise.all([
      asyncStorage ? asyncStorage.removeItem(key) : Promise.resolve(),
      safeDeleteFile(path),
      SecureStore.deleteItemAsync(key),
    ]);
  },
};
