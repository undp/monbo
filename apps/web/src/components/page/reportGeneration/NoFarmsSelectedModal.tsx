import { ActionModal } from "@/components/reusable/Modals/ActionModal";
import { useTranslation } from "react-i18next";

export const NoFarmsSelectedModal = ({
  isOpen,
  handleClose,
}: {
  isOpen: boolean;
  handleClose: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <ActionModal
      maxWidth="sm"
      isOpen={isOpen}
      title={t("reportGeneration:emptyFarmsSelectionModal:title")}
      description={t("reportGeneration:emptyFarmsSelectionModal:description")}
      handleClose={handleClose}
      actions={[
        {
          title: t("reportGeneration:emptyFarmsSelectionModal:button"),
          handler: handleClose,
          variant: "contained",
        },
      ]}
    />
  );
};
