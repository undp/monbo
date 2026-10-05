import { Box, Button, ButtonProps } from "@mui/material";
import { BaseModal, BaseModalProps } from "../BaseModal";

interface ActionModalProps
  extends Pick<
    BaseModalProps,
    "isOpen" | "handleClose" | "title" | "maxWidth"
  > {
  description: string;
  actions: ({
    title: string;
    handler: () => void;
  } & Omit<ButtonProps, "onClick">)[];
}

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  handleClose,
  title,
  maxWidth,
  description,
  actions,
}) => {
  return (
    <BaseModal
      isOpen={isOpen}
      handleClose={handleClose}
      title={title}
      maxWidth={maxWidth}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {description}
        <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
          {actions.map(({ title, handler, ...rest }) => (
            <Button key={title} onClick={handler} {...rest}>
              {title}
            </Button>
          ))}
        </Box>
      </Box>
    </BaseModal>
  );
};
