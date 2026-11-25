import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_TABLE_COMPACT_SX, FLOW_TABLE_FRAME } from "@/components/page/flow/flowTable";
import { BaseModal } from "@/components/reusable/BaseModal";
import { GeoAttributeKey, geoAttributeMappings } from "@/utils/excel";

const NOTE = { margin: 0, fontSize: 13.5, lineHeight: 1.5, color: FLOW_COLORS.ink2 } as const;
const CODE = { fontFamily: "monospace", fontSize: 13 } as const;

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
    <BaseModal
      isOpen={open}
      handleClose={onClose}
      title={t("common:geoFile:help:title")}
      icon={<TableChartOutlinedIcon />}
      maxWidth="md"
      actions={
        <Button variant="contained" onClick={onClose}>
          {t("common:close")}
        </Button>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box component="p" sx={NOTE}>
          {t("common:geoFile:help:intro")}
        </Box>
        <Box sx={{ ...FLOW_TABLE_FRAME, ...FLOW_TABLE_COMPACT_SX }}>
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
                  <TableCell sx={CODE}>{geoAttributeMappings[key].geoFile}</TableCell>
                  <TableCell sx={CODE}>{geoAttributeMappings[key].shapefile}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box component="p" sx={NOTE}>
          {t("common:geoFile:help:mandatory")}
        </Box>
        <Box component="p" sx={NOTE}>
          {t("common:geoFile:help:notes")}
        </Box>
      </Box>
    </BaseModal>
  );
};
