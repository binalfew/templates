import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// English
import enCommon from "~/locales/en/common.json";
import enNav from "~/locales/en/nav.json";
import enAuth from "~/locales/en/auth.json";
import enValidation from "~/locales/en/validation.json";
import enSettings from "~/locales/en/settings.json";
import enUsers from "~/locales/en/users.json";
import enAnalytics from "~/locales/en/analytics.json";
import enNotifications from "~/locales/en/notifications.json";

// French
import frCommon from "~/locales/fr/common.json";
import frNav from "~/locales/fr/nav.json";
import frAuth from "~/locales/fr/auth.json";
import frValidation from "~/locales/fr/validation.json";
import frSettings from "~/locales/fr/settings.json";
import frUsers from "~/locales/fr/users.json";
import frAnalytics from "~/locales/fr/analytics.json";
import frNotifications from "~/locales/fr/notifications.json";

export const supportedLanguages = [
  { code: "en", name: "English", dir: "ltr" as const },
  { code: "fr", name: "Fran\u00e7ais", dir: "ltr" as const },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]["code"];

export function getLanguageDir(lang: string): "ltr" | "rtl" {
  return "ltr";
}

const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    auth: enAuth,
    validation: enValidation,
    settings: enSettings,
    users: enUsers,
    analytics: enAnalytics,
    notifications: enNotifications,
  },
  fr: {
    common: frCommon,
    nav: frNav,
    auth: frAuth,
    validation: frValidation,
    settings: frSettings,
    users: frUsers,
    analytics: frAnalytics,
    notifications: frNotifications,
  },
};

let initialized = false;

export function initI18n(language?: string) {
  if (initialized) {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
    return i18n;
  }

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: "en",
      defaultNS: "common",
      ns: ["common", "nav", "auth", "validation", "settings", "users", "analytics", "notifications"],
      ...(language ? { lng: language } : {}),
      detection: {
        order: ["cookie", "navigator"],
        lookupCookie: "i18n_lang",
        caches: ["cookie"],
        cookieMinutes: 525600, // 1 year
      },
      interpolation: {
        escapeValue: false, // React already escapes
      },
    });

  initialized = true;
  return i18n;
}

export default i18n;
