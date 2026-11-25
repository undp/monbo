import type { SvgIconProps } from "@mui/material";
import AddRoadOutlinedIcon from "@mui/icons-material/AddRoadOutlined";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import EnergySavingsLeafOutlinedIcon from "@mui/icons-material/EnergySavingsLeafOutlined";
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";
import FloodOutlinedIcon from "@mui/icons-material/FloodOutlined";
import ForestOutlinedIcon from "@mui/icons-material/ForestOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import GrainOutlinedIcon from "@mui/icons-material/GrainOutlined";
import GrassOutlinedIcon from "@mui/icons-material/GrassOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HardwareOutlinedIcon from "@mui/icons-material/HardwareOutlined";
import HolidayVillageOutlinedIcon from "@mui/icons-material/HolidayVillageOutlined";
import LandscapeOutlinedIcon from "@mui/icons-material/LandscapeOutlined";
import LandslideOutlinedIcon from "@mui/icons-material/LandslideOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import LocalCafeOutlinedIcon from "@mui/icons-material/LocalCafeOutlined";
import LocalFireDepartmentOutlinedIcon from "@mui/icons-material/LocalFireDepartmentOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import ParkOutlinedIcon from "@mui/icons-material/ParkOutlined";
import PetsOutlinedIcon from "@mui/icons-material/PetsOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import VolcanoOutlinedIcon from "@mui/icons-material/VolcanoOutlined";
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import YardOutlinedIcon from "@mui/icons-material/YardOutlined";
import type { LayerCategoryIcon as IconName } from "@/interfaces/LayerCategory";

// The icon catalogue of `GET /categories` (D15), in the order the admin's picker
// shows it. A name the web doesn't know yet falls back to the generic layers icon.
const ICONS: Record<IconName, React.ComponentType<SvgIconProps>> = {
  forest: ForestOutlinedIcon,
  park: ParkOutlinedIcon,
  wetland: GrassOutlinedIcon,
  leaf: EnergySavingsLeafOutlinedIcon,
  wildlife: PetsOutlinedIcon,
  shield: ShieldOutlinedIcon,
  legal: GavelOutlinedIcon,
  community: GroupsOutlinedIcon,
  map: MapOutlinedIcon,
  global: PublicOutlinedIcon,
  water: WaterDropOutlinedIcon,
  coast: WavesOutlinedIcon,
  flood: FloodOutlinedIcon,
  agriculture: AgricultureOutlinedIcon,
  crop: GrainOutlinedIcon,
  coffee: LocalCafeOutlinedIcon,
  pasture: YardOutlinedIcon,
  mountain: LandscapeOutlinedIcon,
  volcano: VolcanoOutlinedIcon,
  landslide: LandslideOutlinedIcon,
  fire: LocalFireDepartmentOutlinedIcon,
  mining: HardwareOutlinedIcon,
  infrastructure: AddRoadOutlinedIcon,
  settlement: HolidayVillageOutlinedIcon,
  industry: FactoryOutlinedIcon,
  layers: LayersOutlinedIcon,
};

/** The icons an admin can give a category, in the catalogue's order. */
export const CATEGORY_ICON_NAMES = Object.keys(ICONS) as IconName[];

interface Props extends SvgIconProps {
  /** Null for a layer whose category is missing. */
  icon: IconName | null | undefined;
}

/** A layer category's icon. */
export const LayerCategoryIcon: React.FC<Props> = ({ icon, ...props }) => {
  const Icon = (icon && ICONS[icon]) || LayersOutlinedIcon;
  return <Icon {...props} />;
};
