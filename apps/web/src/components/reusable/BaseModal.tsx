import {
  Breakpoint,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";

export interface BaseModalProps {
  isOpen: boolean;
  handleClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: Breakpoint;
  onAfterClose?: () => void;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  handleClose,
  title,
  maxWidth = "lg",
  children,
  onAfterClose,
}) => {
  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      fullWidth
      maxWidth={maxWidth}
      onTransitionExited={onAfterClose}
    >
      <DialogTitle sx={{ fontSize: "24px" }}>{title}</DialogTitle>
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={(theme) => ({
          position: "absolute",
          right: theme.spacing(1.5),
          top: theme.spacing(2),
          color: theme.palette.grey[500],
        })}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent sx={{ paddingTop: 0 }}>{children}</DialogContent>
    </Dialog>
  );
};
