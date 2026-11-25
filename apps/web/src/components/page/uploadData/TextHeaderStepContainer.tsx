import { Box, Divider, SxProps, Theme } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { SectionBackground } from "@/components/reusable/SectionBackground";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";

interface Props {
  sx?: SxProps<Theme>;
  title: string;
  /** A line under the title */
  subtitle?: string;
  /** Shown before the title, instead of a number (the flow's stages are numbered) */
  icon?: React.ReactNode;
  children: React.ReactNode;
}
export const TextHeaderStepContainer: React.FC<Props> = ({
  sx,
  title,
  subtitle,
  icon,
  children,
}) => {
  const heading = (
    <>
      <Text variant="h4" bold>
        {title}
      </Text>
      {subtitle && (
        <Text variant="body1" color="secondary" sx={{ marginTop: 0.5 }}>
          {subtitle}
        </Text>
      )}
    </>
  );
  return (
    <SectionBackground sx={{ padding: 2, flexDirection: "column", ...sx }}>
      {icon ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            aria-hidden
            sx={{
              width: 38,
              height: 38,
              flex: "none",
              borderRadius: 2.5,
              display: "grid",
              placeItems: "center",
              backgroundColor: FLOW_COLORS.mint,
              color: FLOW_COLORS.leafDark,
            }}
          >
            {icon}
          </Box>
          <Box>{heading}</Box>
        </Box>
      ) : (
        heading
      )}
      <Divider sx={{ marginTop: 2, marginBottom: 2 }} />
      {children}
    </SectionBackground>
  );
};
