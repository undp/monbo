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

/**
 * The API makes the id from the Spanish name, adding `_2`, `_3`... when it is
 * taken. 409 when the country's categories file can't be read, 400 when layers
 * already pointing at that id don't fit the category.
 */
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
