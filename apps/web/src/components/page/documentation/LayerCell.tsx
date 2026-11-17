import { Box, useTheme } from "@mui/material";

const MISSING = "—";

export interface LayerCellText {
  main: string | null;
  detail?: string | null;
  strong?: boolean;
}

/** A cell's value ("—" when missing) and its optional detail below. */
export const LayerCell: React.FC<LayerCellText> = ({ main, detail, strong }) => {
  const colors = useTheme().palette.landing;
  return (
    <Box>
      <Box component={strong ? "b" : "span"} sx={{ fontWeight: strong ? 600 : undefined }}>
        {main ?? MISSING}
      </Box>
      {detail && <Box sx={{ color: colors.muted, fontSize: 12.5 }}>{detail}</Box>}
    </Box>
  );
};
