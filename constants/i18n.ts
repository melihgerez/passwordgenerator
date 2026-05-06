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
    show: string;
    hide: string;
  };
  home: {
    title: string;
    subtitle: string;
    initialPassword: string;
    passwordLabel: string;
    outputLabel: string;
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
    copy: string;
    save: string;
    newPassword: string;
    strengthWeak: string;
    strengthFair: string;
    strengthGood: string;
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
      show: "Göster",
      hide: "Gizle",
    },
    home: {
      title: "PASSGEN GENERATOR",
      subtitle: "Your personal password generator",
      initialPassword: "",
      passwordLabel: "Özel Anahtar",
      outputLabel: "ÇIKTI",
      strength: "Güç",
      generate: "Üret",
      generating: "Üretiliyor...",
      passwordRules: "Parola Kuralları",
      uppercase: "A-Z UPPER",
      lowercase: "a-z LOWER",
      numbers: "0-9 NUMS",
      symbols: "!@# SYMS",
      length: "Karakter Uzunluğu",
      activeRules: (count) => `${count} kural aktif`,
      copiedToast: "Panoya kopyalandı",
      noRulesError: "En az bir kategori seç",
      copy: "KOPYALA",
      save: "KAYDET",
      newPassword: "YENİ",
      strengthWeak: "WEAK",
      strengthFair: "FAIR",
      strengthGood: "GOOD",
      strengthStrong: "STRONG",
    },
    recent: {
      title: "Son Kayıtlar",
      subtitle: "Maksimum 15 kayıt tutulur",
      clearAll: "Hepsini Sil",
      emptyTitle: "Henüz kayıt yok",
      emptyText: "Ana Menü sayfasında şifre üretince burada görünecek.",
      deleteConfirm: "Bu şifreyi silmek istediğinize emin misiniz?",
      deleteAllConfirm:
        "Tüm son oluşturulan şifreleri silmek istediğinize emin misiniz?",
    },
    saved: {
      title: "Kaydedilenler",
      subtitle: "Maksimum 20 kayıt tutulur",
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
      show: "Show",
      hide: "Hide",
    },
    home: {
      title: "PASSGEN GENERATOR",
      subtitle: "Your personal password generator",
      initialPassword: "",
      passwordLabel: "Secret Key",
      outputLabel: "OUTPUT",
      strength: "Strength",
      generate: "Generate",
      generating: "Generating...",
      passwordRules: "Password Rules",
      uppercase: "A-Z UPPER",
      lowercase: "a-z LOWER",
      numbers: "0-9 NUMS",
      symbols: "!@# SYMS",
      length: "Character Length",
      activeRules: (count) => `${count} rules enabled`,
      copiedToast: "Copied to clipboard",
      noRulesError: "Select at least one category",
      copy: "COPY",
      save: "SAVE",
      newPassword: "NEW",
      strengthWeak: "WEAK",
      strengthFair: "FAIR",
      strengthGood: "GOOD",
      strengthStrong: "STRONG",
    },
    recent: {
      title: "Recent",
      subtitle: "Up to 15 entries are stored",
      clearAll: "Delete All",
      emptyTitle: "No records yet",
      emptyText: "Generated passwords will appear here from the Home screen.",
      deleteConfirm: "Are you sure you want to delete this password?",
      deleteAllConfirm:
        "Are you sure you want to delete all recently generated passwords?",
    },
    saved: {
      title: "Saved Passwords",
      subtitle: "Up to 20 entries are stored",
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
