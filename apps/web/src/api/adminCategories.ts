import type {
  AdminCategories,
  AdminCategory,
  CategoryCreate,
  CategoryInput,
} from "@/interfaces/AdminLayer";
import { request } from "./adminLayers";
import type { components } from "./schema";

// The session's country's layer categories (`/admin/categories`). Every call is
// scoped to the token's country by the API.

export const listAdminCategories = (token: string) =>
  request<AdminCategories>("/categories", { token });

/** 409 when the id is already used in the country or the categories file is unreadable. */
export const createAdminCategory = (token: string, input: CategoryCreate) =>
  request<AdminCategory>("/categories", { token, method: "POST", body: input });

export const updateAdminCategory = (
  token: string,
  id: string,
  input: CategoryInput
) =>
  request<AdminCategory>(`/categories/${encodeURIComponent(id)}`, {
    token,
    method: "PUT",
    body: input,
  });

export const setAdminCategoryEnabled = (
  token: string,
  id: string,
  enabled: boolean
) =>
  request<AdminCategory>(`/categories/${encodeURIComponent(id)}`, {
    token,
    method: "PATCH",
    body: { enabled } satisfies components["schemas"]["EnabledInput"],
  });
