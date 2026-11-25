"use client";

import React, { useContext, useEffect, useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AdminApiError } from "@/api/adminLayers";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { PageEyebrow } from "@/components/page/flow/PageEyebrow";
import {
  FLOW_COLORS,
  HEADING_FONT,
  STAGE_CARD,
  stagePageBackground,
} from "@/components/page/flow/flowStyles";
import { FIELD } from "@/components/reusable/inputs/fieldStyles";
import { localizedPath } from "@/utils/languageChange";

export const AdminLoginPageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session, ready, login } = useContext(AdminSessionContext);
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace(localizedPath("/admin/layers", i18n.language));
  }, [ready, session, router, i18n.language]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(passkey);
      setPasskey("");
      // The effect above redirects once the session is stored.
    } catch (e) {
      const status = e instanceof AdminApiError ? e.status : 0;
      if (status === 401) {
        setError(t("admin:login:errors:invalid"));
      } else if (status === 429) {
        const seconds = (e as AdminApiError).retryAfterSeconds ?? 900;
        setError(
          t("admin:login:errors:tooManyAttempts", {
            minutes: Math.ceil(seconds / 60),
          })
        );
      } else if (status === 404) {
        setError(t("admin:login:errors:notEnabled"));
      } else if (status === 403) {
        setError(t("admin:login:errors:forbiddenOrigin"));
      } else {
        setError(t("admin:login:errors:network"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // The stage pages' background and card, as the signed-in admin pages
    <Box
      sx={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: { xs: "32px 16px", md: "72px 16px" },
        background: stagePageBackground,
      }}
    >
      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{
          ...STAGE_CARD,
          width: "100%",
          maxWidth: 440,
          padding: { xs: 3, md: 4 },
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 44,
            height: 44,
            borderRadius: "12px",
            display: "grid",
            placeItems: "center",
            backgroundColor: FLOW_COLORS.blue50,
            color: FLOW_COLORS.blue,
          }}
        >
          <LockOutlinedIcon />
        </Box>
        <Box>
          <PageEyebrow>{t("admin:eyebrowAll")}</PageEyebrow>
          <Box
            component="h1"
            sx={{
              margin: "6px 0 0",
              fontFamily: HEADING_FONT,
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: FLOW_COLORS.ink,
            }}
          >
            {t("admin:login:title")}
          </Box>
          <Box
            component="p"
            sx={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.5, color: FLOW_COLORS.ink2 }}
          >
            {t("admin:login:subtitle")}
          </Box>
        </Box>
        <TextField
          label={t("admin:login:passkeyLabel")}
          type="password"
          autoComplete="current-password"
          value={passkey}
          onChange={(e) => setPasskey(e.target.value)}
          autoFocus
          fullWidth
          sx={FIELD}
        />
        {error && (
          <Alert severity="error" sx={{ borderRadius: "10px" }}>
            {error}
          </Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!passkey || submitting}
        >
          {t("admin:login:submit")}
        </Button>
      </Box>
    </Box>
  );
};
