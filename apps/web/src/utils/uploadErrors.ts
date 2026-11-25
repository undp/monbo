import type { TFunction } from "i18next";
import type { SnackbarType } from "@/context/SnackbarContext";

// One notice per error flooded the screen: a file missing a column in every row
// opened 1000 notices at once. The first few are shown, then one with the rest.
export const MAX_UPLOAD_ERROR_NOTICES = 5;

/** Shows an uploaded file's errors as at most 5 notices, plus one with the rest. */
export const notifyUploadErrors = (
  openSnackbar: (params: { message: string; type: SnackbarType }) => void,
  errorMessages: string[],
  t: TFunction
) => {
  errorMessages
    .slice(0, MAX_UPLOAD_ERROR_NOTICES)
    .forEach((message) => openSnackbar({ message, type: "error" }));
  const rest = errorMessages.length - MAX_UPLOAD_ERROR_NOTICES;
  if (rest > 0)
    openSnackbar({
      message: t("common:snackbarAlerts:moreUploadErrors", { count: rest }),
      type: "error",
    });
};
