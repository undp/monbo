// Whether `pathname` is `path`, with or without the locale prefix
// (the default locale has none).
export const isSamePath = (pathname: string, path: string, locale: string) =>
  pathname === path ||
  pathname === (path === "/" ? `/${locale}` : `/${locale}${path}`);

// An admin page: `/admin` or below, with or without the locale prefix.
const ADMIN_PATH = /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/;

/** Whether `pathname` is an admin page, which shows the admin navigation. */
export const isAdminPath = (pathname: string) => ADMIN_PATH.test(pathname);
