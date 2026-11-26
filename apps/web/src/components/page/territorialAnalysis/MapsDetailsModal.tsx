"use client";

import React, { useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  Chip,
  Grid,
  Link,
} from "@mui/material";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { ModalHeader } from "@/components/reusable/Modals/ModalHeader";
import { MODAL_PADDING, MODAL_PAPER } from "@/components/reusable/Modals/modalStyles";
import { useTranslation } from "react-i18next";
import { MapData } from "@/interfaces/LayerAnalysis";
import { DataContext } from "@/context/DataContext";
import { Text } from "@/components/reusable/Text";
import { layerLabel } from "@/utils/layerLabel";
import ReactMarkdown from "react-markdown";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const MapsDetailsModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation(["territorialAnalysis"]);
  const {
    territorialAnalysisParams: { selectedMaps },
  } = useContext(DataContext);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const selectedMap =
    selectedMaps.find((map) => map.id === selectedMapId) ?? selectedMaps[0] ?? null;

  const attributes = [
    "coverage",
    "source",
    "resolution",
    "contentDate",
    "updateFrequency",
    "publishDate",
    "references",
    "considerations",
  ] as (keyof MapData)[];

  if (!selectedMap) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: { sx: { ...MODAL_PAPER, minHeight: "calc(100vh - 96px)" } },
      }}
    >
      <ModalHeader
        title={t("territorialAnalysis:mapsInfoModal.title")}
        icon={<LayersOutlinedIcon />}
        onClose={onClose}
      />
      <DialogContent sx={{ padding: MODAL_PADDING }}>
        <Box
          role="radiogroup"
          aria-label={t("territorialAnalysis:mapsInfoModal.title")}
          // A radio group: the arrows move the choice, Tab leaves the group
          onKeyDown={(event) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
              event.key as "ArrowRight"
            ];
            if (!step || !selectedMaps.length) return;
            event.preventDefault();
            const current = selectedMaps.findIndex((map) => map.id === selectedMap.id);
            const next =
              selectedMaps[(current + step + selectedMaps.length) % selectedMaps.length];
            setSelectedMapId(next.id);
            event.currentTarget
              .querySelector<HTMLElement>(`[data-map-id="${next.id}"]`)
              ?.focus();
          }}
          sx={{
            display: "flex",
            gap: 1,
            marginBottom: 3,
            position: "sticky",
            top: 0,
            backgroundColor: "background.paper",
            zIndex: 1000,
            paddingTop: 0.5,
            paddingBottom: 2,
            borderBottom: `1px solid ${FLOW_COLORS.line}`,
            flexWrap: "wrap",
            maxWidth: "100%",
          }}
        >
          {selectedMaps.map((map) => {
            const selected = selectedMap?.id === map.id;
            return (
              <Chip
                key={map.id}
                label={layerLabel(map)}
                onClick={() => setSelectedMapId(map.id)}
                role="radio"
                aria-checked={selected}
                data-map-id={map.id}
                tabIndex={selected ? 0 : -1}
                // The flow's pills: the chosen layer blue, the others outlined
                sx={{
                  height: 34,
                  borderRadius: "17px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: selected ? FLOW_COLORS.blue : FLOW_COLORS.fieldLine,
                  color: selected ? FLOW_COLORS.white : FLOW_COLORS.ink2,
                  backgroundColor: selected ? FLOW_COLORS.blue : FLOW_COLORS.white,
                  "&:hover": {
                    backgroundColor: selected ? FLOW_COLORS.blueDark : FLOW_COLORS.blue25,
                  },
                  // MUI's focus darkens a default Chip to gray, under white text
                  "&.Mui-focusVisible": {
                    backgroundColor: selected ? FLOW_COLORS.blue : FLOW_COLORS.white,
                    outline: `2px solid ${FLOW_COLORS.blue}`,
                    outlineOffset: 2,
                  },
                }}
              />
            );
          })}
        </Box>
        {selectedMap && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {attributes.map((keyword) => (
              <DetailItem
                key={keyword}
                label={t(`territorialAnalysis:mapsInfoModal:${keyword}`)}
                typographyComponent={
                  keyword === "considerations" || keyword === "references"
                    ? "div"
                    : "p"
                }
                value={
                  keyword === "references" ? (
                    selectedMap[keyword].length > 0 ? (
                      <Box>
                        {selectedMap[keyword].map(
                          (reference: string, index: number) => (
                            <Box
                              key={index}
                              sx={{
                                mb:
                                  index < selectedMap[keyword].length - 1
                                    ? 1
                                    : 0,
                              }}
                            >
                              <Link
                                href={reference}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ wordBreak: "break-word" }}
                              >
                                {reference}
                              </Link>
                            </Box>
                          )
                        )}
                      </Box>
                    ) : (
                      t("common:na")
                    )
                  ) : keyword === "considerations" ? (
                    selectedMap[keyword] ? (
                      <Box sx={{ marginTop: -1.5 }}>
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => (
                              <Typography
                                variant="body2"
                                component="div"
                                sx={{ mb: 2 }} // Added margin bottom for paragraph spacing
                              >
                                {children}
                              </Typography>
                            ),
                            ol: ({ children }) => (
                              <ol style={{ paddingLeft: 0 }}>{children}</ol>
                            ),
                            ul: ({ children }) => (
                              <ul style={{ paddingLeft: 20 }}>{children}</ul>
                            ),
                          }}
                        >
                          {selectedMap[keyword]}
                        </ReactMarkdown>
                      </Box>
                    ) : (
                      t("common:na")
                    )
                  ) : (
                    selectedMap[keyword] ?? t("common:na")
                  )
                }
              />
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface DetailItemProps {
  label: string;
  value: React.ReactNode;
  typographyComponent?: "p" | "div";
}

const DetailItem: React.FC<DetailItemProps> = ({
  label,
  value,
  typographyComponent = "p",
}) => (
  // On a phone the label goes above its value: a quarter of the width cuts labels
  // such as "Fecha del contenido" mid-word.
  <Grid container columnSpacing={2} rowSpacing={{ xs: 0.5, sm: 2 }}>
    <Grid size={{ xs: 12, sm: 3 }}>
      <Text variant="body2" bold sx={{ color: FLOW_COLORS.ink2 }}>
        {label}
      </Text>
    </Grid>
    <Grid size={{ xs: 12, sm: 9 }}>
      <Typography
        variant="body2"
        component={typographyComponent}
        sx={{
          wordBreak: "break-word",
        }}
      >
        {value}
      </Typography>
    </Grid>
  </Grid>
);
