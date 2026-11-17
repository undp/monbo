import { Box, useTheme } from "@mui/material";
import { NEUTRAL_CHIP_BACKGROUND, RESULT_COLORS } from "./methodologyStyles";

/** A chip of a category's block: its threshold (neutral) or one of its results. */
export const ResultChip: React.FC<{ kind: "ok" | "flagged" | "neutral"; children: React.ReactNode }> = ({
  kind,
  children,
}) => {
  const colors = useTheme().palette.landing;
  const palette =
    kind === "neutral" ? { color: colors.inkSecondary, background: NEUTRAL_CHIP_BACKGROUND } : RESULT_COLORS[kind];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        borderRadius: 999,
        px: 1.25,
        py: 0.5,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.3,
        color: palette.color,
        backgroundColor: palette.background,
      }}
    >
      {children}
    </Box>
  );
};
