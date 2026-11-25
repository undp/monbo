import { useId } from "react";
import { Box, Button, ButtonProps } from "@mui/material";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { BaseModal, BaseModalProps } from "../BaseModal";

interface ActionModalProps
  extends Pick<
    BaseModalProps,
    "isOpen" | "handleClose" | "title" | "maxWidth" | "icon" | "tone"
  > {
  description: string;
  actions: ({
    title: string;
    handler: () => void;
  } & Omit<ButtonProps, "onClick">)[];
}

/**
 * A question with its answers as buttons, in the modal's footer. The question
 * describes the dialog, so a screen reader reads it with the title.
 */
export const ActionModal: React.FC<ActionModalProps> = ({
  description,
  actions,
  ...modal
}) => {
  const descriptionId = useId();
  return (
    <BaseModal
      {...modal}
      describedById={descriptionId}
      actions={actions.map(({ title, handler, ...rest }) => (
        <Button key={title} onClick={handler} {...rest}>
          {title}
        </Button>
      ))}
    >
      <Box
        component="p"
        id={descriptionId}
        sx={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: FLOW_COLORS.ink2 }}
      >
        {description}
      </Box>
    </BaseModal>
  );
};
