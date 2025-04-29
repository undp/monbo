import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";

interface Props {
  message: string;
}

export const MessageBox: React.FC<Props> = ({ message }) => {
  return (
    <Box
      sx={{
        backgroundColor: "#F5F5F5",
        padding: 2,
        borderRadius: 2,
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <Text variant="body1" color="secondary">
        {message}
      </Text>
    </Box>
  );
};
