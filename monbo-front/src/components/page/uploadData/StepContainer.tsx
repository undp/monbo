import { Divider, SxProps, Theme } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { SectionBackground } from "@/components/reusable/SectionBackground";

interface StepContainerProps {
  children: React.ReactNode;
  title: string;
  sx?: SxProps<Theme>;
}
export const StepContainer: React.FC<StepContainerProps> = ({
  children,
  title,
  sx,
}) => {
  return (
    <SectionBackground sx={{ padding: 2, flexDirection: "column", ...sx }}>
      <Text variant="h4" bold>
        {title}
      </Text>
      <Divider sx={{ marginTop: 2, marginBottom: 2 }} />
      {children}
    </SectionBackground>
  );
};
