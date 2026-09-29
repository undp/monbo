"use client";

import { useCallback, useContext } from "react";
import { Box, Button, CircularProgress, Paper } from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/reusable/Text";
import { RestartAnalysisModal } from "@/components/reusable/Modals/RestartAnalysisModal";
import { DataContext } from "@/context/DataContext";
import { useAvailableCountries } from "@/hooks/useAvailableCountries";
import { useCountryChange } from "@/hooks/useCountryChange";
import { CONTACT_URL } from "@/config/env";
import { CountryMap } from "./CountryMap";

export const LandingPageContent: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCountry } = useContext(DataContext);
  const { countries, loading } = useAvailableCountries();
  const { requestCountryChange, pendingCountry, confirmRestart, cancelRestart } =
    useCountryChange();

  const onSelect = useCallback(
    (code: string) => requestCountryChange(code, { navigateTo: "/home" }),
    [requestCountryChange]
  );

  return (
    <Box
      sx={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: 3,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <Box sx={{ textAlign: "center", marginTop: 1 }}>
        <Text variant="h1" sx={{ fontSize: 34, fontWeight: 500, mb: 2 }}>
          {t("home:landing:title")}
        </Text>
        <Text variant="h2" sx={{ fontSize: 20, fontWeight: 400 }}>
          {t("home:landing:subtitle")}
        </Text>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 280px" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden" }}>
          <CountryMap
            countries={countries}
            selectedCountry={selectedCountry}
            onSelect={onSelect}
          />
        </Paper>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Text variant="h3" bold>
            {t("home:landing:availableCountries")}
          </Text>
          {loading ? (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <CircularProgress size={20} />
              <Text>{t("home:landing:loading")}</Text>
            </Box>
          ) : countries.length === 0 ? (
            <Text>{t("home:landing:noCountries")}</Text>
          ) : (
            <Box
              component="ul"
              sx={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {countries.map(({ code, name }) => (
                <li key={code}>
                  <Button
                    fullWidth
                    variant={code === selectedCountry ? "contained" : "outlined"}
                    onClick={() => onSelect(code)}
                    sx={{ justifyContent: "flex-start" }}
                  >
                    {name}
                  </Button>
                </li>
              ))}
            </Box>
          )}
          {CONTACT_URL && (
            <Button
              variant="text"
              startIcon={<MailOutlineIcon />}
              href={CONTACT_URL}
              {...(CONTACT_URL.startsWith("mailto:")
                ? {}
                : { target: "_blank", rel: "noopener noreferrer" })}
              sx={{ alignSelf: "flex-start", mt: 1 }}
            >
              {t("home:landing:contact")}
            </Button>
          )}
        </Box>
      </Box>

      <RestartAnalysisModal
        pendingCountry={pendingCountry}
        onConfirm={confirmRestart}
        onCancel={cancelRestart}
      />
    </Box>
  );
};
