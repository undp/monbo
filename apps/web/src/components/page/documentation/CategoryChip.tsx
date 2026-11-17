import { Box } from "@mui/material";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import type { LayerCategoryIcon as IconName } from "@/interfaces/LayerCategory";
import { categoryTints } from "@/utils/categoryColors";

interface CategoryChipProps {
  name: string;
  /** Null for the layers whose category isn't published: the generic icon, in grey. */
  icon: IconName | null;
  color: string | null;
}

/** A category's name with its icon, in its color (as in the territorial analysis). */
export const CategoryChip: React.FC<CategoryChipProps> = ({ name, icon, color }) => {
  const tints = categoryTints(color);
  return (
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
        color: tints.color,
        backgroundColor: tints.background,
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
          backgroundColor: tints.color,
          color: "common.white",
          flex: "none",
        }}
      >
        <LayerCategoryIcon icon={icon} sx={{ fontSize: 13 }} aria-hidden />
      </Box>
      {name}
    </Box>
  );
};
