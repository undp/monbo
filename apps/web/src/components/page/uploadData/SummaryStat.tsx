import { Box } from "@mui/material";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";

/** A count of the upload's bottom bar: "5 polígonos". */
export const SummaryStat: React.FC<{
  icon: React.ReactNode;
  count: number;
  label: string;
}> = ({ icon, count, label }) => (
  <Box
    component="span"
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      fontSize: 14,
      color: FLOW_COLORS.ink2,
      "& svg": { color: FLOW_COLORS.muted },
    }}
  >
    {icon}
    <Box component="b" sx={{ color: FLOW_COLORS.ink, fontSize: 16 }}>
      {count}
    </Box>
    {label}
  </Box>
);
