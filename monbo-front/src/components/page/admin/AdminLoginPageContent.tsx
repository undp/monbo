"use client";

import React, { useContext, useEffect, useState } from "react";
import { Alert, Box, Button, Paper, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AdminApiError } from "@/api/adminLayers";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { Text } from "@/components/reusable/Text";

export const AdminLoginPageContent: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, ready, login } = useContext(AdminSessionContext);
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace("/admin/layers");
  }, [ready, session, router]);

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
    <Box sx={{ display: "flex", justifyContent: "center", padding: 6 }}>
      <Paper
        component="form"
        onSubmit={onSubmit}
        sx={{
          width: 440,
          padding: 4,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Text variant="h5" component="h1" bold>
          {t("admin:login:title")}
        </Text>
        <Text color="secondary" variant="body2">
          {t("admin:login:subtitle")}
        </Text>
        <TextField
          label={t("admin:login:passkeyLabel")}
          type="password"
          autoComplete="current-password"
          value={passkey}
          onChange={(e) => setPasskey(e.target.value)}
          autoFocus
          fullWidth
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          type="submit"
          variant="contained"
          disabled={!passkey || submitting}
        >
          {t("admin:login:submit")}
        </Button>
      </Paper>
    </Box>
  );
};
