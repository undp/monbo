import { Box, CircularProgress } from "@mui/material";
import {
  FLOW_COLORS,
  FLOW_CONTENT_MAX_WIDTH,
  STAGE_CARD,
} from "@/components/page/flow/flowStyles";

interface LoadingScreenProps {
  text: string;
}

/**
 * A page's wait (an analysis, a file being read): a stage card with a spinner, as
 * wide as a stage page's body, so it fits under the flow header.
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ text }) => {
  return (
    <Box
      sx={{
        padding: { xs: "24px 16px", md: "32px 24px" },
        backgroundColor: FLOW_COLORS.pageBackground,
      }}
    >
      <Box
        role="status"
        aria-live="polite"
        sx={{
          ...STAGE_CARD,
          maxWidth: FLOW_CONTENT_MAX_WIDTH,
          minHeight: 360,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 2.5,
          textAlign: "center",
        }}
      >
        <CircularProgress size={56} thickness={3.6} sx={{ color: FLOW_COLORS.blue }} />
        <Box
          component="p"
          sx={{ margin: 0, fontSize: 15, fontWeight: 500, color: FLOW_COLORS.ink2 }}
        >
          {text}
        </Box>
      </Box>
    </Box>
  );
};
