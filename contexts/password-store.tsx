import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";

export type RecentPasswordItem = {
  id: string;
  password: string;
  createdAt: string;
};

export type SavedPasswordItem = {
  id: string;
  password: string;
  name: string;
  savedAt: string;
};

type PasswordStoreContextValue = {
  recentPasswords: RecentPasswordItem[];
  savedPasswords: SavedPasswordItem[];
  addGeneratedPassword: (password: string) => void;
  removeRecentPassword: (id: string) => void;
  clearRecentPasswords: () => void;
  savePassword: (password: string, name?: string) => void;
  removeSavedPassword: (id: string) => void;
  renameSavedPassword: (id: string, name: string) => void;
};

const PasswordStoreContext = createContext<PasswordStoreContextValue | null>(
  null,
);

const MAX_RECENT = 15;
const MAX_SAVED = 20;
const RECENT_INDEX_STORAGE_KEY = "password-store:recent:index";
const SAVED_INDEX_STORAGE_KEY = "password-store:saved:index";
const RECENT_ITEM_STORAGE_PREFIX = "password-store:recent:item:";
const SAVED_ITEM_STORAGE_PREFIX = "password-store:saved:item:";
const LEGACY_RECENT_STORAGE_KEY = "password-store:recent";
const LEGACY_SAVED_STORAGE_KEY = "password-store:saved";

type RecentPasswordIndexItem = {
  id: string;
  createdAt: string;
};

type SavedPasswordIndexItem = {
  id: string;
  name: string;
  savedAt: string;
};

