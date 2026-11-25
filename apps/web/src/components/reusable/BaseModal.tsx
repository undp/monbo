import { useId } from "react";
import { Box, Breakpoint, Dialog, DialogContent } from "@mui/material";
import { ModalHeader, ModalHeaderProps } from "./Modals/ModalHeader";
import { MODAL_FOOTER, MODAL_PADDING, MODAL_PAPER } from "./Modals/modalStyles";

export interface BaseModalProps {
  isOpen: boolean;
  handleClose: () => void;
  title: string;
  /** Under the title; it also describes the dialog. */
  subtitle?: string;
  icon?: React.ReactNode;
  tone?: ModalHeaderProps["tone"];
  children: React.ReactNode;
  /** The modal's buttons, in a footer on the right. */
  actions?: React.ReactNode;
  maxWidth?: Breakpoint;
  onAfterClose?: () => void;
}

/** A modal in the v2 look: `ModalHeader`, the content, and an optional footer. */
export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  handleClose,
  title,
  subtitle,
  icon,
  tone,
  maxWidth = "lg",
  children,
  actions,
  onAfterClose,
}) => {
  const subtitleId = useId();
  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      fullWidth
      maxWidth={maxWidth}
      onTransitionExited={onAfterClose}
      aria-describedby={subtitle ? subtitleId : undefined}
      slotProps={{ paper: { sx: MODAL_PAPER } }}
    >
      <ModalHeader
        title={title}
        subtitle={subtitle}
        subtitleId={subtitleId}
        icon={icon}
        tone={tone}
        onClose={handleClose}
      />
      <DialogContent sx={{ padding: MODAL_PADDING }}>{children}</DialogContent>
      {actions && <Box sx={MODAL_FOOTER}>{actions}</Box>}
    </Dialog>
  );
};
