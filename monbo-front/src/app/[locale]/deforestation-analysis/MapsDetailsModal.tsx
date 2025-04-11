"use client";

import React, { useContext, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  IconButton,
  Chip,
  Grid2 as Grid,
  Link,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { MapData } from "@/interfaces/DeforestationAnalysis";
import { DataContext } from "@/context/DataContext";
import { Text } from "@/components/reusable/Text";
import ReactMarkdown from "react-markdown";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const MapsDetailsModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation(["deforestationAnalysis"]);
  const {
    deforestationAnalysisParams: { selectedMaps },
  } = useContext(DataContext);
  const [selectedMap, setSelectedMap] = useState<MapData | null>(
    selectedMaps[0]
  );

  const attributes = [
    "coverage",
    "source",
    "resolution",
    "contentDate",
    "updateFrequency",
    "reference",
    "considerations",
  ] as (keyof MapData)[];

  if (!selectedMap) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          p: 0,
          minHeight: "calc(100vh - 96px)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6" component="div">
          {t("deforestationAnalysis:mapsInfoModal.title")}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            marginBottom: 4,
            position: "sticky",
            top: 0,
            backgroundColor: "background.paper",
            zIndex: 1000,
            paddingTop: 1,
            paddingBottom: 1,
            flexWrap: "wrap",
            maxWidth: "100%",
          }}
        >
          {selectedMaps.map((map) => (
            <Chip
              key={map.id}
              label={`${map.name} (${map.alias})`}
              onClick={() => setSelectedMap(map)}
              color={selectedMap?.id === map.id ? "primary" : "default"}
              variant="filled"
            />
          ))}
        </Box>
        {selectedMap && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {attributes.map((keyword) => (
              <DetailItem
                key={keyword}
                label={t(`deforestationAnalysis:mapsInfoModal.${keyword}`)}
                isMarkdown={keyword === "considerations"}
                value={
                  keyword === "reference" ? (
                    selectedMap[keyword] ? (
                      <Link
                        href={selectedMap[keyword] as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ wordBreak: "break-word" }}
                      >
                        {selectedMap[keyword]}
                      </Link>
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
  isMarkdown?: boolean;
}

const DetailItem: React.FC<DetailItemProps> = ({
  label,
  value,
  isMarkdown,
}) => (
  <Grid container spacing={2}>
    <Grid size={3}>
      <Text
        variant="body2"
        sx={{
          wordBreak: "break-word",
        }}
      >
        {label}
      </Text>
    </Grid>
    <Grid size={9}>
      <Typography
        variant="body2"
        component={isMarkdown ? "div" : "p"}
        sx={{
          wordBreak: "break-word",
        }}
      >
        {value}
      </Typography>
    </Grid>
  </Grid>
);