async function readStoredValue(key: string) {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function writeStoredValue(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredValue(key: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

function recentItemKey(id: string) {
  return `${RECENT_ITEM_STORAGE_PREFIX}${id}`;
}

function savedItemKey(id: string) {
  return `${SAVED_ITEM_STORAGE_PREFIX}${id}`;
}

function toRecentIndex(items: RecentPasswordItem[]): RecentPasswordIndexItem[] {
  return items.map(({ id, createdAt }) => ({ id, createdAt }));
}

function toSavedIndex(items: SavedPasswordItem[]): SavedPasswordIndexItem[] {
  return items.map(({ id, name, savedAt }) => ({ id, name, savedAt }));
}

async function hydrateRecentPasswords(): Promise<RecentPasswordItem[]> {
  const indexRaw = await AsyncStorage.getItem(RECENT_INDEX_STORAGE_KEY);

  if (indexRaw) {
    try {
      const parsedIndex = JSON.parse(indexRaw) as RecentPasswordIndexItem[];
      if (Array.isArray(parsedIndex)) {
        const entries = await Promise.all(
          parsedIndex.map(async (item) => {
            const passwordRaw = await readStoredValue(recentItemKey(item.id));
            if (!passwordRaw) {
              return null;
            }

            return {
              id: item.id,
              password: passwordRaw,
              createdAt: item.createdAt,
            } satisfies RecentPasswordItem;
          }),
        );

        return entries.filter(
          (item): item is RecentPasswordItem => item !== null,
        );
      }
    } catch {
      // Yeni biçim okunamazsa eski biçimi deneyelim.
    }
  }

  const legacyRaw = await readStoredValue(LEGACY_RECENT_STORAGE_KEY);
  if (!legacyRaw) {
    return [];
  }

  try {
    const parsed = JSON.parse(legacyRaw) as RecentPasswordItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

async function hydrateSavedPasswords(): Promise<SavedPasswordItem[]> {
  const indexRaw = await AsyncStorage.getItem(SAVED_INDEX_STORAGE_KEY);

  if (indexRaw) {
    try {
      const parsedIndex = JSON.parse(indexRaw) as SavedPasswordIndexItem[];
      if (Array.isArray(parsedIndex)) {
        const entries = await Promise.all(
          parsedIndex.map(async (item) => {
            const passwordRaw = await readStoredValue(savedItemKey(item.id));
            if (!passwordRaw) {
              return null;
            }

            return {
              id: item.id,
              password: passwordRaw,
              name: item.name,
              savedAt: item.savedAt,
            } satisfies SavedPasswordItem;
          }),
        );

        return entries.filter(
          (item): item is SavedPasswordItem => item !== null,
        );
      }
    } catch {
      // Yeni biçim okunamazsa eski biçimi deneyelim.
    }
  }

  const legacyRaw = await readStoredValue(LEGACY_SAVED_STORAGE_KEY);
  if (!legacyRaw) {
    return [];
  }

  try {
    const parsed = JSON.parse(legacyRaw) as SavedPasswordItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PasswordStoreProvider({ children }: PropsWithChildren) {
  const [recentPasswords, setRecentPasswords] = useState<RecentPasswordItem[]>(
    [],
  );
  const [savedPasswords, setSavedPasswords] = useState<SavedPasswordItem[]>([]);
  const hasHydrated = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateStore = async () => {
      try {
        const [recentPasswordsLoaded, savedPasswordsLoaded] = await Promise.all(
          [hydrateRecentPasswords(), hydrateSavedPasswords()],
        );

        if (!isMounted) {
          return;
        }

        setRecentPasswords(recentPasswordsLoaded.slice(0, MAX_RECENT));
        setSavedPasswords(savedPasswordsLoaded.slice(0, MAX_SAVED));
      } catch {
        // Veri okunamazsa boş state ile devam edelim.
      } finally {
        hasHydrated.current = true;
      }
    };

    void hydrateStore();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) {
      return;
    }

    const syncRecentPasswords = async () => {
      try {
        const nextIndex = toRecentIndex(recentPasswords);
        const existingIndexRaw = await AsyncStorage.getItem(
          RECENT_INDEX_STORAGE_KEY,
        );
        const existingIndex = existingIndexRaw
          ? (JSON.parse(existingIndexRaw) as RecentPasswordIndexItem[])
          : [];
        const nextIds = new Set(nextIndex.map((item) => item.id));

        await Promise.all(
          existingIndex
            .filter((item) => !nextIds.has(item.id))
            .map((item) => deleteStoredValue(recentItemKey(item.id))),
        );

        await Promise.all(
          recentPasswords.map((item) =>
            writeStoredValue(recentItemKey(item.id), item.password),
          ),
        );

        await AsyncStorage.setItem(
          RECENT_INDEX_STORAGE_KEY,
          JSON.stringify(nextIndex),
        );
      } catch {
        // Secure storage write sorununda uygulama akışını bozmayalım.
      }
    };

    void syncRecentPasswords();
  }, [recentPasswords]);

  useEffect(() => {
    if (!hasHydrated.current) {
      return;
    }

    const syncSavedPasswords = async () => {
      try {
        const nextIndex = toSavedIndex(savedPasswords);
        const existingIndexRaw = await AsyncStorage.getItem(
          SAVED_INDEX_STORAGE_KEY,
        );
        const existingIndex = existingIndexRaw
          ? (JSON.parse(existingIndexRaw) as SavedPasswordIndexItem[])
          : [];
        const nextIds = new Set(nextIndex.map((item) => item.id));

        await Promise.all(
          existingIndex
            .filter((item) => !nextIds.has(item.id))
            .map((item) => deleteStoredValue(savedItemKey(item.id))),
        );

        await Promise.all(
          savedPasswords.map((item) =>
            writeStoredValue(savedItemKey(item.id), item.password),
          ),
        );

        await AsyncStorage.setItem(
          SAVED_INDEX_STORAGE_KEY,
          JSON.stringify(nextIndex),
        );
      } catch {
        // Secure storage write sorununda uygulama akışını bozmayalım.
      }
    };

    void syncSavedPasswords();
  }, [savedPasswords]);

  const addGeneratedPassword = (password: string) => {
    setRecentPasswords((prev) => {
      const next: RecentPasswordItem = {
        id: createId(),
        password,
        createdAt: new Date().toISOString(),
      };

      return [next, ...prev].slice(0, MAX_RECENT);
    });
  };

  const removeRecentPassword = (id: string) => {
    setRecentPasswords((prev) => prev.filter((item) => item.id !== id));
  };

  const clearRecentPasswords = () => {
    setRecentPasswords([]);
  };

  const savePassword = (password: string, name?: string) => {
    setSavedPasswords((prev) => {
      const existing = prev.find((item) => item.password === password);
      const filtered = prev.filter((item) => item.password !== password);

      const next: SavedPasswordItem = {
        id: existing?.id ?? createId(),
        password,
        name: (name ?? existing?.name ?? "").slice(0, 15),
        savedAt: new Date().toISOString(),
      };

      return [next, ...filtered].slice(0, MAX_SAVED);
    });
  };

  const removeSavedPassword = (id: string) => {
    setSavedPasswords((prev) => prev.filter((item) => item.id !== id));
  };

  const renameSavedPassword = (id: string, name: string) => {
    setSavedPasswords((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, name: name.slice(0, 15) } : item,
      ),
    );
  };

  const value = useMemo(
    () => ({
      recentPasswords,
      savedPasswords,
      addGeneratedPassword,
      removeRecentPassword,
      clearRecentPasswords,
      savePassword,
      removeSavedPassword,
      renameSavedPassword,
    }),
    [recentPasswords, savedPasswords],
  );

  return (
    <PasswordStoreContext.Provider value={value}>
      {children}
    </PasswordStoreContext.Provider>
  );
}

export function usePasswordStore() {
  const context = useContext(PasswordStoreContext);

  if (!context) {
    throw new Error(
      "usePasswordStore must be used within PasswordStoreProvider",
    );
  }

  return context;
}
