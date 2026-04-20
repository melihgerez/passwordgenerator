import { getLocales } from "expo-localization";

export type AppLocale = "tr" | "en";

export type AppStrings = {
  tabs: {
    home: string;
    recent: string;
    saved: string;
  };
  common: {
    save: string;
    saved: string;
    delete: string;
    deleteAll: string;
    cancel: string;
    copy: string;
    copied: string;
  };
  home: {
    title: string;
    initialPassword: string;
    passwordLabel: string;
    strength: string;
    generate: string;
    generating: string;
    passwordRules: string;
    uppercase: string;
    lowercase: string;
    numbers: string;
    symbols: string;
    length: string;
    activeRules: (count: number) => string;
    copiedToast: string;
    noRulesError: string;
    strengthWeak: string;
    strengthMedium: string;
    strengthStrong: string;
  };
  recent: {
    title: string;
    subtitle: string;
    clearAll: string;
    emptyTitle: string;
    emptyText: string;
    deleteConfirm: string;
    deleteAllConfirm: string;
  };
  saved: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyText: string;
    recordPlaceholder: (index: number) => string;
    deleteConfirm: string;
  };
};

const strings: Record<AppLocale, AppStrings> = {
  tr: {
    tabs: {
      home: "Ana Menü",
      recent: "Son Kayıtlar",
      saved: "Kaydedilenler",
    },
    common: {
      save: "Kaydet",
      saved: "Kaydedildi",
      delete: "Sil",
      deleteAll: "Hepsini Sil",
      cancel: "İptal",
      copy: "Kopyala",
      copied: "Kopyalandı",
    },
    home: {
      title: "Quantum Key Forge",
      initialPassword: "Parola_Anahtarı",
      passwordLabel: "Parolan",
      strength: "Güç",
      generate: "Parola Üret",
      generating: "Üretiliyor...",
      passwordRules: "Parola Kuralları",
      uppercase: "Büyük Harf",
      lowercase: "Küçük Harf",
      numbers: "Sayı",
      symbols: "Sembol",
      length: "Karakter Uzunluğu",
      activeRules: (count) => `${count} kural aktif`,
      copiedToast: "Panoya kopyalandı",
      noRulesError: "En az bir kategori seç",
      strengthWeak: "Zayıf",
      strengthMedium: "Orta",
      strengthStrong: "Güçlü",
    },
    recent: {
      title: "Son Kayıtlar",
      subtitle: "En son üretilen 20 şifre listelenir",
      clearAll: "Hepsini Sil",
      emptyTitle: "Henüz kayıt yok",
      emptyText: "Ana Menü sayfasında şifre üretince burada görünecek.",
      deleteConfirm: "Bu şifreyi silmek istediğinize emin misiniz?",
      deleteAllConfirm:
        "Tüm son oluşturulan şifreleri silmek istediğinize emin misiniz?",
    },
    saved: {
      title: "Kaydedilenler",
      subtitle: "Maksimum 30 kayıt tutulur",
      emptyTitle: "Henüz kaydedilen yok",
      emptyText:
        "Ana Menüde şifreyi ürettikten sonra Kaydet ile buraya eklenir.",
      recordPlaceholder: (index) => `Kayıt ${index}`,
      deleteConfirm: "Bu şifreyi silmek istediğinize emin misiniz?",
    },
  },
  en: {
    tabs: {
      home: "Home",
      recent: "Recent",
      saved: "Saved",
    },
    common: {
      save: "Save",
      saved: "Saved",
      delete: "Delete",
      deleteAll: "Delete All",
      cancel: "Cancel",
      copy: "Copy",
      copied: "Copied",
    },
    home: {
      title: "Quantum Key Forge",
      initialPassword: "Your_Passkey",
      passwordLabel: "Your Password",
      strength: "Strength",
      generate: "Generate Password",
      generating: "Generating...",
      passwordRules: "Password Rules",
      uppercase: "Uppercase",
      lowercase: "Lowercase",
      numbers: "Numbers",
      symbols: "Symbols",
      length: "Length",
      activeRules: (count) => `${count} rules enabled`,
      copiedToast: "Copied to clipboard",
      noRulesError: "Select at least one category",
      strengthWeak: "Weak",
      strengthMedium: "Medium",
      strengthStrong: "Strong",
    },
    recent: {
      title: "Recent",
      subtitle: "Last 20 generated passwords",
      clearAll: "Delete All",
      emptyTitle: "No records yet",
      emptyText: "Generated passwords will appear here from the Home screen.",
      deleteConfirm: "Are you sure you want to delete this password?",
      deleteAllConfirm:
        "Are you sure you want to delete all recently generated passwords?",
    },
    saved: {
      title: "Saved Passwords",
      subtitle: "Up to 30 entries are stored",
      emptyTitle: "No saved passwords yet",
      emptyText: "Save a generated password from Home to see it here.",
      recordPlaceholder: (index) => `Record ${index}`,
      deleteConfirm: "Are you sure you want to delete this password?",
    },
  },
};

function resolveLocale(): AppLocale {
  const locale = getLocales()[0]?.languageCode?.toLowerCase();
  if (locale === "tr") {
    return "tr";
  }
  return "en";
}

export function getI18n() {
  const locale = resolveLocale();

  return {
    locale,
    dateLocale: locale === "tr" ? "tr-TR" : "en-US",
    strings: strings[locale],
  };
}
