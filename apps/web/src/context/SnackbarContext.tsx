"use client";

import { Alert, Grow, Snackbar, Stack } from "@mui/material";
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type SnackbarType = "success" | "info" | "error" | "warning";

interface SnackbarContextValue {
  openSnackbar: (params: { message: string; type: SnackbarType }) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue>({
  openSnackbar: () => {},
});

const generateId = () => {
  return (
    "id-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
  );
};

interface SnackbarData {
  id: string;
  open: boolean;
  message: string;
  type: SnackbarType;
}

interface SnackbarProviderProps {
  children: React.ReactNode;
}

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({
  children,
}) => {
  const [snackbarPool, setSnackbarPool] = useState<SnackbarData[]>([]);

  const openSnackbar = useCallback(
    ({ message, type }: { message: string; type: SnackbarType }) => {
      setSnackbarPool((prev) => {
        // Find the first snackbar that is not open
        const index = prev.findIndex((snackbar) => !snackbar.open);

        if (index === -1) {
          // Add a new snackbar if no closed ones exist
          return [
            ...prev,
            {
              id: generateId(),
              open: true,
              message,
              type,
            },
          ];
        }

        // Update an existing snackbar that is not open
        return prev.map((snackbar, i) =>
          i === index ? { ...snackbar, open: true, message, type } : snackbar
        );
      });
    },
    [] // No external dependencies
  );

  const handleCloseSnackbar = useCallback((id: string) => {
    setSnackbarPool((prev) =>
      prev.map((snackbar) =>
        snackbar.id === id ? { ...snackbar, open: false } : snackbar
      )
    );
  }, []);

  const ctx = useMemo(
    () => ({
      openSnackbar,
    }),
    [openSnackbar]
  );

  return (
    <SnackbarContext.Provider value={ctx}>
      {children}

      <Snackbar
        open={true}
        autoHideDuration={null}
        transitionDuration={0}
        sx={{
          mt: "env(safe-area-inset-top)",
          mb: "env(safe-area-inset-bottom)",
        }}
      >
        <Stack gap={1} flexDirection="column">
          {snackbarPool.map(({ id, open, ...other }) => (
            <CustomSnackbar
              key={id}
              open={open!}
              handleClose={() => handleCloseSnackbar(id)}
              {...other}
            />
          ))}
        </Stack>
      </Snackbar>
    </SnackbarContext.Provider>
  );
};

interface CustomSnackbarProps {
  open: boolean;
  handleClose: () => void;
  message: React.ReactNode;
  type: SnackbarType;
}
const CustomSnackbar: React.FC<CustomSnackbarProps> = ({
  open,
  handleClose,
  message,
  type,
}) => {
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      handleClose();
    }, 15000);
  }, [handleClose, open]);

  return (
    <Grow in={open} timeout={300} unmountOnExit>
      <Alert onClose={handleClose} severity={type} variant="filled">
        {message}
      </Alert>
    </Grow>
  );
};
