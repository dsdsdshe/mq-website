import type { Lang } from "../config/i18n";

export type NavMessages = {
  docs: string;
  api: string;
  github: string;
};

export const NAV_MESSAGES: Record<Lang, NavMessages> = {
  en: { docs: "Docs", api: "API", github: "GitHub" },
  zh: { docs: "文档", api: "API", github: "GitHub" },
};

