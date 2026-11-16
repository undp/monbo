"use client";

import { useContext, useEffect, useId } from "react";
import { Box, Button, Skeleton, useTheme } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useTranslation } from "react-i18next";
import { RestartAnalysisModal } from "@/components/reusable/Modals/RestartAnalysisModal";
import { CONTACT_URL } from "@/config/env";
import { DataContext } from "@/context/DataContext";
import { useAvailableCountries } from "@/hooks/useAvailableCountries";
import { useCountryChange } from "@/hooks/useCountryChange";
import { CountryPill } from "./CountryPill";

// Selected when the user arrives without a country, if it has layers.
const DEFAULT_COUNTRY = "CO";

interface LandingStartProps {
  // Opens stage 1, as step card 1 does. Stable across renders.
  onStart: () => void;
}

/**
 * "Where do you produce?": one pill per country with layers, the button that starts
 * the flow there, and the link to ask for another country. The only part of the
 * start page that follows the selected country.
 */
export const LandingStart: React.FC<LandingStartProps> = ({ onStart }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = theme.palette.landing;
  const labelId = useId();
  const { selectedCountry, setSelectedCountry, countryHydrated } =
    useContext(DataContext);
  const { countries, loading, error } = useAvailableCountries();
  const { requestCountryChange, pendingCountry, confirmRestart, cancelRestart } =
    useCountryChange();

  // Start with a country chosen, so "Start in …" is always possible.
  useEffect(() => {
    if (!countryHydrated || selectedCountry || !countries.length) return;
    const initial =
      countries.find(({ code }) => code === DEFAULT_COUNTRY) ?? countries[0];
    setSelectedCountry(initial.code);
  }, [countryHydrated, selectedCountry, countries, setSelectedCountry]);

  const selected = countries.find(({ code }) => code === selectedCountry);
  const message = error
    ? t("home:landing:loadError")
    : !loading && countries.length === 0
      ? t("home:landing:noCountries")
      : null;

  return (
    <Box
      sx={{
        marginTop: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        flexWrap: "wrap",
        padding: { xs: "14px 16px", md: "14px 16px 14px 22px" },
        borderRadius: "16px",
        backgroundColor: "#fff",
        border: `1px solid ${colors.line}`,
        boxShadow: "0 10px 28px rgba(10,36,64,.08)",
      }}
    >
      <Box
        component="span"
        id={labelId}
        sx={{
          font: "700 11px/1 var(--font-roboto)",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: colors.muted,
          marginRight: 0.5,
        }}
      >
        {t("home:landing:where")}
      </Box>
      <Box
        role="group"
        aria-labelledby={labelId}
        aria-busy={loading}
        sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}
      >
        {loading
          ? [0, 1, 2].map((index) => (
              <Skeleton key={index} variant="rounded" width={112} height={36} sx={{ borderRadius: 999 }} />
            ))
          : countries.map(({ code, name }) => (
              <CountryPill
                key={code}
                code={code}
                name={name}
                selected={code === selectedCountry}
                onSelect={requestCountryChange}
              />
            ))}
      </Box>
      {message && (
        <Box component="p" role="status" sx={{ margin: 0, fontSize: 14, color: error ? theme.palette.error.main : colors.muted }}>
          {message}
        </Box>
      )}
      <Box
        sx={{
          marginLeft: { md: "auto" },
          width: { xs: "100%", md: "auto" },
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap-reverse",
          gap: { xs: 1.5, md: 2.25 },
        }}
      >
        {CONTACT_URL && (
          <Box
            component="a"
            href={CONTACT_URL}
            {...(CONTACT_URL.startsWith("mailto:")
              ? {}
              : { target: "_blank", rel: "noopener noreferrer" })}
            sx={{ color: colors.muted, fontSize: 13 }}
          >
            {t("home:landing:contact")}
          </Box>
        )}
        <Button
          variant="contained"
          disabled={!selected}
          onClick={onStart}
          endIcon={<ArrowForwardIcon />}
          sx={{
            width: { xs: "100%", md: "auto" },
            backgroundColor: colors.blue,
            borderRadius: "10px",
            padding: "14px 22px",
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.2,
            textTransform: "none",
            boxShadow: "0 2px 6px rgba(13,100,160,.3)",
            "&:hover": { backgroundColor: colors.blueDark },
          }}
        >
          {selected
            ? t("home:landing:start", { country: selected.name })
            : t("home:landing:startWithoutCountry")}
        </Button>
      </Box>
      <RestartAnalysisModal
        pendingCountry={pendingCountry}
        onConfirm={confirmRestart}
        onCancel={cancelRestart}
      />
    </Box>
  );
};
