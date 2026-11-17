import { Box, useTheme } from "@mui/material";

const MISSING = "—";

export interface LayerCellText {
  main: string | null;
  detail?: string | null;
  strong?: boolean;
  /** Keep the value on one line ("2020 → 2023"). */
  nowrap?: boolean;
}

/** A cell's value ("—" when missing) and its optional detail below. */
export const LayerCell: React.FC<LayerCellText> = ({ main, detail, strong, nowrap }) => {
  const colors = useTheme().palette.landing;
  return (
    <Box>
      <Box component={strong ? "b" : "span"} sx={{ fontWeight: strong ? 600 : undefined, whiteSpace: nowrap ? "nowrap" : undefined }}>
        {main ?? MISSING}
      </Box>
      {detail && <Box sx={{ color: colors.muted, fontSize: 12.5 }}>{detail}</Box>}
    </Box>
  );
};
