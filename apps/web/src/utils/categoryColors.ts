import { alpha } from "@mui/material/styles";

// The grey of a layer whose category is missing.
export const NO_CATEGORY_COLOR = "#676767";

/** The tints of a category color: a soft background and a fainter one. */
export const categoryTints = (color: string | null | undefined) => {
  const base = color ?? NO_CATEGORY_COLOR;
  return {
    color: base,
    background: alpha(base, 0.12),
    faintBackground: alpha(base, 0.05),
  };
};
