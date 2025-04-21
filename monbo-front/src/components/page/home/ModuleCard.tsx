"use client";

import React from "react";
import { Paper, Typography, Button, Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import Image from "next/image";
import { useTranslation } from "react-i18next";

interface Props {
  step: number;
  textNamespace: string;
  color?: string;
  imgSrc?: string;
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * A functional component that renders a module button with a title, description, and an optional image.
 * The button is styled using Material-UI components and supports internationalization.
 *
 * @param {Props} props - The properties for the ModuleButton component.
 * @param {number} props.step - The step number to display.
 * @param {string} props.textNamespace - The namespace for the text translations.
 * @param {string} [props.color="red"] - The color for the button and background.
 * @param {string} [props.imgSrc] - The source URL for the optional image.
 * @param {() => void} props.onPress - The callback function to call when the button is pressed.
 * @param {boolean} [props.disabled=false] - Whether the button is disabled.
 *
 * @returns {JSX.Element} The rendered ModuleButton component.
 */
export const ModuleCard: React.FC<Props> = ({
  step,
  textNamespace,
  color = "red",
  imgSrc,
  onPress,
  disabled = false,
}) => {
  const { t } = useTranslation(["common", "home"]);
  return (
    <Paper
      sx={{
        maxWidth: 604,
        backgroundColor: disabled ? "#F5F5F5" : alpha(color, 0.05),
        borderRadius: 3,
        boxShadow: "0px 4px 8px 0px rgba(183, 183, 183, 0.25)",
        padding: "24px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 3,
        opacity: disabled ? 0.7 : 1,
        minHeight: 356,
      }}
      elevation={10}
    >
      <Box sx={{ display: "flex" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography
            variant="h2"
            sx={{ fontSize: 16, fontWeight: 600, lineHeight: "27px" }}
          >
            {t("step")} {step}
          </Typography>
          <Typography
            variant="h1"
            sx={{ fontSize: 24, fontWeight: 600, lineHeight: "27px" }}
          >
            {t(`${textNamespace}:title`)}
          </Typography>
          <Typography
            variant="body1"
            sx={{ fontSize: 16, fontWeight: 400, lineHeight: "27px" }}
          >
            {t(`${textNamespace}:description`)}
          </Typography>
        </Box>
        <Box>
          {imgSrc && (
            <Image src={imgSrc} alt={`step-${step}`} width={83} height={83} />
          )}
        </Box>
      </Box>
      {!!onPress && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <CustomButton
            text={t(`${textNamespace}:button`)}
            color={color}
            onPress={onPress}
            disabled={disabled}
          />
        </Box>
      )}
    </Paper>
  );
};

interface CustomButtonProps {
  text: string;
  color: string;
  onPress?: () => void;
  disabled?: boolean;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  text,
  color,
  onPress,
  disabled = false,
}) => {
  return (
    <Button
      variant="contained"
      endIcon={<TrendingFlatIcon />}
      disabled={disabled}
      sx={{
        width: "100%",
        justifyContent: "space-between",
        fontSize: 20,
        lineHeight: "19px",
        padding: 2,
        borderRadius: 2,
        boxShadow: "unset",
        backgroundColor: disabled ? "#E0E0E0" : color,
        textTransform: "unset",
        "&:hover": {
          backgroundColor: disabled ? "#E0E0E0" : color,
          opacity: disabled ? 1 : 0.8,
        },
      }}
      onClick={disabled ? undefined : onPress}
    >
      {text}
    </Button>
  );
};
