import { Divider, SxProps, Theme } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { SectionBackground } from "@/components/reusable/SectionBackground";

interface Props {
  sx?: SxProps<Theme>;
  title: string;
  /** A line under the title */
  subtitle?: string;
  children: React.ReactNode;
}
export const TextHeaderStepContainer: React.FC<Props> = ({
  sx,
  title,
  subtitle,
  children,
}) => {
  return (
    <SectionBackground sx={{ padding: 2, flexDirection: "column", ...sx }}>
      <Text variant="h4" bold>
        {title}
      </Text>
      {subtitle && (
        <Text variant="body1" color="secondary" sx={{ marginTop: 0.5 }}>
          {subtitle}
        </Text>
      )}
      <Divider sx={{ marginTop: 2, marginBottom: 2 }} />
      {children}
    </SectionBackground>
  );
};
