// Whether `pathname` is `path`, with or without the locale prefix
// (the default locale has none).
export const isSamePath = (pathname: string, path: string, locale: string) =>
  pathname === path ||
  pathname === (path === "/" ? `/${locale}` : `/${locale}${path}`);
