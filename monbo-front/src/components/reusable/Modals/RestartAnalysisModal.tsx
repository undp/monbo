"use client";

import { useTranslation } from "react-i18next";
import { ActionModal } from "./ActionModal";
import { getCountryName } from "@/utils/countries";

interface RestartAnalysisModalProps {
  // The country the user asked for; the modal is open while it is set.
  pendingCountry: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RestartAnalysisModal: React.FC<RestartAnalysisModalProps> = ({
  pendingCountry,
  onConfirm,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const country = pendingCountry
    ? getCountryName(pendingCountry, i18n.language as "en" | "es") ??
      pendingCountry
    : "";

  return (
    <ActionModal
      maxWidth="sm"
      isOpen={!!pendingCountry}
      handleClose={onCancel}
      title={t("common:countrySelection:restartModal:title")}
      description={t("common:countrySelection:restartModal:description", {
        country,
      })}
      actions={[
        {
          title: t("common:countrySelection:restartModal:cancel"),
          handler: onCancel,
          variant: "outlined",
        },
        {
          title: t("common:countrySelection:restartModal:confirm"),
          handler: onConfirm,
          variant: "contained",
        },
      ]}
    />
  );
};
