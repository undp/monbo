"use client";

import { Alert, Grow, Snackbar, Stack } from "@mui/material";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export type SnackbarType = "success" | "info" | "error" | "warning";

// The v2 look: a white card with the type's color on its icon and left edge, as
// the stage pages' result pills use them
const TYPE_COLORS: Record<SnackbarType, string> = {
  success: FLOW_COLORS.ok,
  info: FLOW_COLORS.blue,
  warning: FLOW_COLORS.warn,
  error: FLOW_COLORS.bad,
};

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
  /**
   * The translated name of each snackbar's close button. The provider sits in the
   * root layout, above every page's translations, so the layout passes it in.
   */
  closeLabel: string;
}

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({
  children,
  closeLabel,
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
              closeLabel={closeLabel}
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
  closeLabel: string;
}
const CustomSnackbar: React.FC<CustomSnackbarProps> = ({
  open,
  handleClose,
  message,
  type,
  closeLabel,
}) => {
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      handleClose();
    }, 15000);
  }, [handleClose, open]);

  return (
    <Grow in={open} timeout={300} unmountOnExit>
      <Alert
        onClose={handleClose}
        closeText={closeLabel}
        severity={type}
        variant="outlined"
        sx={{
          alignItems: "center",
          minWidth: 280,
          maxWidth: 440,
          padding: "6px 10px 6px 14px",
          borderRadius: "12px",
          border: `1px solid ${FLOW_COLORS.line}`,
          borderLeft: `4px solid ${TYPE_COLORS[type]}`,
          backgroundColor: FLOW_COLORS.white,
          color: FLOW_COLORS.ink,
          fontSize: 14,
          fontWeight: 500,
          boxShadow: "0 1px 2px rgba(11, 37, 69, 0.06), 0 12px 32px rgba(11, 37, 69, 0.14)",
          "& .MuiAlert-icon": { color: TYPE_COLORS[type], opacity: 1 },
          "& .MuiAlert-action .MuiIconButton-root": { color: FLOW_COLORS.muted },
        }}
      >
        {message}
      </Alert>
    </Grow>
  );
};
