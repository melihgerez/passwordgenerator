import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

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

const MAX_RECENT = 30;
const MAX_SAVED = 30;
const RECENT_STORAGE_KEY = "password-store:recent";
const SAVED_STORAGE_KEY = "password-store:saved";

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
        const [recentRaw, savedRaw] = await Promise.all([
          AsyncStorage.getItem(RECENT_STORAGE_KEY),
          AsyncStorage.getItem(SAVED_STORAGE_KEY),
        ]);

        if (!isMounted) {
          return;
        }

        if (recentRaw) {
          const parsedRecent = JSON.parse(recentRaw) as RecentPasswordItem[];
          if (Array.isArray(parsedRecent)) {
            setRecentPasswords(parsedRecent.slice(0, MAX_RECENT));
          }
        }

        if (savedRaw) {
          const parsedSaved = JSON.parse(savedRaw) as SavedPasswordItem[];
          if (Array.isArray(parsedSaved)) {
            setSavedPasswords(parsedSaved.slice(0, MAX_SAVED));
          }
        }
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

    void AsyncStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify(recentPasswords),
    );
  }, [recentPasswords]);

  useEffect(() => {
    if (!hasHydrated.current) {
      return;
    }

    void AsyncStorage.setItem(
      SAVED_STORAGE_KEY,
      JSON.stringify(savedPasswords),
    );
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
