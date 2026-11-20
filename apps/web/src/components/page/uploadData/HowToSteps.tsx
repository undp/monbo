"use client";

import { Box } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { HOW_TO_LINK, HowToLink } from "./uploadStepStyles";

interface Props {
  /** The chosen method's steps, in order. */
  steps: string[];
  /** Its template and example. */
  links: HowToLink[];
  /** The geo file's "which fields" help, for that method only. */
  onFieldsHelp?: () => void;
}

/** The "how to" panel of the chosen upload method: its steps and its links. */
export const HowToSteps: React.FC<Props> = ({ steps, links, onFieldsHelp }) => {
  const { t } = useTranslation();
  return (
    <Box>
      <Box
        component="h3"
        sx={{
          margin: 0,
          marginBottom: 1.5,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: FLOW_COLORS.muted,
        }}
      >
        {t("common:farmsUpload:howTo")}
      </Box>
      {/* In order, but with bullets: digits here read like the flow's stages. */}
      <Box
        component="ol"
        sx={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
        }}
      >
        {steps.map((step) => (
          <Box
            component="li"
            key={step}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.25,
              fontSize: 14,
              color: FLOW_COLORS.ink2,
            }}
          >
            <ChevronRightRoundedIcon
              aria-hidden
              sx={{ fontSize: 18, color: FLOW_COLORS.leafDark, marginTop: "1px" }}
            />
            {step}
          </Box>
        ))}
      </Box>
      {(links.length > 0 || onFieldsHelp) && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: 2,
            rowGap: 1,
            marginTop: 1.75,
          }}
        >
          {links.map((link) => (
            <Box
              component="a"
              key={link.href}
              href={link.href}
              download
              sx={HOW_TO_LINK}
            >
              {link.template && (
                <FileDownloadOutlinedIcon aria-hidden sx={{ fontSize: 16 }} />
              )}
              {link.label}
            </Box>
          ))}
          {onFieldsHelp && (
            <Box
              component="button"
              type="button"
              onClick={onFieldsHelp}
              sx={HOW_TO_LINK}
            >
              {t("common:farmsUpload:cards:geoData:fieldsHelp")}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
