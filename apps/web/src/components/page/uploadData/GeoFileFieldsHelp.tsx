import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/reusable/Text";
import { GeoAttributeKey, geoAttributeMappings } from "@/utils/excel";

const KEYS = Object.keys(geoAttributeMappings) as GeoAttributeKey[];

interface GeoFileFieldsHelpProps {
  open: boolean;
  onClose: () => void;
}

/** The attribute names a geo file's features are read from (option 2). */
export const GeoFileFieldsHelp: React.FC<GeoFileFieldsHelpProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("common:geoFile:help:title")}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Text variant="body2" color="secondary">
            {t("common:geoFile:help:intro")}
          </Text>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("common:geoFile:help:field")}</TableCell>
                <TableCell>{t("common:geoFile:help:geoFile")}</TableCell>
                <TableCell>{t("common:geoFile:help:shapefile")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {KEYS.map((key) => (
                <TableRow key={key}>
                  <TableCell>
                    {t(`common:geoFile:help:fields:${key}`)}
                    {geoAttributeMappings[key].mandatory && " *"}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>
                    {geoAttributeMappings[key].geoFile}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>
                    {geoAttributeMappings[key].shapefile}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Text variant="body2" color="secondary">
            {t("common:geoFile:help:mandatory")}
          </Text>
          <Text variant="body2" color="secondary">
            {t("common:geoFile:help:notes")}
          </Text>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common:close")}</Button>
      </DialogActions>
    </Dialog>
  );
};
