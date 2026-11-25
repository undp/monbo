import { Button, CircularProgress, Menu, MenuItem } from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import React, { useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import { PAGE_ACTION_HEIGHT } from "@/components/page/flow/flowStyles";

interface DownloadButtonProps {
  options?: {
    label: string;
    onClick: () => Promise<void> | void;
    disabled?: boolean;
  }[];
}

/**
 * "Descargar", with its formats in a menu: an outlined button as the page's other
 * actions (e.g. "Cambiar capas"), named by its text.
 */
export const DownloadButton: React.FC<DownloadButtonProps> = ({ options }) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const open = Boolean(anchorEl);
  const buttonId = useId();
  const menuId = useId();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);
    },
    []
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const wrapOptionCallback = useCallback(
    (option: NonNullable<DownloadButtonProps["options"]>[number]) =>
      async () => {
        // No try catch here, because the error is already handled in the onClick callback
        setIsLoading(true);
        await option.onClick();
        setIsLoading(false);
        handleClose();
      },
    [handleClose]
  );

  return (
    <>
      <Button
        variant="outlined"
        id={buttonId}
        disabled={isLoading}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        startIcon={
          isLoading ? <CircularProgress size={18} color="inherit" /> : <DownloadRoundedIcon />
        }
        endIcon={<KeyboardArrowDownRoundedIcon />}
        sx={{ height: PAGE_ACTION_HEIGHT, whiteSpace: "nowrap", flexShrink: 0 }}
      >
        {t("common:download")}
      </Button>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          list: { "aria-labelledby": buttonId },
          paper: { sx: { borderRadius: "10px", minWidth: 160 } },
        }}
      >
        {options?.map((option) => (
          <MenuItem
            key={option.label}
            onClick={wrapOptionCallback(option)}
            disabled={option.disabled}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
