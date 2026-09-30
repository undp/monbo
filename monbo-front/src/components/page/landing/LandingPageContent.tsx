"use client";

import { useContext, useEffect } from "react";
import { Alert, Box, Button, Skeleton, alpha, useTheme } from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { RestartAnalysisModal } from "@/components/reusable/Modals/RestartAnalysisModal";
import { DataContext } from "@/context/DataContext";
import { useAvailableCountries } from "@/hooks/useAvailableCountries";
import { useCountryChange } from "@/hooks/useCountryChange";
import { CONTACT_URL } from "@/config/env";
import { CountryCard } from "./CountryCard";
import { InviteCard } from "./InviteCard";

// Selected when the user arrives without a country, if it has layers.
const DEFAULT_COUNTRY = "CO";

export const LandingPageContent: React.FC = () => {
  const { t } = useTranslation();
  const colors = useTheme().palette.landing;
  const router = useRouter();
  const { selectedCountry, setSelectedCountry, countryHydrated } =
    useContext(DataContext);
  const { countries, loading, error } = useAvailableCountries();
  const { requestCountryChange, pendingCountry, confirmRestart, cancelRestart } =
    useCountryChange();

  // Start with a country chosen, so "Continue" is always possible.
  useEffect(() => {
    if (!countryHydrated || selectedCountry || !countries.length) return;
    const initial =
      countries.find(({ code }) => code === DEFAULT_COUNTRY) ?? countries[0];
    setSelectedCountry(initial.code);
  }, [countryHydrated, selectedCountry, countries, setSelectedCountry]);

  const selected = countries.find(({ code }) => code === selectedCountry);

  return (
    <Box
      component="section"
      sx={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: { xs: "40px 20px 56px", md: "56px 32px 72px" },
        color: colors.text,
      }}
    >
      <Box
        component="h1"
        sx={{
          fontSize: { xs: 32, md: 40 },
          fontWeight: 500,
          textAlign: "center",
          margin: "0 0 16px",
          letterSpacing: "-.01em",
        }}
      >
        {t("home:landing:title")}
      </Box>
      <Box
        component="p"
        sx={{
          fontSize: 19,
          color: colors.textSecondary,
          textAlign: "center",
          margin: "0 auto 48px",
          maxWidth: 760,
          lineHeight: 1.45,
          textWrap: "pretty",
        }}
      >
        {t("home:landing:subtitle")}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {t("home:landing:loadError")}
        </Alert>
      )}
      {!loading && !error && countries.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t("home:landing:noCountries")}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "28px",
          // auto-fit widens a lone card to the whole row (e.g. only the invite
          // card when the countries can't load): keep every card card-sized.
          "& > *": { width: "100%", maxWidth: 280, justifySelf: "center" },
        }}
      >
        {loading
          ? [0, 1, 2].map((index) => (
              <Skeleton
                key={index}
                variant="rounded"
                sx={{ aspectRatio: "1 / 1", height: "auto", borderRadius: "24px" }}
              />
            ))
          : countries.map(({ code, name }) => (
              <CountryCard
                key={code}
                code={code}
                name={name}
                selected={code === selectedCountry}
                onSelect={(country) => requestCountryChange(country)}
              />
            ))}
        {CONTACT_URL && <InviteCard href={CONTACT_URL} />}
      </Box>

      <Box sx={{ marginTop: 5, display: "flex", justifyContent: "center" }}>
        <Button
          variant="contained"
          disabled={!selected}
          onClick={() => router.push("/home")}
          endIcon={<span aria-hidden>→</span>}
          sx={{
            minWidth: { xs: "100%", sm: 360 },
            justifyContent: "space-between",
            gap: 6,
            backgroundColor: colors.primary,
            borderRadius: "10px",
            padding: "18px 22px",
            fontSize: 20,
            fontWeight: 500,
            textTransform: "none",
            boxShadow: `0 2px 4px ${alpha(colors.primary, 0.25)}`,
            "&:hover": { backgroundColor: colors.primaryDark },
            "& .MuiButton-endIcon": { fontSize: 22, marginLeft: 0 },
          }}
        >
          {selected
            ? t("home:landing:continueWith", { country: selected.name })
            : t("home:landing:continue")}
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
