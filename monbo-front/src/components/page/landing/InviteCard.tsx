"use client";

import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

/** "Your country could be next": opens the contact link to ask for a country. */
export const InviteCard: React.FC<{ href: string }> = ({ href }) => {
  const { t } = useTranslation();
  const colors = useTheme().palette.landing;

  return (
    <Box
      component="a"
      href={href}
      {...(href.startsWith("mailto:")
        ? {}
        : { target: "_blank", rel: "noopener noreferrer" })}
      sx={{
        aspectRatio: "1 / 1",
        border: `2px dashed ${colors.ring}`,
        borderRadius: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        padding: 3,
        textAlign: "center",
        textDecoration: "none",
        color: colors.text,
        transition: "background-color .18s, border-color .18s",
        "&:hover": {
          backgroundColor: colors.tint,
          borderColor: colors.primary,
        },
        "&:hover .invite-plus": { backgroundColor: "#fff" },
        "&:focus-visible": {
          outline: `3px solid ${colors.primaryDark}`,
          outlineOffset: 3,
        },
      }}
    >
      <Box
        component="span"
        className="invite-plus"
        aria-hidden
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: colors.tint,
          color: colors.primary,
          display: "grid",
          placeItems: "center",
          fontSize: 32,
          lineHeight: 1,
        }}
      >
        +
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, textWrap: "balance" }}
      >
        {t("home:landing:inviteTitle")}
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 16, fontWeight: 500, color: colors.primary }}
      >
        {t("home:landing:inviteLink")} →
      </Box>
    </Box>
  );
};
