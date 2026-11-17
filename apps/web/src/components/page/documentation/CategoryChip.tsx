import { Box } from "@mui/material";
import { CategoryIcon } from "@/components/reusable/CategoryIcon";
import { categoryTint } from "./methodologyStyles";

interface CategoryChipProps {
  name: string;
  icon: string;
  color: string;
}

/** A category's name with its icon, in its color. */
export const CategoryChip: React.FC<CategoryChipProps> = ({ name, icon, color }) => (
  <Box
    component="span"
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: 0.75,
      py: 0.5,
      pl: 0.75,
      pr: 1.25,
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 500,
      lineHeight: 1.3,
      color,
      backgroundColor: categoryTint(color),
    }}
  >
    <Box
      component="span"
      sx={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        backgroundColor: color,
        color: "common.white",
        flex: "none",
      }}
    >
      <CategoryIcon icon={icon} sx={{ fontSize: 13 }} />
    </Box>
    {name}
  </Box>
);
