import { Divider, SxProps, Theme } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { SectionBackground } from "@/components/reusable/SectionBackground";

interface Props {
  sx?: SxProps<Theme>;
  title: string;
  children: React.ReactNode;
}
export const TextHeaderStepContainer: React.FC<Props> = ({
  sx,
  title,
  children,
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
