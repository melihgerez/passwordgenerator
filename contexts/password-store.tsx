import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

type PasswordStoreContextValue = {
  recentPasswords: string[];
  savedPasswords: string[];
  addGeneratedPassword: (password: string) => void;
  savePassword: (password: string) => void;
  removeSavedPassword: (password: string) => void;
};

const PasswordStoreContext = createContext<PasswordStoreContextValue | null>(
  null,
);

const MAX_RECENT = 15;
const MAX_SAVED = 30;

export function PasswordStoreProvider({ children }: PropsWithChildren) {
  const [recentPasswords, setRecentPasswords] = useState<string[]>([]);
  const [savedPasswords, setSavedPasswords] = useState<string[]>([]);

  const addGeneratedPassword = (password: string) => {
    setRecentPasswords((prev) => [password, ...prev].slice(0, MAX_RECENT));
  };

  const savePassword = (password: string) => {
    setSavedPasswords((prev) => {
      const filtered = prev.filter((item) => item !== password);
      return [password, ...filtered].slice(0, MAX_SAVED);
    });
  };

  const removeSavedPassword = (password: string) => {
    setSavedPasswords((prev) => prev.filter((item) => item !== password));
  };

  const value = useMemo(
    () => ({
      recentPasswords,
      savedPasswords,
      addGeneratedPassword,
      savePassword,
      removeSavedPassword,
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
