import { Box, Paper, CircularProgress } from "@mui/material";
import { Text } from "@/components/reusable/Text";

interface LoadingScreenProps {
  text: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ text }) => {
  return (
    <Box
      sx={{
        height: "calc(100vh - 64px)",
        padding: 3,
      }}
    >
      <Paper
        sx={{
          width: "100%",
          height: "100%",
          backgroundColor: "#F5F5F5",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          borderRadius: 2,
        }}
        elevation={0}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <CircularProgress size={120} />
          <Text variant="body1">{text}</Text>
        </Box>
      </Paper>
    </Box>
  );
};
