import { Box, SxProps, Theme } from "@mui/material";
import { PointIcon } from "../icons/PointIcon";
import { PolygonIcon } from "../icons/PolygonIcon";
import { ValidManuallyChip } from "../page/polygonsValidation/ValidManuallyChip";

interface Props {
  polygonType: "point" | "polygon";
  isValidManually?: boolean;
  sx?: SxProps<Theme>;
}

export const PolygonTypeIcon: React.FC<Props> = ({
  polygonType,
  isValidManually,
  sx,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexGrow: 0,
        ...sx,
      }}
    >
      {polygonType === "point" ? <PointIcon /> : <PolygonIcon />}
      {isValidManually && <ValidManuallyChip />}
    </Box>
  );
};
