export const LANGS = ["en", "zh"] as const;
export type Lang = (typeof LANGS)[number];

export const START_PAGE: Record<Lang, string> = {
  en: "/docs/en/src/beginner/beginner.html",
  zh: "/docs/zh/src/beginner/beginner.html",
};

export const DEFAULT_LANG: Lang = "en";

