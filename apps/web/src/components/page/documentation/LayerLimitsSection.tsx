"use client";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Link,
  Typography,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslation } from "react-i18next";
import type { CountryLayerCatalogState } from "@/hooks/useCountryLayerCatalog";
import { groupLayersByCategory, isWebUrl } from "@/utils/layerCatalog";
import { localizedText } from "@/utils/localizedText";
import { CatalogStatus } from "./CatalogStatus";
import { CategoryChip } from "@/components/reusable/CategoryChip";
import { ConsiderationsMarkdown } from "./DocumentationMarkdown";
import { HEADING_FONT } from "./methodologyStyles";

interface LayerLimitsSectionProps {
  /** The country chosen in "Capas por país", null while there is none. */
  countryName: string | null;
  catalog: CountryLayerCatalogState;
}

/**
 * "Alcances y límites": each layer of the country chosen in the layers section,
 * with its category and, closed at first, its considerations and references.
 */
export const LayerLimitsSection: React.FC<LayerLimitsSectionProps> = ({ countryName, catalog }) => {
  const { t, i18n } = useTranslation();
  const colors = useTheme().palette.landing;
  if (!countryName) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography component="h3" sx={{ font: `700 18px/1.3 ${HEADING_FONT}`, color: colors.ink, mb: 1.5 }}>
        {t("methodology:limits:country", { country: countryName })}
      </Typography>
      <CatalogStatus state={catalog} countryName={countryName} />
      {catalog.status === "ready" &&
        (catalog.catalog.maps.length === 0 ? (
          <Typography sx={{ color: colors.muted }}>
            {t("methodology:catalog:empty", { country: countryName })}
          </Typography>
        ) : (
          groupLayersByCategory(catalog.catalog.categories, catalog.catalog.maps).flatMap(
            ({ category, layers }) =>
              layers.map((map) => (
                <Accordion
                  key={map.id}
                  disableGutters
                  elevation={0}
                  slotProps={{ transition: { unmountOnExit: true } }}
                  sx={{
                    border: `1px solid ${colors.line}`,
                    borderRadius: "12px",
                    mb: 1.25,
                    "&::before": { display: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
                      <Typography sx={{ fontWeight: 600 }}>{map.name ?? map.alias}</Typography>
                      {category ? (
                        <CategoryChip
                          name={localizedText(category.name, i18n.language)}
                          icon={category.icon}
                          color={category.color}
                        />
                      ) : (
                        <CategoryChip
                          name={t("methodology:category:others")}
                          icon={null}
                          color={null}
                        />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, color: colors.inkSecondary }}>
                    {map.considerations ? (
                      <ConsiderationsMarkdown>{map.considerations}</ConsiderationsMarkdown>
                    ) : (
                      <Typography variant="body2">{t("methodology:limits:noConsiderations")}</Typography>
                    )}
                    {map.references.length > 0 && (
                      <>
                        <Typography component="h4" sx={{ fontWeight: 600, fontSize: 15, mt: 2, mb: 1 }}>
                          {t("methodology:limits:references")}
                        </Typography>
                        <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                          {map.references.map((reference) => (
                            <Box component="li" key={reference} sx={{ mb: 0.5, fontSize: 14 }}>
                              {isWebUrl(reference) ? (
                                <Link
                                  href={reference}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ wordBreak: "break-word" }}
                                >
                                  {reference}
                                </Link>
                              ) : (
                                <Box component="span" sx={{ wordBreak: "break-word" }}>
                                  {reference}
                                </Box>
                              )}
                            </Box>
                          ))}
                        </Box>
                      </>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))
          )
        ))}
    </Box>
  );
};
