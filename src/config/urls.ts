import { DEFAULT_LANG, type Lang } from "./i18n";

export function stripBase(pathname: string, base: string): string {
  if (!base || base === "/") return pathname;
  return pathname.startsWith(base) ? pathname.slice(base.length - 1) : pathname;
}

export function withBase(path: string, base: string): string {
  if (!base || base === "/") return path;
  // Ensure single leading slash
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // Base always ends with slash in Astro
  return `${base.replace(/\/$/, "")}${normalized}`;
}

// Compute a localized path for the requested target language given a base-less pathname
export function pathForLang(pathUnbased: string, target: Lang): string {
  // Normalize
  if (!pathUnbased.startsWith("/")) pathUnbased = `/${pathUnbased}`;

  // Home pages
  if (pathUnbased === "/" || pathUnbased === "") {
    return target === DEFAULT_LANG ? "/" : `/${target}/`;
  }
  if (pathUnbased === "/zh/" || pathUnbased === "/zh") {
    return target === DEFAULT_LANG ? "/" : "/zh/";
  }
  if (pathUnbased.startsWith("/zh/")) {
    // Generic zh-prefixed site route → swap prefix
    const rest = pathUnbased.slice("/zh".length);
    return target === DEFAULT_LANG ? rest || "/" : `/zh${rest}`;
  }

  // Docs and API routes: swap the language segment
  const m = pathUnbased.match(/^\/(docs(?:\/api)?)\/(en|zh)(\/.*|\/?$)/);
  if (m) {
    const prefix = m[1];
    const rest = m[3] || "/";
    return `/${prefix}/${target}${rest}`;
  }

  // Fallback: keep as-is for default language, or prefix for non-default
  return target === DEFAULT_LANG ? pathUnbased : `/${target}${pathUnbased}`;
}

export function altLang(current: Lang): Lang {
  return (current === "en" ? "zh" : "en") as Lang;
}

export function detectLang(pathUnbased: string): Lang {
  // Normalize
  if (!pathUnbased.startsWith("/")) pathUnbased = `/${pathUnbased}`;
  // Docs and API explicit language segment
  const m = pathUnbased.match(/^\/(docs(?:\/api)?)\/(en|zh)(?:\/|$)/);
  if (m) return m[2] as Lang;
  // Site-level zh prefix
  if (pathUnbased === "/zh" || pathUnbased.startsWith("/zh/")) return "zh";
  // Root and everything else defaults to DEFAULT_LANG
  return DEFAULT_LANG;
}
