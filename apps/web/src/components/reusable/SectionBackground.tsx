"use client";

import { styled } from "@mui/material/styles";
import Paper, { PaperProps } from "@mui/material/Paper";

const StylizedPaper = styled(Paper)<PaperProps>(({ theme }) => ({
  backgroundColor: "#FFF",
  padding: theme.spacing(1),
  borderColor: "#DEDEDE",
  borderWidth: 1,
  display: "flex",
  height: "100%",
}));

interface SectionBackgroundProps extends PaperProps {
  children?: React.ReactNode;
}
export const SectionBackground: React.FC<SectionBackgroundProps> = ({
  children,
  ...props
}) => {
  return (
    <StylizedPaper elevation={0} {...props}>
      {children}
    </StylizedPaper>
  );
};
