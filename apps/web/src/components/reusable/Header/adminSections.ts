import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";

// The admin's sections, shown once logged in: in the admin sidebar from 900 px,
// and in the header's menu below it (MainNavigation).
export const ADMIN_SECTIONS = [
  { path: "/admin/layers", label: "common:header:admin:layers", Icon: LayersOutlinedIcon },
  {
    path: "/admin/categories",
    label: "common:header:admin:categories",
    Icon: GridViewOutlinedIcon,
  },
  { path: "/admin/usage", label: "common:header:admin:usage", Icon: BarChartOutlinedIcon },
] as const;

/** Whether `pathname` (with or without a locale) is in the section at `path`. */
export const isInAdminSection = (pathname: string, path: string) =>
  new RegExp(`^/(?:[a-z]{2}/)?${path.slice(1)}(?:/|$)`).test(pathname);
