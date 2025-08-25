import type { Lang } from "../config/i18n";

export type NavMessages = {
  docs: string;
  api: string;
  repo: string;
};

export const NAV_MESSAGES: Record<Lang, NavMessages> = {
  en: { docs: "Docs", api: "API", repo: "Gitee" },
  zh: { docs: "文档", api: "API", repo: "Gitee" },
};

