import AgricultureIcon from "@mui/icons-material/Agriculture";
import ForestIcon from "@mui/icons-material/Forest";
import LayersIcon from "@mui/icons-material/Layers";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import ShieldIcon from "@mui/icons-material/Shield";
import TerrainIcon from "@mui/icons-material/Terrain";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import WavesIcon from "@mui/icons-material/Waves";
import type { SvgIconProps } from "@mui/material";
import type { LayerCategoryIcon } from "@/interfaces/LayerCategory";

// The API's icon catalog is semantic; this is the one place that draws it.
const ICONS: Record<LayerCategoryIcon, React.ComponentType<SvgIconProps>> = {
  forest: ForestIcon,
  shield: ShieldIcon,
  agriculture: AgricultureIcon,
  water: WaterDropIcon,
  mountain: TerrainIcon,
  wetland: WavesIcon,
  fire: LocalFireDepartmentIcon,
  layers: LayersIcon,
};

interface CategoryIconProps extends SvgIconProps {
  /** A value of the catalog; one this release doesn't know gets the generic icon. */
  icon: string;
}

/** A layer category's icon. Decorative: the category's name goes next to it. */
export const CategoryIcon: React.FC<CategoryIconProps> = ({ icon, ...props }) => {
  const Icon = ICONS[icon as LayerCategoryIcon] ?? LayersIcon;
  return <Icon aria-hidden {...props} />;
};
