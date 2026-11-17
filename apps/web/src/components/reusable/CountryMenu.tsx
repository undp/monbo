"use client";

import { useContext, useState } from "react";
import { Box, Button, Menu, MenuItem } from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useAvailableCountries } from "@/hooks/useAvailableCountries";
import { useCountryChange } from "@/hooks/useCountryChange";
import { useIsStartPage } from "@/hooks/useIsStartPage";
import { getCountryName } from "@/utils/countries";
import { RestartAnalysisModal } from "./Modals/RestartAnalysisModal";

// The analysis country, in the header. Changes go through useCountryChange, which
// asks for a restart once an analysis exists. The start page chooses it in its own
// start bar, so the menu is hidden there.
export const CountryMenu: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedCountry } = useContext(DataContext);
  const { countries } = useAvailableCountries();
  const { requestCountryChange, pendingCountry, confirmRestart, cancelRestart } =
    useCountryChange();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const startPage = useIsStartPage();

  if (!selectedCountry || startPage) return null;

  const selectedName =
    getCountryName(selectedCountry, i18n.language as "en" | "es") ??
    selectedCountry;

  return (
    <>
      <Button
        aria-label={t("common:countrySelection:menuLabel")}
        aria-haspopup="menu"
        startIcon={<PlaceOutlinedIcon />}
        endIcon={<ArrowDropDownIcon />}
        sx={{
          color: "#3A3541",
          minWidth: 0,
          "& .MuiButton-startIcon": { marginRight: { xs: 0, sm: 1 } },
        }}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        {/* Narrow screens show only the pin: the flow header names the country. */}
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          {selectedName}
        </Box>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {countries.map(({ code, name }) => (
          <MenuItem
            key={code}
            selected={code === selectedCountry}
            onClick={() => {
              setAnchorEl(null);
              requestCountryChange(code);
            }}
          >
            {name}
          </MenuItem>
        ))}
      </Menu>
      <RestartAnalysisModal
        pendingCountry={pendingCountry}
        onConfirm={confirmRestart}
        onCancel={cancelRestart}
      />
    </>
  );
};
