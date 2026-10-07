"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getConfig } from "@/api/config";
import { isRuntimeConfigLoaded, setRuntimeConfig } from "@/config/runtime";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";

/** Renders the app only once the API's product settings (GET /config) have loaded:
 * the thresholds the formatting helpers read must never fall back to a default. */
export const RuntimeConfigGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<"loading" | "ready" | "error">(() =>
    isRuntimeConfigLoaded() ? "ready" : "loading"
  );

  // State changes only when the request settles (no synchronous setState in the
  // effect); the retry button sets "loading" itself.
  const fetchConfig = useCallback(() => {
    getConfig()
      .then((config) => {
        setRuntimeConfig(config);
        setState("ready");
      })
      .catch((error) => {
        console.error(error);
        setState("error");
      });
  }, []);

  useEffect(() => {
    if (state === "loading") fetchConfig();
  }, [fetchConfig, state]);

  const retry = () => {
    setState("loading");
  };

  if (state === "ready") return <>{children}</>;

  if (state === "error") {
    return (
      <Box sx={{ padding: 3, display: "flex", justifyContent: "center" }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={retry}>
              {t("common:runtimeConfig:retry")}
            </Button>
          }
        >
          {t("common:runtimeConfig:error")}
        </Alert>
      </Box>
    );
  }

  return <LoadingScreen text={t("common:runtimeConfig:loading")} />;
};
