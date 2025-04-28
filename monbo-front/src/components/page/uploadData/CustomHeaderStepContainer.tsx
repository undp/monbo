import { Box, Divider, SxProps, Theme } from "@mui/material";
import { SectionBackground } from "@/components/reusable/SectionBackground";

interface Props {
  sx?: SxProps<Theme>;
  header: React.ReactNode;
  children: React.ReactNode;
}
export const CustomHeaderStepContainer: React.FC<Props> = ({
  sx,
  header,
  children,
}) => {
  return (
    <SectionBackground sx={{ padding: 2, flexDirection: "column", ...sx }}>
      <Box sx={{ width: "100%" }}>{header}</Box>
      <Divider sx={{ marginTop: 2, marginBottom: 2 }} />
      {children}
    </SectionBackground>
  );
};
