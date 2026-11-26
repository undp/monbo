import { Box, useTheme } from "@mui/material";
import { resultClassBackgroundColor, resultClassColor } from "@/utils/styling";

/**
 * A category's threshold (neutral) or one of its results, in the result colors of
 * D23: "ok" green and "flagged" red whatever the category color (methodology and admin).
 */
export const ResultChip: React.FC<{ kind: "ok" | "flagged" | "neutral"; children: React.ReactNode }> = ({
  kind,
  children,
}) => {
  const colors = useTheme().palette.landing;
  const palette =
    kind === "neutral"
      ? { color: colors.inkSecondary, background: "result.neutralBackground" }
      : { color: resultClassColor(kind), background: resultClassBackgroundColor(kind) };
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
