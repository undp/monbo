// The admin's sections, shown once logged in: buttons in the header from 900 px,
// and in the header's menu below it (MainNavigation).
export const ADMIN_SECTIONS = [
  { path: "/admin/layers", label: "common:header:admin:layers" },
  { path: "/admin/categories", label: "common:header:admin:categories" },
  { path: "/admin/usage", label: "common:header:admin:usage" },
] as const;

/** Whether `pathname` (with or without a locale) is in the section at `path`. */
export const isInAdminSection = (pathname: string, path: string) =>
  new RegExp(`^/(?:[a-z]{2}/)?${path.slice(1)}(?:/|$)`).test(pathname);
