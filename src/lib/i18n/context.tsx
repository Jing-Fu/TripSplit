"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./locales/en";
import { zhTW, type Messages } from "./locales/zh-TW";

const SUPPORTED_LOCALES = ["zh-TW", "en"] as const;
const DEFAULT_LOCALE = "zh-TW";
const STORAGE_KEY = "tripsplit.locale";

const messagesByLocale = {
  "zh-TW": zhTW,
  en,
} satisfies Record<Locale, Messages>;

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends Primitive
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${NestedKeyOf<T[K]>}`
      : never;
}[keyof T & string];

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationKey = NestedKeyOf<Messages>;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: <K extends TranslationKey>(key: K) => string;
  messages: Messages;
  locales: readonly Locale[];
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function resolveMessage(messages: Messages, key: TranslationKey): string {
  const result = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, messages);

  return typeof result === "string" ? result : key;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(STORAGE_KEY);

    if (storedLocale && isLocale(storedLocale)) {
      setLocale(storedLocale);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<<K extends TranslationKey>(key: K) => string>(
    (key) => resolveMessage(messagesByLocale[locale], key),
    [locale]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      messages: messagesByLocale[locale],
      locales: SUPPORTED_LOCALES,
    }),
    [locale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }

  return context;
}

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, messagesByLocale };
