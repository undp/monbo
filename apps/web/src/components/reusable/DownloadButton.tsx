import { Button, CircularProgress, Menu, MenuItem } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import React, { useCallback } from "react";

interface DownloadButtonProps {
  size?: number;
  options?: {
    label: string;
    onClick: () => Promise<void> | void;
    disabled?: boolean;
  }[];
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  size = 35,
  options,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const open = Boolean(anchorEl);

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
        sx={{ padding: 0, minWidth: size, height: size }}
        id="basic-button"
        disabled={isLoading}
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        {isLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
      </Button>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
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
