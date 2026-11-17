import type { SvgIconProps } from "@mui/material";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import ForestOutlinedIcon from "@mui/icons-material/ForestOutlined";
import GrassOutlinedIcon from "@mui/icons-material/GrassOutlined";
import LandscapeOutlinedIcon from "@mui/icons-material/LandscapeOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import LocalFireDepartmentOutlinedIcon from "@mui/icons-material/LocalFireDepartmentOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined";
import type { LayerCategoryIcon as IconName } from "@/interfaces/LayerCategory";

// The icon catalogue of `GET /categories` (D15). A name the web doesn't know yet
// falls back to the generic layers icon.
const ICONS: Record<IconName, React.ComponentType<SvgIconProps>> = {
  forest: ForestOutlinedIcon,
  shield: ShieldOutlinedIcon,
  agriculture: AgricultureOutlinedIcon,
  water: WaterDropOutlinedIcon,
  mountain: LandscapeOutlinedIcon,
  wetland: GrassOutlinedIcon,
  fire: LocalFireDepartmentOutlinedIcon,
  layers: LayersOutlinedIcon,
};

interface Props extends SvgIconProps {
  /** Null for a layer whose category is missing. */
  icon: IconName | null | undefined;
}

/** A layer category's icon. */
export const LayerCategoryIcon: React.FC<Props> = ({ icon, ...props }) => {
  const Icon = (icon && ICONS[icon]) || LayersOutlinedIcon;
  return <Icon {...props} />;
};
