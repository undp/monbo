"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Toolbar } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getConfig } from "@/api/config";
import { isRuntimeConfigLoaded, setRuntimeConfig } from "@/config/runtime";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { useIsStartPage } from "@/hooks/useIsStartPage";

/** Renders the app only once the API's product settings (GET /config) have loaded:
 * the thresholds the formatting helpers read must never fall back to a default. */
export const RuntimeConfigGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const isStartPage = useIsStartPage();
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

  // The start page's header is transparent over the hero, which these states lack.
  const headerBand = isStartPage && (
    <Box data-testid="runtime-config-header-band" sx={{ backgroundColor: "landing.navy" }}>
      <Toolbar />
    </Box>
  );

  if (state === "error") {
    return (
      <>
        {headerBand}
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
      </>
    );
  }

  return (
    <>
      {headerBand}
      <LoadingScreen text={t("common:runtimeConfig:loading")} />
    </>
  );
};
