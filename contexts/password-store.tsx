import {
  createContext,
  useContext,
  useMemo,
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
  savePassword: (password: string, name?: string) => void;
  removeSavedPassword: (id: string) => void;
  renameSavedPassword: (id: string, name: string) => void;
};

const PasswordStoreContext = createContext<PasswordStoreContextValue | null>(
  null,
);

const MAX_RECENT = 20;
const MAX_SAVED = 30;

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PasswordStoreProvider({ children }: PropsWithChildren) {
  const [recentPasswords, setRecentPasswords] = useState<RecentPasswordItem[]>(
    [],
  );
  const [savedPasswords, setSavedPasswords] = useState<SavedPasswordItem[]>([]);

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
